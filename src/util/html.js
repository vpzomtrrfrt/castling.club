const parse5 = require("parse5");

const { ensureArray } = require("./misc");

// Reduce nodes to their text content.
const extractTextFromNode = node =>
  node.nodeName === "#text"
    ? node.value
    : node.childNodes.reduce(
        (memo, node) => memo + extractTextFromNode(node),
        ""
      ) + (node.nodeName === "p" ? "\n" : "");

// Reduce HTML to its text content.
exports.extractText = html =>
  extractTextFromNode(parse5.parseFragment(html)).replace(
    // eslint-disable-next-line no-control-regex
    /[\x00-\x09\x0b-\x1f\x7f]/g,
    ""
  );

// Coerce strings into text nodes.
const toNode = value =>
  value
    ? typeof value === "string"
      ? { nodeName: "#text", value }
      : value
    : undefined;

// Create an element node.
const h = (exports.createElement = (name, attrMap = {}, childNodes = []) => {
  if (Array.isArray(attrMap)) {
    childNodes = attrMap;
    attrMap = {};
  }

  return {
    nodeName: name,
    tagName: name,
    attrs: Object.entries(attrMap).map(([name, value]) => ({
      name,
      value: typeof value === "string" ? value : ""
    })),
    childNodes: childNodes.map(toNode).filter(x => x)
  };
});

// Create an inline element for a mention. Uses the name,
// prefixed with `@`, wrapped in a microformats2 h-card.
exports.createMention = (id, name) =>
  h("span", { class: "h-card" }, [
    h("a", { class: "u-url mention", href: id }, [
      "@",
      h("span", { class: "p-nickname" }, [`${name || "???"}`])
    ])
  ]);

// Render nodes to HTML.
exports.render = nodes => {
  return parse5.serialize({
    nodeName: "#document-fragment",
    childNodes: ensureArray(nodes).map(toNode)
  });
};
