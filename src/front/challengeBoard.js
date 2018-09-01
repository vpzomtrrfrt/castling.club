const assert = require("assert");

const html = require("../util/html");
const model = require("../util/model");
const q = require("../util/q");
const { CONFIRMATIONS } = require("../util/consts");
const { sample } = require("../util/misc");

const h = html.createElement;

module.exports = ({ actorUrl, outbox, pg }) => {
  // Handle a request to be added to the challenge board.
  const handleRequest = async object => {
    await q.transact(pg, async () => {
      const { id, preferredUsername: name = "???" } = object.actor;

      // Update the challenge board.
      const now = new Date();
      const { rows } = await model.insertOrBumpChallengeBoard(
        pg,
        id,
        name,
        now
      );
      assert.equal(rows.length, 1);

      // Build the reply text.
      const replyContent = html.render([
        h("p", [
          html.createMention(id, name),
          " ",
          sample(CONFIRMATIONS),
          now.valueOf() === rows[0].createdAt.valueOf()
            ? " You are now on the challenge board."
            : " You have been bumped to the top of the challenge board."
        ])
      ]);

      // Create the reply note.
      await outbox.createObject(pg, {
        type: "Note",
        published: now.toISOString(),
        attributedTo: actorUrl,
        inReplyTo: object.id,
        to: [object.actor.id],
        content: replyContent,
        tag: [{ type: "Mention", href: object.actor.id }]
      });
    });
  };

  // Handle a request to be removed from the challenge board.
  const handleRemove = async object => {
    await q.transact(pg, async () => {
      const { id, preferredUsername: name = "???" } = object.actor;

      // Update the challenge board.
      const { rowCount } = await model.removeFromChallengeBoard(
        pg,
        object.actor.id
      );

      // Build the reply text.
      let replyText;
      if (rowCount === 0) {
        replyText = "You are not on the challenge board.";
      } else {
        assert.equal(rowCount, 1);
        replyText = "You've been removed from the challenge board.";
      }
      const replyContent = html.render([
        h("p", [html.createMention(id, name), " ", replyText])
      ]);

      // Create the reply note.
      await outbox.createObject(pg, {
        type: "Note",
        published: new Date().toISOString(),
        attributedTo: actorUrl,
        inReplyTo: object.id,
        to: [object.actor.id],
        content: replyContent,
        tag: [{ type: "Mention", href: object.actor.id }]
      });
    });
  };

  return { handleRequest, handleRemove };
};
