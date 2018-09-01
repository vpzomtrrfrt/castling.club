const createDebug = require("debug");

const debug = createDebug("chess:dispatch");
const { detach } = require("../util/misc");

const MENTION_REGEXP = /^\s*@king(?:@\S+)?\s+(.+?)\s*$/i;

module.exports = async ({ actorUrl, inbox, game, challengeBoard }) => {
  // Handle new notes, and check if they're a challenge or move.
  const onNoteCreated = detach(async object => {
    // Try handle as a game reply.
    if (object.inReplyTo) {
      if (await game.handleReply(object)) {
        return;
      }
    }

    if (!object.mentions.has(actorUrl)) {
      debug("Object does not mention us");
      return;
    }

    // Look for the line containing our mention.
    let match;
    object.contentText.split(/\n/g).some(line => {
      return (match = MENTION_REGEXP.exec(line));
    });
    if (!match) {
      debug("Object contains only off-hand mention");
      return;
    }
    const instr = match[1];

    if (
      /\bnot\Wopen\Wfor\W(a\W)?challenges?\b/i.test(instr) ||
      /\bno\Wlonger\Wopen\Wfor\W(a\W)?challenges?\b/i.test(instr) ||
      /\bremove\W(me\W)?from\W(the\W)?challenges?(\W?board)?\b/i.test(instr)
    ) {
      debug("Received request to remove from challenge board");
      return challengeBoard.handleRemove(object);
    }

    if (
      /\bopen\Wfor\W(a\W)?challenges?\b/i.test(instr) ||
      /\brequest\W(a\W)?challenges?\b/i.test(instr) ||
      /\badd\W(me\W)?to\W(the\W)?challenges?(\W?board)?\b/i.test(instr)
    ) {
      debug("Received request to add to challenge board");
      return challengeBoard.handleRequest(object);
    }

    if (/\bchallenge\b/i.test(object.contentText)) {
      debug("Received challenge");
      return game.handleChallenge(object);
    }

    debug("No match for instruction");
  });

  inbox.on("noteCreated", onNoteCreated);
};
