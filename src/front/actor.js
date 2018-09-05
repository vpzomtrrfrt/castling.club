const {
  ACTIVITY_STREAMS_CONTEXT,
  ACTIVITY_STREAMS_MIME,
  KOA_JSON_ACCEPTS,
  SECURITY_CONTEXT
} = require("../util/consts");
const { readAsset } = require("../util/fs");

module.exports = async ({
  actorUrl,
  domain,
  origin,
  publicKeyPem,
  publicKeyUrl,
  router
}) => {
  const kingIcon = await readAsset("img/bk.png");
  const accountUrl = `acct:king@${domain}`;

  // Allow some invalid Webfinger queries.
  // @todo: Appears to be old Mastodon?
  const validQueries = new Set([
    "king",
    `king@${domain}`,
    "acct:king",
    accountUrl
  ]);

  // Handle Webfinger requests.
  router.get("/.well-known/webfinger", ctx => {
    if (validQueries.has(ctx.query.resource)) {
      ctx.body = {
        subject: accountUrl,
        links: [
          {
            rel: "self",
            type: ACTIVITY_STREAMS_MIME,
            href: actorUrl
          }
        ]
      };
      ctx.type = "application/jrd+json";
    } else {
      ctx.status = 404;
    }
  });

  // Our actor document (including public key).
  // @todo: Support non-RSA keys.
  router.get("/@king", ctx => {
    const actor = {
      "@context": [ACTIVITY_STREAMS_CONTEXT, SECURITY_CONTEXT],
      id: actorUrl,
      type: "Service",
      name: "King",
      summary: `<p>I'm a bot, hosting games of chess!</p>`,
      preferredUsername: "king",
      inbox: `${origin}/inbox`,
      icon: {
        type: "Image",
        mediaType: "image/png",
        url: `${actorUrl}/icon`
      },
      attachment: [
        {
          type: "PropertyValue",
          name: "Website",
          value: `<a href="${origin}/">${domain}</a>`
        }
      ],
      publicKey: {
        id: publicKeyUrl,
        owner: actorUrl,
        publicKeyPem
      }
    };

    ctx.response.vary("accept");
    if (ctx.accepts("html")) {
      ctx.redirect("/");
    } else if (ctx.accepts(KOA_JSON_ACCEPTS)) {
      ctx.body = actor;
      ctx.type = ACTIVITY_STREAMS_MIME;
    } else {
      ctx.status = 406;
    }
  });

  // Our actor icon. Doubles as our favicon.
  router.get("/@king/icon", ctx => {
    ctx.body = kingIcon;
    ctx.type = "png";
  });
};
