const createDebug = require("debug");
const got = require("got");
const jsonldFactory = require("jsonld");
const rdf = require("@rdfjs/data-model");

const { DataStore } = require("../util/rdf");
const { JSON_ACCEPTS } = require("../util/consts");
const { checkPublicUrl } = require("../util/misc");

const debug = createDebug("chess:jsonld");

// The JSON-LD library produces plain object RDF terms, instead of actual model
// instances. This function does the conversion. Borrowed from
// `@rdfjs/parser-jsonld`, also MIT.
const fromPlainTerm = plainTerm => {
  switch (plainTerm.termType) {
    case "NamedNode":
      return rdf.namedNode(plainTerm.value);
    case "BlankNode":
      return rdf.blankNode(plainTerm.value.substr(2));
    case "Literal":
      return rdf.literal(
        plainTerm.value,
        plainTerm.language || rdf.namedNode(plainTerm.datatype.value)
      );
    case "DefaultGraph":
      return rdf.defaultGraph();
    default:
      throw Error("unknown termType: " + plainTerm.termType);
  }
};

// Convert a plan object RDF quad to a model instance.
const fromPlainQuad = plainQuad =>
  rdf.quad(
    fromPlainTerm(plainQuad.subject),
    fromPlainTerm(plainQuad.predicate),
    fromPlainTerm(plainQuad.object),
    fromPlainTerm(plainQuad.graph)
  );

// Holds a graph of data extracted from JSON-LD documents.
class JsonLdDataStore extends DataStore {
  constructor(jsonld) {
    super();

    // A jsonld instance, typically setup with a caching loader.
    this.jsonld = jsonld;
    // Options used for all jsonld calls.
    this.options = {
      // Share the ID issuer, so we don't create conflicts between calls.
      issuer: new jsonld.IdentifierIssuer("_:b")
    };
  }

  // Load a document into the graph. Input may be JSON-LD or a URL.
  async load(input) {
    // Check if it already exists.
    if (typeof input === "string" && this.spo[input]) {
      return;
    }

    // Fetch the document if necessary, and get the RDF quads.
    const quads = await this.jsonld.toRDF(input, this.options);

    // Insert the quads into the dataset.
    for (const quad of quads) {
      this.add(fromPlainQuad(quad));
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

  const createStore = () => new JsonLdDataStore(jsonld);

  return { createStore };
};
