// Heavily modified version of chess.js v0.10.2.
// See LICENSE.md for the original license.

const { words } = require("./misc");

const BLACK = "b";
const WHITE = "w";

const EMPTY = -1;

const PAWN = "p";
const KNIGHT = "n";
const BISHOP = "b";
const ROOK = "r";
const QUEEN = "q";
const KING = "k";

const DEFAULT_POSITION =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const PAWN_OFFSETS = {
  [BLACK]: [16, 32, 17, 15],
  [WHITE]: [-16, -32, -17, -15]
};

const PIECE_OFFSETS = {
  [KNIGHT]: [-18, -33, -31, -14, 18, 33, 31, 14],
  [BISHOP]: [-17, -15, 17, 15],
  [ROOK]: [-16, 1, 16, -1],
  [QUEEN]: [-17, -16, -15, 1, 17, 16, 15, -1],
  [KING]: [-17, -16, -15, 1, 17, 16, 15, -1]
};

const ATTACKS = words(`
  20  0  0  0  0  0  0 24  0  0  0  0  0  0 20  0
   0 20  0  0  0  0  0 24  0  0  0  0  0 20  0  0
   0  0 20  0  0  0  0 24  0  0  0  0 20  0  0  0
   0  0  0 20  0  0  0 24  0  0  0 20  0  0  0  0
   0  0  0  0 20  0  0 24  0  0 20  0  0  0  0  0
   0  0  0  0  0 20  2 24  2 20  0  0  0  0  0  0
   0  0  0  0  0  2 53 56 53  2  0  0  0  0  0  0
  24 24 24 24 24 24 56  0 56 24 24 24 24 24 24  0
   0  0  0  0  0  2 53 56 53  2  0  0  0  0  0  0
   0  0  0  0  0 20  2 24  2 20  0  0  0  0  0  0
   0  0  0  0 20  0  0 24  0  0 20  0  0  0  0  0
   0  0  0 20  0  0  0 24  0  0  0 20  0  0  0  0
   0  0 20  0  0  0  0 24  0  0  0  0 20  0  0  0
   0 20  0  0  0  0  0 24  0  0  0  0  0 20  0  0
  20  0  0  0  0  0  0 24  0  0  0  0  0  0 20
`).map(v => parseInt(v, 10));

const RAYS = words(`
   17   0   0   0   0   0   0  16   0   0   0   0   0   0  15  0
    0  17   0   0   0   0   0  16   0   0   0   0   0  15   0  0
    0   0  17   0   0   0   0  16   0   0   0   0  15   0   0  0
    0   0   0  17   0   0   0  16   0   0   0  15   0   0   0  0
    0   0   0   0  17   0   0  16   0   0  15   0   0   0   0  0
    0   0   0   0   0  17   0  16   0  15   0   0   0   0   0  0
    0   0   0   0   0   0  17  16  15   0   0   0   0   0   0  0
    1   1   1   1   1   1   1   0  -1  -1   -1 -1  -1  -1  -1  0
    0   0   0   0   0   0 -15 -16 -17   0   0   0   0   0   0  0
    0   0   0   0   0 -15   0 -16   0 -17   0   0   0   0   0  0
    0   0   0   0 -15   0   0 -16   0   0 -17   0   0   0   0  0
    0   0   0 -15   0   0   0 -16   0   0   0 -17   0   0   0  0
    0   0 -15   0   0   0   0 -16   0   0   0   0 -17   0   0  0
    0 -15   0   0   0   0   0 -16   0   0   0   0   0 -17   0  0
  -15   0   0   0   0   0   0 -16   0   0   0   0   0   0 -17
`).map(v => parseInt(v, 10));

const SHIFTS = {
  [PAWN]: 0,
  [KNIGHT]: 1,
  [BISHOP]: 2,
  [ROOK]: 3,
  [QUEEN]: 4,
  [KING]: 5
};

const FLAGS = {
  NORMAL: "n",
  CAPTURE: "c",
  BIG_PAWN: "b",
  EP_CAPTURE: "e",
  PROMOTION: "p",
  KSIDE_CASTLE: "k",
  QSIDE_CASTLE: "q"
};

const BITS = {
  NORMAL: 1,
  CAPTURE: 2,
  BIG_PAWN: 4,
  EP_CAPTURE: 8,
  PROMOTION: 16,
  KSIDE_CASTLE: 32,
  QSIDE_CASTLE: 64
};

