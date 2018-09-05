const net = require("net");

// https://en.wikipedia.org/wiki/Top-level_domain#Reserved_domains
const INVALID_TLDS = new Set([
  // RFC 3172
  "arpa",
  // RFC 6761
  "example",
  "invalid",
  "localhost",
  "test",
  "localdomain", // additional
  // RFC 6762
  "local",
  // RFC 7686
  "onion"
]);

// https://url.spec.whatwg.org/#forbidden-host-code-point
const INVALID_HOST_CHARS = new Set("\0\t\n\r #%/:?@[\\]");

// Coerce a value into an array.
exports.ensureArray = value =>
  value == null ? [] : Array.isArray(value) ? value : [value];

// Extract words from a string.
exports.words = s => s.trim().split(/\s+/g);

// Pick a random element from the array.
exports.sample = arr => arr[Math.floor(Math.random() * arr.length)];

// Sort an array by a predicate, which should return a numeric value.
exports.sortBy = (arr, pred) => {
  const values = arr.map(pred);
  return arr
    .map((value, idx) => idx)
    .sort((a, b) => values[a] - values[b])
    .map(idx => arr[idx]);
};

// Detach an async function. The wrapped function returns a promise for
// nothing, which also never fails. Errors will be logged.
exports.detach = fn => async (...args) => {
  return fn(...args).then(exports.noop, err => {
    console.error(err);
  });
};

// Checks that a URL that is supposed to be some resource on the public
// internet doesn't point to known invalid hosts. We also require HTTPS.
exports.checkPublicUrl = url => {
  // Filter non-HTTPS URLs.
  if (url.slice(0, 8) !== "https://") {
    return false;
  }

  // We want a valid domain, not an IP address. The invalid character list
  // also prevents IPv6 addresses and ports.
  const [host] = url.slice(8).split("/");
  if (
    !host ||
    !host.includes(".") ||
    net.isIPv4(host) ||
    Array.from(host).find(c => INVALID_HOST_CHARS.has(c))
  ) {
    return false;
  }

  // Filter reserved TLDs.
  if (INVALID_TLDS.has(host.split(".").pop())) {
    return false;
  }

  return true;
};
