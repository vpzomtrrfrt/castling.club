const ejs = require("ejs");
const fs = require("fs");
const path = require("path");
const util = require("util");

const { ASSETS_BASE } = require("./consts");

// Promise version of `fs.readFile`.
exports.readFile = util.promisify(fs.readFile);

// Wrap `readFile` to read from the asset directory.
exports.readAsset = async (file, ...args) =>
  exports.readFile(path.resolve(ASSETS_BASE, file), ...args);

// Render a template.
exports.renderTemplate = async (name, data, options) =>
  new Promise((resolve, reject) => {
    const tmplPath = path.resolve(ASSETS_BASE, "tmpl", `${name}.html.ejs`);
    ejs.renderFile(tmplPath, data, options, (err, res) => {
      err ? reject(err) : resolve(res);
    });
  });
