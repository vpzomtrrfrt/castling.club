const postgres = require("pg");

const cache = require("./cache");
const jsonld = require("./jsonld");
const signing = require("./signing");

module.exports = async ({
  env,
  scheme,
  domain,
  publicKeyPem,
  privateKeyPem,
  hmacSecret
}) => {
  // Derived settings.
  const origin = `${scheme}://${domain}`;
  const actorUrl = `${origin}/@king`;
  const publicKeyUrl = `${actorUrl}#public-key`;

  // Main application object.
  const app = {
    env,
    scheme,
    domain,
    publicKeyPem,
    privateKeyPem,
    hmacSecret,
    origin,
    actorUrl,
    publicKeyUrl
  };

  // Instances of external dependencies.
  app.pg = new postgres.Pool();

  // Parts of the app. These interconnect, so order is important.
  // (Basically poor-man's dependency injection.)
  app.cache = await cache(app);
  app.jsonld = await jsonld(app);
  app.signing = await signing(app);

  return app;
};
