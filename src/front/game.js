const assert = require("assert");
const createDebug = require("debug");
const uuid = require("uuid/v4");
const leven = require("leven");

const createGame = require("../util/chess");
const html = require("../util/html");
const model = require("../util/model");
const {
  ACTIVITY_STREAMS_CONTEXT,
  CHESS_CONTEXT,
  ACTIVITY_STREAMS_MIME,
  PGN_MIME,
  KOA_JSON_ACCEPTS,
  SHORT_CACHE_SEC,
  UNICODE_BADGES,
  UNICODE_PIECES
} = require("../util/consts");
const { sample, sortBy } = require("../util/misc");
const { renderTemplate } = require("../util/fs");
const { renderPgn } = require("../util/pgn");

const UUID_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const debug = createDebug("chess:game");
const h = html.createElement;

module.exports = async ({
  actorUrl,
  domain,
  draw,
  jsonld,
  origin,
  outbox,
  pg,
  router
}) => {
  // Handle challenges, and start a new game if everything looks good.
  const handleChallenge = async object => {
    // Must be a person.
    const challengerActor = object.actor;
    if (challengerActor.type !== "Person") {
      debug("Challenge from invalid actor type");
      return;
    }

    // The note usually mentions us, and must mention exactly one other.
    const mentions = new Set(object.mentions);
    mentions.delete(actorUrl);
    mentions.delete(challengerActor.id);
    if (mentions.size !== 1) {
      debug("Challenge contained invalid mentions");
      return;
    }

    // Resolve the other player actor.
    const otherId = mentions.values().next().value;
    const resolver = jsonld.createResolver();
    const otherActor = await resolver.resolve(
      otherId,
      ACTIVITY_STREAMS_CONTEXT
    );
    if (!["Person", "Service", "Application"].includes(otherActor.type)) {
      debug("Challenge to invalid actor type");
      return;
    }

    // Pick sides.
    const [whiteActor, blackActor] =
      Math.random() > 0.5
        ? [challengerActor, otherActor]
        : [otherActor, challengerActor];

    // Create the game.
    const game = createGame();
    game.id = uuid();
    game.badge = sample(UNICODE_BADGES);
    game.whiteId = whiteActor.id;
    game.whiteName = whiteActor.preferredUsername || "???";
    game.blackId = blackActor.id;
    game.blackName = blackActor.preferredUsername || "???";

    await model.transact(pg, async pg => {
      const now = new Date();

      // Create the game record.
      const { rowCount } = await model.insertGame(
        pg,
        game.id,
        game.whiteId,
        game.whiteName,
        game.blackId,
        game.blackName,
        game.fen(),
        game.badge,
        now
      );
      assert.equal(rowCount, 1);

      // Mark the message as related to the game.
      await insertGameObject(pg, game.id, object.id);

      // Remove the other player from the challenge board, if present.
      await model.removeFromChallengeBoard(pg, otherActor.id);

      // Finish up with a reply.
      await finishWithReply(pg, object, game, {
        createdAt: now
      });
    });
  };

  // Handle replies to see if they belong to a game and contain a move.
  // Returns `true` if the object belongs to a game.
  const handleReply = async object => {
    let result = false;
    await model.transact(pg, async pg => {
      // Look up the game.
      const { rows: gameRows } = await model.getGameByObjectForUpdate(
        pg,
        object.inReplyTo
      );
      if (gameRows.length !== 1) {
        debug("Reply unrelated to a game");
        return;
      }

      // Restore the game.
      const row = gameRows[0];
      const game = createGame(row.fen);
      game.id = row.id;
      game.badge = row.badge;
      game.whiteId = row.whiteId;
      game.whiteName = row.whiteName;
      game.blackId = row.blackId;
      game.blackName = row.blackName;

      // Mark the message as related to the game.
      await insertGameObject(pg, game.id, object.id);
      result = true;

      // Check if the game is still in play.
      if (game.isGameOver()) {
        debug("Reply to finished game");
        return;
      }

      // Check if the correct side is trying to make a move.
      const turnId = game.turn() === "w" ? game.whiteId : game.blackId;
      if (object.actor.id !== turnId) {
        debug("Reply from wrong actor");
        return;
      }

      // Extract the SAN move from the text.
      const input = object.contentText
        // Strip inline mentions, which may prefix the move.
        .replace(/@[^\s]*/g, "")
        // Strip whitespace.
        .trim()
        // The first 'word' should now be the move; strip the rest.
        // A dot/period can also be used to have the bot ignore a reply.
        .replace(/[?!.,;\s].*$/, "");
      if (!input) {
        debug("Reply contained no move");
        return;
      }

      // Try to make the move.
      const move = game.move(input);
      if (!move) {
        debug("Reply contained invalid move");
        await suggestMove(pg, object, game, input);
        return;
      }

      // Save the new game state.
      const now = new Date();
      const { rowCount } = await model.updateGame(
        pg,
        game.id,
        game.fen(),
        game.isGameOver(),
        now
      );
      assert.equal(rowCount, 1);

      // Finish up with a reply.
      await finishWithReply(pg, object, game, { move });
    });
    return result;
  };

  // Finish up a succesful action by creating a reply, and marking both notes
  // as part of the game. Returns the reply note.
  const finishWithReply = async (pg, object, game, opts = {}) => {
    const move = opts.move;

    let line1, line2, line3;

    // Describe the last move.
    if (move) {
      const piece = UNICODE_PIECES[move.color + move.piece];
      const opponent = move.color === "w" ? "b" : "w";

      let descr;
      if (move.flags.includes("k")) {
        descr = `${piece} castled king-side`;
      } else if (move.flags.includes("q")) {
        descr = `${piece} castled queen-side`;
      } else {
        descr = `${piece} ${move.from} → ${move.to}`;
        if (move.flags.includes("p")) {
          const promotion = UNICODE_PIECES[move.color + move.promotion];
          descr += `, promoted to ${promotion}`;
        } else if (move.flags.includes("c")) {
          const captured = UNICODE_PIECES[opponent + move.captured];
          descr += `, captured ${captured}`;
        } else if (move.flags.includes("e")) {
          const captured = UNICODE_PIECES[opponent + move.captured];
          descr += `, en passant captured ${captured}`;
        }
      }

      // Note: there's an en-space after the badge.
      // eslint-disable-next-line no-irregular-whitespace
      line1 = [`${game.badge} [${move.number}. ${move.san}] ${descr}`];
    } else {
      // Note: there's an en-space after the badge.
      line1 = [
        // eslint-disable-next-line no-irregular-whitespace
        `${game.badge} ♙ `,
        html.createMention(game.whiteId, game.whiteName),
        " vs. ♟ ",
        html.createMention(game.blackId, game.blackName)
      ];

      // Add the game URL to the setup note.
      const gameUrl = `${origin}/games/${game.id}`;
      line3 = [
        "View the full game at any time at: ",
        h("a", { href: gameUrl }, [gameUrl])
      ];
    }

    // Describe the next move or ending condition.
    if (game.isInCheckmate()) {
      line2 = ["Checkmate."];
    } else if (game.isInDraw()) {
      line2 = ["Draw."];
    } else {
      line2 = [
        game.turn() === "w"
          ? html.createMention(game.whiteId, game.whiteName)
          : html.createMention(game.blackId, game.blackName),
        "'s turn"
      ];
      if (game.isInCheck()) {
        line2.push(" (Check)");
      }
      if (!move) {
        line2.push(", reply with your move.");
      }
    }

    const replyContent = [h("p", line1), h("p", line2)];
    if (line3) {
      replyContent.push(h("p", line3));
    }

    // Create the reply note.
    const fen = game.fen();
    const images = draw.imageUrls(fen, move);
    const createdAt = opts.createdAt || new Date();
    const reply = await outbox.createObject(pg, {
      "@context": [ACTIVITY_STREAMS_CONTEXT, CHESS_CONTEXT],
      type: "Note",
      published: createdAt.toISOString(),
      attributedTo: actorUrl,
      inReplyTo: object.id,
      // @todo: Disabled for now, but maybe should be configurable?
      // @todo: Mastodon requires us to specify this in full.
      // to: ["https://www.w3.org/ns/activitystreams#Public"],
      // cc: [game.whiteId, game.blackId],
      to: [game.whiteId, game.blackId],
      content: html.render(replyContent),
      attachment: [
        {
          type: "Image",
          mediaType: "image/png",
          url: images.moveImage
        }
      ],
      tag: [
        { type: "Mention", href: game.whiteId },
        { type: "Mention", href: game.blackId }
      ],
      game: `${origin}/games/${game.id}`,
      san: move ? move.san : undefined,
      fen,
      ...images
    });

    // Mark our reply as related to the game.
    await insertGameObject(pg, game.id, reply.id);

    return reply;
  };

  // Create a reply suggesting a move, after invalid input.
  const suggestMove = async (pg, object, game, input) => {
    // Get the 5 best matching moves, and turn them into text.
    const moves = sortBy([...game.moves()], move => leven(input, move))
      .slice(0, 5)
      .map(x => `'${x}'`);
    assert(moves.length >= 1);

    const lastMove = moves.pop();
    const movesText =
      moves.length === 0 ? lastMove : `${moves.join(", ")} or ${lastMove}`;

    // Craft a hilarious reply.
    const actor = object.actor;
    const replyContent = html.render(
      h("p", [
        html.createMention(actor.id, actor.preferredUsername),
        " ",
        sample([
          "That appears to be invalid!",
          "I can't make that work, I'm afraid.",
          "Does not compute!",
          "I don't know what to do with that.",
          "I wish we could go there, friend.",
          "We'd be breaking some rules if that was allowed!",
          "Something tells me thats wrong.",
          "A small misunderstanding.",
          "Anything but that!",
          "Are we still playing chess?",
          "That's some creative thinking there."
        ]),
        " ",
        sample([
          `Perhaps you want ${movesText}?`,
          `Did you mean ${movesText}?`,
          `Maybe ${movesText}?`,
          `Looking for ${movesText}?`
        ])
      ])
    );

    // Create the reply note.
    const reply = await outbox.createObject(pg, {
      "@context": [ACTIVITY_STREAMS_CONTEXT, CHESS_CONTEXT],
      type: "Note",
      published: new Date().toISOString(),
      attributedTo: actorUrl,
      inReplyTo: object.id,
      to: [actor.id],
      content: replyContent,
      tag: [{ type: "Mention", href: actor.id }],
      game: `${origin}/games/${game.id}`
    });

    // Mark our reply as related to the game.
    await insertGameObject(pg, game.id, reply.id);

    return reply;
  };

  // Mark an object as related to a game.
  // Replies to the object are then also matched to the game.
  const insertGameObject = async (pg, gameId, objectId) => {
    const { rowCount } = await model.insertGameObject(pg, gameId, objectId);
    assert.equal(rowCount, 1);
  };

  // Complete representation of a game.
  router.get("/games/:id", async ctx => {
    ctx.assert(UUID_REGEXP.test(ctx.params.id), 404, "Game not found");

    const { rows: gameRows } = await model.getGameById(pg, ctx.params.id);
    ctx.assert(gameRows.length === 1, 404, "Game not found");

    const gameRow = gameRows[0];
    const { rows: moveRows } = await model.getOutboxMovesByGame(pg, gameRow.id);
    ctx.assert(moveRows.length >= 1);

    const notes = moveRows.map(row => ({
      ...row.object,
      "@context": undefined
    }));
    const game = {
      "@context": [ACTIVITY_STREAMS_CONTEXT, CHESS_CONTEXT],
      id: `${origin}/games/${gameRow.id}`,
      fen: gameRow.fen,
      badge: gameRow.badge,
      whiteActor: gameRow.whiteId,
      blackActor: gameRow.blackId,
      whiteUsername: gameRow.whiteName,
      blackUsername: gameRow.blackName,
      setupNote: notes[0],
      moves: notes.slice(1)
    };

    // Shorter cache for games that are in-progress.
    if (!gameRow.gameOver) {
      ctx.set("Cache-Control", `public, max-age=${SHORT_CACHE_SEC}`);
    }

    const wantPgn = ctx.query.pgn !== undefined;
    wantPgn || ctx.response.vary("accept");
    if (!wantPgn && ctx.accepts("html")) {
      ctx.body = await renderTemplate("game", { domain, game });
      ctx.type = "html";
    } else if (wantPgn || ctx.accepts(PGN_MIME)) {
      ctx.body = renderPgn({ game, origin });
      ctx.type = PGN_MIME;
      ctx.attachment(`${gameRow.id}.pgn`);
    } else if (ctx.accepts(KOA_JSON_ACCEPTS)) {
      ctx.body = game;
      ctx.type = ACTIVITY_STREAMS_MIME;
    } else {
      ctx.status = 406;
    }
  });

  return { handleChallenge, handleReply };
};