const RANK_1 = 7;
const RANK_2 = 6;
// const RANK_3 = 5;
// const RANK_4 = 4;
// const RANK_5 = 3;
// const RANK_6 = 2;
const RANK_7 = 1;
const RANK_8 = 0;

const SQUARES = words(`
    0:a8   1:b8   2:c8   3:d8   4:e8   5:f8   6:g8   7:h8
   16:a7  17:b7  18:c7  19:d7  20:e7  21:f7  22:g7  23:h7
   32:a6  33:b6  34:c6  35:d6  36:e6  37:f6  38:g6  39:h6
   48:a5  49:b5  50:c5  51:d5  52:e5  53:f5  54:g5  55:h5
   64:a4  65:b4  66:c4  67:d4  68:e4  69:f4  70:g4  71:h4
   80:a3  81:b3  82:c3  83:d3  84:e3  85:f3  86:g3  87:h3
   96:a2  97:b2  98:c2  99:d2 100:e2 101:f2 102:g2 103:h2
  112:a1 113:b1 114:c1 115:d1 116:e1 117:f1 118:g1 119:h1
`).reduce((obj, pair) => {
  const [num, square] = pair.split(":");
  obj[square] = parseInt(num, 10);
  return obj;
}, {});

const ROOKS = {
  [WHITE]: [
    { square: SQUARES.a1, flag: BITS.QSIDE_CASTLE },
    { square: SQUARES.h1, flag: BITS.KSIDE_CASTLE }
  ],
  [BLACK]: [
    { square: SQUARES.a8, flag: BITS.QSIDE_CASTLE },
    { square: SQUARES.h8, flag: BITS.KSIDE_CASTLE }
  ]
};

const rank = i => i >> 4;
const file = i => i & 15;
const fenType = v => v.toLowerCase();
const fenColor = v => (v < "a" ? WHITE : BLACK);
const fenPiece = (type, color) => (color === WHITE ? type.toUpperCase() : type);
const algebraic = i => "abcdefgh"[file(i)] + "87654321"[rank(i)];
const swapColor = c => (c === WHITE ? BLACK : WHITE);
const isDigit = c => "0123456789".includes(c);

