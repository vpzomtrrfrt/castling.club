// Functions that extract objects from the RDF store in our expected format.

const { RDF, LDP, AS, SEC } = require("./consts");
const { nodes, node, anyText, englishText } = require("./rdf");

// Get an Actor from an RDF store.
exports.getActor = (store, id) =>
  store.with(id, get => ({
    id,
    type: get(RDF("type"), node),
    preferredUsername: get(AS("preferredUsername"), englishText),
    inbox: get(LDP("inbox"), node),
    endpoints: get(AS("endpoints"), node)
  }));

// Get Endpoints from an RDF store.
exports.getEndpoints = (store, id) =>
  store.with(id, get => ({
    id,
    sharedInbox: get(AS("sharedInbox"), node)
  }));

// Get an Activity from an RDF store.
exports.getActivity = (store, id) =>
  store.with(id, get => ({
    id,
    type: get(RDF("type"), node),
    actor: get(AS("actor"), node),
    object: get(AS("object"), node)
  }));

// Get an Object from an RDF store.
exports.getObject = (store, id) =>
  store.with(id, get => ({
    id,
    type: get(RDF("type"), node),
    attributedTo: get(AS("attributedTo"), node),
    inReplyTo: get(AS("inReplyTo"), node),
    content: get(AS("content"), englishText),
    tags: get(AS("tag"), nodes)
  }));

// Get a Tag from an RDF store.
exports.getTag = (store, id) =>
  store.with(id, get => ({
    id,
    type: get(RDF("type"), node),
    href: get(AS("href"), node)
  }));

// Get a Public Key from an RDF store.
exports.getPublicKey = (store, id) =>
  store.with(id, get => ({
    id,
    owner: get(SEC("owner"), node),
    publicKeyPem: get(SEC("publicKeyPem"), anyText)
  }));
