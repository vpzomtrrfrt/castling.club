const { RDF } = require("./consts");
const { identity } = require("./misc");

// A simple RDF triple store.
//
// This store is built for simple queries against subject only ('What color is
// X?'), and not against object ('What things are blue?') or predicate ('What
// things have color?').
//
// The API deals in instances of `@rdfjs/data-model` classes only.
class DataStore {
  constructor() {
    // An RDF dataset as: `{ subjectName: { predicateName: [objectTerm] } }`
    //
    // Notably, the subject and predicate are just string keys, but the object
    // is an RDF Term object produced by the jsonld library, which follows the
    // model specified at: http://rdf.js.org/data-model-spec/
    this.spo = Object.create(null);
  }

  // Get the internal `{ predicateName: [objectTerm] }` structure for a subject.
  _getSubject(subjectName) {
    return this.spo[subjectName];
  }

  // Get the list of objects for a subject and predicate.
  _getObjects(subjectName, predicateName) {
    const po = this._getSubject(subjectName);
    return po ? po[predicateName] : undefined;
  }

  // Check whether a quad already exists in the store.
  has(quad) {
    const o = this._getObjects(quad.subject.value, quad.predicate.value);
    if (!o) {
      return false;
    }

    for (const objectTerm of o) {
      if (objectTerm.equals(quad.object)) {
        return true;
      }
    }

    return false;
  }

  // Add a RDF Quad to the store.
  add(quad) {
    if (this.has(quad)) {
      return;
    }

    const { spo } = this;
    const subjectName = quad.subject.value;
    const predicateName = quad.predicate.value;

    const po = spo[subjectName] || (spo[subjectName] = Object.create(null));
    const o = po[predicateName] || (po[predicateName] = []);
    o.push(quad.object);
  }

  // Find statements by subject and predicate, then parse the object(s).
  //
  // The parser function is usually one of the other exports of this module. If
  // omitted, the default is to return a list of object terms.
  //
  // Example: `store.get(actorId, RDF('type'), node) === AS('Person')`
  get(subjectName, predicateName, parser = identity) {
    const o = this._getObjects(subjectName, predicateName) || [];
    return parser(o);
  }

  // Convenience function for operating on a single subject.
  //
  // The return value of the block is passed through as the return value of this
  // method. The block takes as its only parameter the `get` method of this
  // store bound to the given subject.
  //
  // Example: `store.with(actorId, get => ({ type: get(RDF('type'), node) }))`
  with(subjectName, block) {
    return block(this.get.bind(this, subjectName));
  }
}

// Parse terms to a list of nodes.
const nodes = terms =>
  terms
    .filter(
      term => term.termType === "NamedNode" || term.termType === "BlankNode"
    )
    .map(term => term.value);

// Parse terms to a single node.
const node = terms => nodes(terms)[0];

// Parse terms to a string.
//
// The `languages` option is an array of languages to look for. It should
// usually end with the empty string, which acts as a wildcard.
const text = (...languages) => terms => {
  const literals = terms.filter(term => term.termType === "Literal");

  const strings = literals.filter(
    term => term.datatype.value === RDF("string")
  );
  const langStrings = literals.filter(
    term => term.datatype.value === RDF("langString")
  );

  for (const language of languages) {
    const result = language
      ? langStrings.find(term => term.language === language)
      : strings[0] || langStrings[0];
    if (result) {
      return result.value;
    }
  }
};

// Short-hands for common text matchers.
const anyText = text("");
const englishText = text("en", "");

module.exports = { DataStore, nodes, node, text, anyText, englishText };
