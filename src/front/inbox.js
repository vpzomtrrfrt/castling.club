const createDebug = require("debug");
const coBody = require("co-body");
const EventEmitter = require("events");

const html = require("../util/html");
const model = require("../util/model");
const { ACTIVITY_STREAMS_CONTEXT } = require("../util/consts");
const { ensureArray, originOf } = require("../util/misc");

const debug = createDebug("chess");

module.exports = ({ jsonld, pg, router, signing }) => {
  const inbox = new EventEmitter();

  // Remote server submits to our inbox.
  router.post("/inbox", async ctx => {
    const { raw, parsed } = await coBody.json(ctx.req, { returnRawBody: true });

    // Sanity check.
    if (!parsed || typeof parsed.id !== "string") {
      ctx.throw(400, "Invalid request body");
    }

    // Extract the origin.
    const origin = originOf(parsed.id);
    if (!origin) {
      ctx.throw(400, "Invalid activity ID, not a URL");
    }

    // Resolve the activity document.
    const resolver = jsonld.createResolver();
    const activity = await resolver.resolve(parsed, ACTIVITY_STREAMS_CONTEXT);
    if (!activity.type || !activity.actor) {
      ctx.throw(400, "Incomplete activity object");
    }

    // Verify the actor signature.
    const publicKey = await signing.verify(ctx, raw, resolver);
    if (publicKey.owner !== activity.actor) {
      ctx.throw(400, "Signature does not match actor");
    }

    // Verify the activity is from the actor's origin.
    if (originOf(activity.actor) !== origin) {
      ctx.throw(400, "Activity and actor origins don't match");
    }

    // Resolve the actor document.
    let actor;
    try {
      actor = await resolver.resolve(activity.actor, ACTIVITY_STREAMS_CONTEXT);
    } catch (err) {
      ctx.throw(400, `Actor could not be resolved: ${err.message}`);
    }

    // Deduplicate based on activity ID.
    const now = new Date();
    const { rowCount } = await model.tryInsertInboxObject(pg, parsed.id, now);
    if (rowCount === 0) {
      debug(`Ignoring duplicate activity: ${parsed.id}`);
      ctx.status = 202;
      ctx.body = null;
      return;
    }

    // We currently handle just 'Create'.
    if (activity.type === "Create") {
      // The object MUST be included, according to spec.
      if (typeof parsed.object !== "object") {
        ctx.throw(400, "Missing object in 'Create' activity");
      }

      // This should never fail, because the object is included.
      const object = await resolver.resolve(
        activity.object,
        ACTIVITY_STREAMS_CONTEXT
      );
      if (object.type === "Note") {
        if (object.attributedTo !== activity.actor) {
          ctx.throw(400, "Activity creates note not attributed to the actor");
        }

        // Amend object with convenience props.
        object.actor = actor;
        object.contentText = html.extractText(object.content);
        object.mentions = new Set();
        for (const tagId of ensureArray(object.tag)) {
          let tag;
          try {
            tag = await resolver.resolve(tagId, ACTIVITY_STREAMS_CONTEXT);
          } catch (err) {
            ctx.throw(400, "Invalid object tags");
          }
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
