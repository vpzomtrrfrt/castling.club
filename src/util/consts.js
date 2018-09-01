const path = require("path");

const { words } = require("./misc");

const ASSETS_BASE = path.join(__dirname, "../../assets");

// Various JSON-LD contexts used.
const SECURITY_CONTEXT = "https://w3id.org/security/v1";
const ACTIVITY_STREAMS_CONTEXT = "https://www.w3.org/ns/activitystreams";
const CHESS_CONTEXT = "https://castling.club/ns/chess/v0";

// Various MIME types used.
const JSON_MIME = "application/json";
const JSON_LD_MIME = "application/ld+json";
const ACTIVITY_STREAMS_MIME = `${JSON_LD_MIME}; profile="${ACTIVITY_STREAMS_CONTEXT}"`;
const LEGACY_ACTIVITY_STREAMS_MIME = "application/activity+json";
const CHESS_MIME = `${JSON_LD_MIME}; profile="${CHESS_CONTEXT}"`;
const PGN_MIME = "application/vnd.chess-pgn";

// The `Accept` header value we send out when requesting JSON-LD.
const JSON_ACCEPTS = [
  ACTIVITY_STREAMS_MIME,
  LEGACY_ACTIVITY_STREAMS_MIME,
  JSON_LD_MIME,
  JSON_MIME
].join(",");

// Koa `accepts` parameter, listing all types we respond to with JSON.
const KOA_JSON_ACCEPTS = [
  "json",
  JSON_LD_MIME,
  ACTIVITY_STREAMS_MIME,
  LEGACY_ACTIVITY_STREAMS_MIME,
  CHESS_MIME
];

// For signed requests we receive, the leeway allowed in the `Date` header.
const SIGNATURE_LEEWAY = 30 * 1000;

// Default cache duration for static resources.
const DEFAULT_CACHE_SEC = 14 * 24 * 60 * 60;
// Short cache duration, used for resources describing games in progress.
const SHORT_CACHE_SEC = 5 * 60;
// Tiny cache duration, used for the front page.
const TINY_CACHE_SEC = 30;

// Badges used to tag related notes for each game.
const UNICODE_BADGES = words(`
  🐝 🐍 🐴 🦇 🐳 🐙 🐷 🐛 🍄 🐠 🦀 🐊 🦒 🐇 ☘ ️🍁 🌷 🌻 🌍 🌈 🌪 🔥 ☄ ️☂ ️⛅ ️🕷
  🌵 🌴 🌳 🦋 🦄 🐚 🐌 🐜 🐼 🐸 🐵 🐭 🍏 🥥 🍉 🌶 🍔 🍕 🍌 🍒 🍭 🍩 ⚽ ️🏀 🏈 🎱
`);

// Map of chess pieces to their unicode characters.
const UNICODE_PIECES = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚"
};

// Generic confirmations, which should be followed by a description.
const CONFIRMATIONS = [
  "OK!",
  "Splendid!",
  "Perfect!",
  "Awesome!",
  "Great!",
  "Marvelous!",
  "Dope!",
  "Whicked!",
  "Cool!",
  "Superb!",
  "Nice!"
];

module.exports = {
  ASSETS_BASE,
  SECURITY_CONTEXT,
  ACTIVITY_STREAMS_CONTEXT,
  CHESS_CONTEXT,
  JSON_MIME,
  JSON_LD_MIME,
  ACTIVITY_STREAMS_MIME,
  LEGACY_ACTIVITY_STREAMS_MIME,
  CHESS_MIME,
  PGN_MIME,
  JSON_ACCEPTS,
  KOA_JSON_ACCEPTS,
  SIGNATURE_LEEWAY,
  DEFAULT_CACHE_SEC,
  SHORT_CACHE_SEC,
  TINY_CACHE_SEC,
  UNICODE_BADGES,
  UNICODE_PIECES,
  CONFIRMATIONS
};
