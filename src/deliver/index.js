const createApp = require("../shared/createApp");
const deliver = require("./deliver");

module.exports = async config => {
  const app = await createApp(config);

  // Parts of the app. These interconnect, so order is important.
  // (Basically poor-man's dependency injection.)
  app.deliver = await deliver(app);

  return app;
};
