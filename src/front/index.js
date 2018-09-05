const Koa = require("koa");
const Router = require("koa-router");

const actor = require("./actor");
const createApp = require("../shared/createApp");
const challengeBoard = require("./challengeBoard");
const dispatch = require("./dispatch");
const draw = require("./draw");
const game = require("./game");
const inbox = require("./inbox");
const misc = require("./misc");
const outbox = require("./outbox");

const { DEFAULT_CACHE_SEC } = require("../util/consts");

module.exports = async config => {
  const app = await createApp(config);

  // Instances of external dependencies.
  app.koa = new Koa();
  app.router = new Router();

  // Parts of the app. These interconnect, so order is important.
  // (Basically poor-man's dependency injection.)
  app.misc = await misc(app);
  app.actor = await actor(app);
  app.inbox = await inbox(app);
  app.outbox = await outbox(app);
  app.draw = await draw(app);
  app.game = await game(app);
  app.challengeBoard = await challengeBoard(app);
  app.dispatch = await dispatch(app);

  // All of our resources are default public and cacheable.
  app.koa.use(async (ctx, next) => {
    if (ctx.method === "GET") {
      ctx.set("Cache-Control", `public, max-age=${DEFAULT_CACHE_SEC}`);
    }
    return next();
  });

  // Setup request handling.
  app.koa.use(app.router.routes()).use(app.router.allowedMethods());
  app.koa.on("error", err => {
    if (typeof err.status !== "number" || err.status > 499) {
      console.error(err);
    }
  });

  // Expose Koa listen function on the app.
  app.listen = (...args) => app.koa.listen(...args);

  return app;
};
