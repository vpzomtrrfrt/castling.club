#!/usr/bin/env node

// Calls the draw code and writes `test.png`.

const fs = require("fs");

const draw = require("../src/front/draw");

const main = async () => {
  // Create stubs.
  const app = {};
  app.router = {
    get: () => {}
  };
  app.draw = await draw(app);

  // Render.
  const buf = await app.draw.draw("rnbqkbnrpppppppp8888PPPPPPPPRNBQKBNRw");
  fs.writeFileSync("test.png", buf);
};

main();
