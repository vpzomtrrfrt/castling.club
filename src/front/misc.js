const model = require("../util/model");
const { JSON_LD_MIME, TINY_CACHE_SEC } = require("../util/consts");
const { readAsset, renderTemplate } = require("../util/fs");

module.exports = async ({
  adminUrl,
  adminEmail,
  domain,
  origin,
  pg,
  router
}) => {
  const chessNs = JSON.parse(await readAsset("ns/chess_v0.json", "utf8"));
  const stylesheet = await readAsset("css/main.css");

  // Serve the index page.
  router.get("/", async ctx => {
    const { rows: challengeBoard } = await model.getChallengeBoard(pg);
    const { rows: recentGames } = await model.getRecentGames(pg);

    // Format full names for each entry, as you'd use in a mention.
    for (const entry of challengeBoard) {
      const match = /^https?:\/\/([^/]+)\//.exec(entry.actorId);
      entry.actorFullName = match ? `${entry.actorName}@${match[1]}` : null;
    }

    ctx.set("Cache-Control", `public, max-age=${TINY_CACHE_SEC}`);
    ctx.body = await renderTemplate("index", {
      domain,
      challengeBoard,
      recentGames
    });
    ctx.type = "html";
  });

  // Serve the stylesheet for HTML responses.
  router.get("/main.css", async ctx => {
    ctx.body = stylesheet;
    ctx.type = "css";
  });

  // Serve the chess vocabulary for JSON-LD.
  router.get("/ns/chess/v0", async ctx => {
    ctx.body = chessNs;
    ctx.type = JSON_LD_MIME;
  });

  // Serve nodeinfo webfinger.
  router.get("/.well-known/nodeinfo", ctx => {
    ctx.body = {
      links: [
        {
          rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
          href: `${origin}/nodeinfo`
        }
      ]
    };
  });

  // Serve nodeinfo.
  router.get("/nodeinfo", ctx => {
    ctx.body = {
      version: "2.0",
      software: {
        name: domain,
        version: "n/a"
      },
      protocols: ["activitypub"],
      services: {
        inbound: [],
        outbound: []
      },
      openRegistrations: false,
      usage: {
        users: {}
      },
      metadata: {
        description:
          "A custom server in the fediverse that hosts games of chess." +
          ` See ${origin}/ for how to play!`,
        admin: adminUrl,
        email: adminEmail
      }
    };
    ctx.type =
      "application/json; profile=http://nodeinfo.diaspora.software/ns/schema/2.0#";
  });
};
