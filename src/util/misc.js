const net = require("net");

const INVALID_TLDS = new Set([
  "test",
  "local",
  "localhost",
  "localdomain",
  "example",
  "invalid",
  "arpa",
  "onion"
]);

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
  if (url.slice(0, 8) !== "https://") {
    return false;
  }

  const [host] = url.slice(8).split("/");
  if (
    !host ||
    !host.includes(".") ||
    net.isIPv4(host) ||
    Array.from(host).find(c => INVALID_HOST_CHARS.has(c))
  ) {
    return false;
  }

  if (INVALID_TLDS.has(host.split(".").pop())) {
    return false;
  }

  return true;
};