module.exports = (initialFen = DEFAULT_POSITION) => {
  let board = new Array(128);
  let kings = { [WHITE]: EMPTY, [BLACK]: EMPTY };
  let castling = { [WHITE]: 0, [BLACK]: 0 };
  let turn = WHITE;
  let epSquare = EMPTY;
  let halfMoves = 0;
  let moveNumber = 1;
  let fen = "";
  let trying = false;

  // Memoize a function, returning cache while state doesn't change.
  const memoize = fn => {
    // Keep one cache for normal states, and one cache for `tryMove` states.
    let cache, cacheFen;
    let tryCache, tryCacheFen;
    return () => {
      if (cacheFen === fen) {
        return cache;
      } else if (tryCacheFen === fen) {
        return tryCache;
      } else {
        const result = fn();
        if (trying) {
          tryCache = result;
          tryCacheFen = fen;
        } else {
          cache = result;
          cacheFen = fen;
        }
        return result;
      }
    };
  };

  // Load a FEN state.
  const load = input => {
    const tokens = input.split(/\s+/);
    const position = tokens[0];
    let square = 0;

    for (let i = 0; i < position.length; i++) {
      const piece = position.charAt(i);

      if (piece === "/") {
        square += 8;
      } else if (isDigit(piece)) {
        let empty = parseInt(piece, 10);
        while (empty--) {
          board[square++] = "";
        }
      } else {
        board[square] = piece;
        if (fenType(piece) === KING) {
          kings[fenColor(piece)] = square;
        }
        square++;
      }
    }

    turn = tokens[1];

    if (tokens[2].includes("K")) {
      castling[WHITE] |= BITS.KSIDE_CASTLE;
    }
    if (tokens[2].includes("Q")) {
      castling[WHITE] |= BITS.QSIDE_CASTLE;
    }
    if (tokens[2].includes("k")) {
      castling[BLACK] |= BITS.KSIDE_CASTLE;
    }
    if (tokens[2].includes("q")) {
      castling[BLACK] |= BITS.QSIDE_CASTLE;
    }

    epSquare = tokens[3] === "-" ? EMPTY : SQUARES[tokens[3]];
    halfMoves = parseInt(tokens[4], 10);
    moveNumber = parseInt(tokens[5], 10);
    fen = input;
  };

  // Generate FEN from state.
  const generateFen = () => {
    let empty = 0;
    let fen = "";

    for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
      if (!board[i]) {
        empty++;
      } else {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += board[i];
      }

      if ((i + 1) & 0x88) {
        if (empty > 0) {
          fen += empty;
        }

        if (i !== SQUARES.h1) {
          fen += "/";
        }

        empty = 0;
        i += 8;
      }
    }

    let cflags = "";
    if (castling[WHITE] & BITS.KSIDE_CASTLE) {
      cflags += "K";
    }
    if (castling[WHITE] & BITS.QSIDE_CASTLE) {
      cflags += "Q";
    }
    if (castling[BLACK] & BITS.KSIDE_CASTLE) {
      cflags += "k";
    }
    if (castling[BLACK] & BITS.QSIDE_CASTLE) {
      cflags += "q";
    }

    // Do we have an empty castling flag?
    cflags = cflags || "-";
    const epflags = epSquare === EMPTY ? "-" : algebraic(epSquare);

    return [fen, turn, cflags, epflags, halfMoves, moveNumber].join(" ");
  };

  // Build an internal move object.
  const buildMove = (board, from, to, flags, promotion) => {
    const move = {
      number: moveNumber,
      color: turn,
      from: from,
      to: to,
      flags: flags,
      piece: fenType(board[from]),
      captured: ""
    };

    if (promotion) {
      move.flags |= BITS.PROMOTION;
      move.promotion = promotion;
    }

    if (board[to]) {
      move.captured = fenType(board[to]);
    } else if (flags & BITS.EP_CAPTURE) {
      move.captured = PAWN;
    }

    return move;
  };

  // Return a set of all pseudo-legal moves.
  // (This includes moves that allow the king to be captured.)
  const allMoves = memoize(() => {
    const moves = new Set();
    const us = turn;
    const them = swapColor(us);
    const secondRank = { [BLACK]: RANK_7, [WHITE]: RANK_2 };

    let firstSq = SQUARES.a8;
    let lastSq = SQUARES.h1;

    const addMove = (from, to, flags) => {
      // Is pawn promotion?
      if (
        fenType(board[from]) === PAWN &&
        (rank(to) === RANK_8 || rank(to) === RANK_1)
      ) {
        const pieces = [QUEEN, ROOK, BISHOP, KNIGHT];
        for (let i = 0, len = pieces.length; i < len; i++) {
          moves.add(buildMove(board, from, to, flags, pieces[i]));
        }
      } else {
        moves.add(buildMove(board, from, to, flags));
      }
    };

    for (let i = firstSq; i <= lastSq; i++) {
      // Did we run off the end of the board
      if (i & 0x88) {
        i += 7;
        continue;
      }

      const piece = board[i];
      if (!piece || fenColor(piece) !== us) {
        continue;
      }

      const pieceType = fenType(piece);

      if (pieceType === PAWN) {
        // Single square, non-capturing.
        const square1 = i + PAWN_OFFSETS[us][0];
        if (!board[square1]) {
          addMove(i, square1, BITS.NORMAL);

          // Double square.
          const square2 = i + PAWN_OFFSETS[us][1];
          if (secondRank[us] === rank(i) && !board[square2]) {
            addMove(i, square2, BITS.BIG_PAWN);
          }
        }

        // Pawn captures.
        for (let j = 2; j < 4; j++) {
          const square = i + PAWN_OFFSETS[us][j];
          if (square & 0x88) continue;

          if (board[square] && fenColor(board[square]) === them) {
            addMove(i, square, BITS.CAPTURE);
          } else if (square === epSquare) {
            addMove(i, epSquare, BITS.EP_CAPTURE);
          }
        }
      } else {
        const len = PIECE_OFFSETS[pieceType].length;
        for (let j = 0; j < len; j++) {
          const offset = PIECE_OFFSETS[pieceType][j];
          let square = i;

          for (;;) {
            square += offset;
            if (square & 0x88) break;

            if (!board[square]) {
              addMove(i, square, BITS.NORMAL);
            } else {
              if (fenColor(board[square]) !== us) {
                addMove(i, square, BITS.CAPTURE);
              }
              break;
            }

            // Break if knight or king.
            if (pieceType === KNIGHT || pieceType === KING) {
              break;
            }
          }
        }
      }
    }

    // King-side castling.
    if (castling[us] & BITS.KSIDE_CASTLE) {
      const castlingFrom = kings[us];
      const castlingTo = castlingFrom + 2;

      if (
        !board[castlingFrom + 1] &&
        !board[castlingTo] &&
        !attacked(them, kings[us]) &&
        !attacked(them, castlingFrom + 1) &&
        !attacked(them, castlingTo)
      ) {
        addMove(kings[us], castlingTo, BITS.KSIDE_CASTLE);
      }
    }

    // Queen-side castling.
    if (castling[us] & BITS.QSIDE_CASTLE) {
      const castlingFrom = kings[us];
      const castlingTo = castlingFrom - 2;

      if (
        !board[castlingFrom - 1] &&
        !board[castlingFrom - 2] &&
        !board[castlingFrom - 3] &&
        !attacked(them, kings[us]) &&
        !attacked(them, castlingFrom - 1) &&
        !attacked(them, castlingTo)
      ) {
        addMove(kings[us], castlingTo, BITS.QSIDE_CASTLE);
      }
    }

    return moves;
  });

  // Return a set of all legal moves.
  const legalMoves = memoize(() => {
    const us = turn;
    return new Set(
      [...allMoves()].filter(move => tryMove(move, () => !kingAttacked(us)))
    );
  });

  // Convert a move from 0x88 coordinates to Standard Algebraic Notation (SAN).
  //
  // @param {boolean} sloppy Use the sloppy SAN generator to work around over
  // disambiguation bugs in Fritz and Chessbase.  See below:
  //
  // r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
  // 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
  // 4. ... Ne7 is technically the valid SAN
  const moveToSan = (move, sloppy) => {
    let output = "";

    if (move.flags & BITS.KSIDE_CASTLE) {
      output = "O-O";
    } else if (move.flags & BITS.QSIDE_CASTLE) {
      output = "O-O-O";
    } else {
      const disambiguator = getDisambiguator(move, sloppy);

      if (move.piece !== PAWN) {
        output += move.piece.toUpperCase() + disambiguator;
      }

      if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
        if (move.piece === PAWN) {
          output += algebraic(move.from)[0];
        }
        output += "x";
      }

      output += algebraic(move.to);

      if (move.flags & BITS.PROMOTION) {
        output += "=" + move.promotion.toUpperCase();
      }
    }

    tryMove(move, () => {
      if (isInCheck()) {
        if (isInCheckmate()) {
          output += "#";
        } else {
          output += "+";
        }
      }
    });

    return output;
  };

  // Takes SAN-like input and returns 'cleaned' SAN.
  // Decorators are stripped, and aliases replaced.
  const cleanSan = move =>
    move
      .replace(/=/, "")
      .replace(/[+#]?[?!]*$/, "")
      .replace(/0/g, "O")
      .replace(/[♙♟]/g, "")
      .replace(/[♘♞]/g, "N")
      .replace(/[♗♝]/g, "B")
      .replace(/[♖♜]/g, "R")
      .replace(/[♕♛]/g, "Q")
      .replace(/[♔♚]/g, "K");

  // Check if a square is attacked by one of the opponent's pieces.
  const attacked = (color, square) => {
    for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
      // Did we run off the end of the board?
      if (i & 0x88) {
        i += 7;
        continue;
      }

      // If empty square or wrong color
      const piece = board[i];
      if (!piece) continue;

      const pieceColor = fenColor(piece);
      if (pieceColor !== color) continue;

      const pieceType = fenType(piece);
      const difference = i - square;
      const index = difference + 119;

      if (ATTACKS[index] & (1 << SHIFTS[pieceType])) {
        if (pieceType === PAWN) {
          if (difference > 0) {
            if (pieceColor === WHITE) {
              return true;
            }
          } else {
            if (pieceColor === BLACK) {
              return true;
            }
          }
          continue;
        }

        if (pieceType === KNIGHT || pieceType === KING) {
          return true;
        }

        const offset = RAYS[index];
        let j = i + offset;

        let blocked = false;
        while (j !== square) {
          if (board[j]) {
            blocked = true;
            break;
          }
          j += offset;
        }

        if (!blocked) {
          return true;
        }
      }
    }

    return false;
  };

  // Check if a king is attacked.
  const kingAttacked = color => {
    return attacked(swapColor(color), kings[color]);
  };

  const isInCheck = memoize(() => {
    return kingAttacked(turn);
  });

  const isInCheckmate = () => {
    return isInCheck() && legalMoves().size === 0;
  };

  const isInStalemate = () => {
    return !isInCheck() && legalMoves().size === 0;
  };

  const isInDraw = () => {
    return halfMoves >= 100 || isInStalemate() || hasInsufficientMaterial();
  };

  const isGameOver = () => {
    halfMoves >= 100 ||
      isInCheckmate() ||
      isInStalemate() ||
      hasInsufficientMaterial();
  };

  const hasInsufficientMaterial = memoize(() => {
    const pieces = {
      [PAWN]: 0,
      [KNIGHT]: 0,
      [BISHOP]: 0,
      [ROOK]: 0,
      [QUEEN]: 0,
      [KING]: 0
    };
    const bishops = [];
    let numPieces = 0;
    let sqColor = 0;

    for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
      sqColor = (sqColor + 1) % 2;
      if (i & 0x88) {
        i += 7;
        continue;
      }

      const piece = board[i];
      if (piece) {
        const pieceType = fenType(piece);
        pieces[pieceType]++;
        if (pieceType === BISHOP) {
          bishops.push(sqColor);
        }
        numPieces++;
      }
    }

    // k vs. k
    if (numPieces === 2) {
      return true;
    } else if (
      // k vs. kn .... or .... k vs. kb
      numPieces === 3 &&
      (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)
    ) {
      return true;
    } else if (numPieces === pieces[BISHOP] + 2) {
      // kb vs. kb where any number of bishops are all on the same color
      let sum = 0;
      const len = bishops.length;
      for (let i = 0; i < len; i++) {
        sum += bishops[i];
      }
      if (sum === 0 || sum === len) {
        return true;
      }
    }

    return false;
  });

  // Try a new state for the duration of the block.
  const tryMove = (move, block) => {
    const saved = {
      board: board.slice(0),
      kings: { ...kings },
      castling: { ...castling },
      turn,
      epSquare,
      halfMoves,
      moveNumber,
      fen,
      trying
    };

    trying = true;
    makeMove(move);
    const result = block();

    board = saved.board;
    kings = saved.kings;
    castling = saved.castling;
    turn = saved.turn;
    epSquare = saved.epSquare;
    halfMoves = saved.halfMoves;
    moveNumber = saved.moveNumber;
    fen = saved.fen;
    trying = saved.trying;

    return result;
  };

  // Perform a move and update state.
  const makeMove = move => {
    const us = turn;
    const them = swapColor(us);

    board[move.to] = board[move.from];
    board[move.from] = "";

    // If an en passant capture, remove the captured pawn.
    if (move.flags & BITS.EP_CAPTURE) {
      if (turn === BLACK) {
        board[move.to - 16] = "";
      } else {
        board[move.to + 16] = "";
      }
    }

    // If pawn promotion, replace with new piece.
    if (move.flags & BITS.PROMOTION) {
      board[move.to] = fenPiece(move.promotion, us);
    }

    // If we moved the king.
    if (fenType(board[move.to]) === KING) {
      kings[fenColor(board[move.to])] = move.to;

      // If we castled, move the rook next to the king.
      if (move.flags & BITS.KSIDE_CASTLE) {
        const castlingTo = move.to - 1;
        const castlingFrom = move.to + 1;
        board[castlingTo] = board[castlingFrom];
        board[castlingFrom] = "";
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        const castlingTo = move.to + 1;
        const castlingFrom = move.to - 2;
        board[castlingTo] = board[castlingFrom];
        board[castlingFrom] = "";
      }

      // Turn off castling.
      castling[us] = "";
    }

    // Turn off castling if we move a rook.
    if (castling[us]) {
      for (let i = 0, len = ROOKS[us].length; i < len; i++) {
        if (
          move.from === ROOKS[us][i].square &&
          castling[us] & ROOKS[us][i].flag
        ) {
          castling[us] ^= ROOKS[us][i].flag;
          break;
        }
      }
    }

    // Turn off castling if we capture a rook.
    if (castling[them]) {
      for (let i = 0, len = ROOKS[them].length; i < len; i++) {
        if (
          move.to === ROOKS[them][i].square &&
          castling[them] & ROOKS[them][i].flag
        ) {
          castling[them] ^= ROOKS[them][i].flag;
          break;
        }
      }
    }

    // If big pawn move, update the en passant square.
    if (move.flags & BITS.BIG_PAWN) {
      if (turn === BLACK) {
        epSquare = move.to - 16;
      } else {
        epSquare = move.to + 16;
      }
    } else {
      epSquare = EMPTY;
    }

    // Reset the 50 move counter if a pawn is moved or a piece is captured.
    if (move.piece === PAWN) {
      halfMoves = 0;
    } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
      halfMoves = 0;
    } else {
      halfMoves++;
    }

    if (turn === BLACK) {
      moveNumber++;
    }
    turn = swapColor(turn);

    fen = generateFen();
  };

  // This function is used to uniquely identify ambiguous moves.
  const getDisambiguator = (move, sloppy) => {
    const moves = sloppy ? allMoves() : legalMoves();

    const from = move.from;
    const to = move.to;
    const piece = move.piece;

    let ambiguities = 0;
    let sameRank = 0;
    let sameFile = 0;

    for (const { from: ambigFrom, to: ambigTo, piece: ambigPiece } of moves) {
      // If a move of the same piece type ends on the same to square, we'll
      // need to add a disambiguator to the algebraic notation
      if (piece === ambigPiece && from !== ambigFrom && to === ambigTo) {
        ambiguities++;

        if (rank(from) === rank(ambigFrom)) {
          sameRank++;
        }

        if (file(from) === file(ambigFrom)) {
          sameFile++;
        }
      }
    }

    if (ambiguities > 0) {
      // If there exists a similar moving piece on the same rank and file as
      // the move in question, use the square as the disambiguator.
      if (sameRank > 0 && sameFile > 0) {
        return algebraic(from);
      } else if (sameFile > 0) {
        // If the moving piece rests on the same file,
        // use the rank symbol as the disambiguator.
        return algebraic(from).charAt(1);
      } else {
        // Else, use the file symbol.
        return algebraic(from).charAt(0);
      }
    }

    return "";
  };

  // Convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates.
  const moveFromSan = move => {
    // Strip off any move decorations, e.g: Nf3+?!
    const cleanMove = cleanSan(move);

    // Sloppy parser: run a regex to grab piece, to, and from
    // this should parse invalid SAN, like: Pe2-e4, Rc1c4, Qf3xf7
    let piece, from, to, promotion;
    const matches = cleanMove.match(
      /([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/
    );
    if (matches) {
      piece = matches[1];
      from = matches[2];
      to = matches[3];
      promotion = matches[4];
    }

    for (const option of legalMoves()) {
      // Try the strict parser first, then the sloppy parser.
      if (
        cleanMove === cleanSan(moveToSan(option)) ||
        cleanMove === cleanSan(moveToSan(option, true))
      ) {
        return option;
      } else {
        if (
          matches &&
          (!piece || piece.toLowerCase() === option.piece) &&
          SQUARES[from] === option.from &&
          SQUARES[to] === option.to &&
          (!promotion || promotion.toLowerCase() === option.promotion)
        ) {
          return option;
        }
      }
    }

    return null;
  };

  // Pretty = external move object
  const makePretty = uglyMove => {
    let flags = "";
    for (let flag in BITS) {
      if (BITS[flag] & uglyMove.flags) {
        flags += FLAGS[flag];
      }
    }

    return {
      ...uglyMove,
      san: moveToSan(uglyMove, false),
      to: algebraic(uglyMove.to),
      from: algebraic(uglyMove.from),
      flags
    };
  };

  load(initialFen);

  return {
    isInCheck,
    isInCheckmate,
    isInStalemate,
    isInDraw,
    hasInsufficientMaterial,
    isGameOver,

    fen() {
      return fen;
    },

    turn() {
      return turn;
    },

    moves() {
      return new Set([...legalMoves()].map(move => moveToSan(move, false)));
    },

    move(move) {
      const moveObj = moveFromSan(move);
      if (moveObj) {
        // Create pretty move first, before applying.
        const prettyMove = makePretty(moveObj);
        makeMove(moveObj);
        return prettyMove;
      }
    }
  };
};
