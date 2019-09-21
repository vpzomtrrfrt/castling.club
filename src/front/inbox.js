const createDebug = require("debug");
const coBody = require("co-body");
const EventEmitter = require("events");

const html = require("../util/html");
const model = require("../util/model");
const { AS } = require("../util/consts");
const { originOf } = require("../util/misc");
const {
  getActivity,
  getActor,
  getObject,
  getTag
} = require("../util/rdfModel");

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

    // Load the activity document.
    const store = jsonld.createStore();
    try {
      await store.load(parsed);
    } catch (err) {
      ctx.throw(400, `Activity document could not be loaded: ${err.message}`);
    }

    const activity = getActivity(store, parsed.id);
    if (!activity.type || !activity.actor) {
      ctx.throw(400, "Incomplete activity object");
    }

    // Verify the actor signature.
    const publicKey = await signing.verify(ctx, raw, store);
    if (publicKey.owner !== activity.actor) {
      ctx.throw(400, "Signature does not match actor");
    }

    // Verify the activity is from the actor's origin.
    if (originOf(activity.actor) !== origin) {
      ctx.throw(400, "Activity and actor origins don't match");
    }

    // Load the actor document.
    try {
      await store.load(activity.actor);
    } catch (err) {
      ctx.throw(400, `Actor document could not be loaded: ${err.message}`);
    }

    const actor = getActor(store, activity.actor);

    // Deduplicate based on activity ID.
    const now = new Date();
    const { rowCount } = await model.tryInsertInboxObject(pg, activity.id, now);
    if (rowCount === 0) {
      debug(`Ignoring duplicate activity: ${activity.id}`);
      ctx.status = 202;
      ctx.body = null;
      return;
    }

    // We currently handle just 'Create'.
    if (activity.type === AS("Create")) {
      // The object MUST be inlined in the raw JSON, according to spec.
      // This also means it was already loaded into the store.
      if (typeof parsed.object !== "object") {
        ctx.throw(400, "Invalid object in 'Create' activity");
      }

      const object = getObject(store, activity.object);
      if (object.type === AS("Note")) {
        if (object.attributedTo !== activity.actor) {
          ctx.throw(400, "Activity creates note not attributed to the actor");
        }

        // Amend object with convenience props.
        object.actor = actor;
        object.contentText = html.extractText(object.content);
        object.mentions = new Set();
        for (const tagId of object.tags) {
          // Assume these are also inlined in the JSON, and thus loaded.
          // If they're not, they'll simply not pass the type check.
          const tag = getTag(store, tagId);
          if (tag.type === AS("Mention")) {
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
