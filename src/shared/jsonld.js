const createDebug = require("debug");
const got = require("got");
const jsonldFactory = require("jsonld");

const { JSON_ACCEPTS } = require("../util/consts");
const { checkPublicUrl } = require("../util/misc");

const debug = createDebug("chess:jsonld");

// Whether the object (from a flat document) is a reference.
const isSubjectReference = node =>
  node && node["@id"] && Object.keys(node).length === 1;

// Helper class used to resolve JSON-LD documents.
class Resolver {
  constructor(jsonld) {
    // A jsonld instance, typically with a caching loader.
    this.jsonld = jsonld;
    // Loaded nodes in flattened form.
    this.graph = Object.create(null);
    // Options used for all jsonld calls.
    this.options = {
      // Share the ID issuer, so we don't create conflicts between calls.
      issuer: new jsonld.IdentifierIssuer("_:b")
    };
  }

  // Find a node, and compact according to the context.
  // Input may be JSON-LD input or an ID.
  // Output is always a single node, without embedding.
  async resolve(input, context) {
    // Try to resolve from already loaded nodes.
    if (typeof input === "string") {
      const node = this.graph[input];
      if (node) {
        return this.jsonld.compact(node, context, this.options);
      }
    }

    // Fetch the document if necessary, and get the expanded form.
    const expanded = await this.jsonld.expand(input, this.options);
    if (expanded.length === 0) {
      throw Error("JSON-LD resolved to empty result");
    }

    // Determine what to return. If input was an ID, return that node.
    // Otherwise, make sure we return the same toplevel node.
    const id = typeof input === "string" ? input : expanded[0]["@id"];

    // Flatten the document and load each node into the graph.
    // Like `jsonld.flatten`, but saves us a bit of processing.
    const nodeMap = await this.jsonld.createNodeMap(expanded, this.options);
    for (const nodeId in nodeMap) {
      const node = nodeMap[nodeId];
      if (!isSubjectReference(node)) {
        const id = node["@id"];
        this.graph[id] = node;
        debug(`LOAD: ${id}`);
      }
    }

    // The requested node must be in the graph now.
    const node = this.graph[id];
    if (node) {
      return this.jsonld.compact(node, context, this.options);
    } else {
      throw Error(`JSON-LD resolve failed for ID: ${id}`);
    }
  }
}

module.exports = ({ cache, env, origin }) => {
  const jsonld = jsonldFactory();

  // Setup JSON-LD to use 'got' with caching.
  jsonld.documentLoader = async url => {
    if (env === "production" && !checkPublicUrl(url)) {
      return null;
    }

    debug(`REQ: ${url}`);
    const response = await got(url, {
      cache: cache.http,
      json: true,
      headers: {
        "user-agent": `${origin}/`,
        accept: JSON_ACCEPTS
      }
    });
    return { document: response.body };
  };

  const createResolver = () => new Resolver(jsonld);

  return { createResolver };
};
