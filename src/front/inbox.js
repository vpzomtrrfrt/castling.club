const createDebug = require("debug");
const coBody = require("co-body");
const EventEmitter = require("events");

const html = require("../util/html");
const model = require("../util/model");
const { ACTIVITY_STREAMS_CONTEXT } = require("../util/consts");
const { ensureArray } = require("../util/misc");

const debug = createDebug("chess");

module.exports = ({ jsonld, pg, router, signing }) => {
  const inbox = new EventEmitter();

  // Remote server submits to our inbox.
  router.post("/inbox", async ctx => {
    const { raw, parsed } = await coBody.json(ctx.req, { returnRawBody: true });

    // Sanity check.
    if (!parsed || !parsed.id) {
      ctx.throw(400, "Invalid request body");
    }

    // Deduplicate.
    const now = new Date();
    const { rowCount } = await model.tryInsertInboxObject(pg, parsed.id, now);
    if (rowCount === 0) {
      debug(`Ignoring duplicate activity: ${parsed.id}`);
      ctx.status = 202;
      ctx.body = null;
      return;
    }

    // Resolve the activity object.
    const resolver = jsonld.createResolver();
    const activity = await resolver.resolve(parsed, ACTIVITY_STREAMS_CONTEXT);
    if (!activity.type || !activity.actor) {
      ctx.throw(400, "Incomplete activity object");
    }

    // Verify the signature.
    const publicKey = await signing.verify(ctx, raw, resolver);
    if (publicKey.owner !== activity.actor) {
      ctx.throw(400, "Signature does not match actor");
    }

    // We currently handle just 'Create'.
    if (activity.type === "Create") {
      const objectId = activity.object;
      if (!objectId) {
        ctx.throw(400, "Missing object in 'create' activity");
      }

      const object = await resolver.resolve(objectId, ACTIVITY_STREAMS_CONTEXT);
      if (object.type === "Note") {
        if (object.attributedTo !== activity.actor) {
          ctx.throw(400, "Activity creates note not attributed to the actor");
        }

        // Resolve the actor.
        object.actor = await resolver.resolve(
          activity.actor,
          ACTIVITY_STREAMS_CONTEXT
        );

        // Extract plain text.
        object.contentText = html.extractText(object.content);

        // Extract mentions.
        object.mentions = new Set();
        for (const tagId of ensureArray(object.tag)) {
          const tag = await resolver.resolve(tagId, ACTIVITY_STREAMS_CONTEXT);
          if (tag.type === "Mention") {
            object.mentions.add(tag.href);
          }
        }

        // Dispatch.
        debug(`<< ${object.actor.id} - ${object.contentText}`);
        inbox.emit("noteCreated", object);
      }
    }

    ctx.status = 202;
    ctx.body = null;
  });

  return inbox;
};
