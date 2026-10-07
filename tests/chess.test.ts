import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { validateAction } from "../supabase/functions/chess-game/validate.ts";
const initial = () => ({
  version: 1,
  finished: false,
  turn_user_id: "dad",
  white_user_id: "dad",
  black_user_id: "son",
  fen: new Chess().fen(),
  pgn: "",
});
test("asynchronous turns survive serialization and preserve the next player", () => {
  const first = validateAction(new Chess(), initial(), "dad", {
    version: 1,
    action: "move",
    from: "e2",
    to: "e4",
  });
  assert.equal(first.turn, "son");
  const second = validateAction(
    new Chess(),
    {
      ...initial(),
      version: 2,
      fen: first.fen,
      pgn: first.pgn,
      turn_user_id: first.turn,
    },
    "son",
    { version: 2, action: "move", from: "e7", to: "e5" },
  );
  assert.equal(second.turn, "dad");
  assert.equal(second.move, "e5");
});
test("rejects illegal moves, wrong user and stale boards", () => {
  assert.throws(
    () =>
      validateAction(new Chess(), initial(), "dad", {
        version: 1,
        action: "move",
        from: "e2",
        to: "e5",
      }),
    /ILLEGAL_MOVE/,
  );
  assert.throws(
    () =>
      validateAction(new Chess(), initial(), "son", {
        version: 1,
        action: "move",
        from: "e2",
        to: "e4",
      }),
    /NOT_YOUR_TURN/,
  );
  assert.throws(
    () =>
      validateAction(new Chess(), initial(), "dad", {
        version: 0,
        action: "move",
        from: "e2",
        to: "e4",
      }),
    /STALE_POSITION/,
  );
  assert.throws(
    () =>
      validateAction(new Chess(), initial(), "dad", {
        version: 1,
        action: "new",
      }),
    /GAME_IN_PROGRESS/,
  );
});
test("castling, checkmate and repetition remain valid after restoring PGN", () => {
  let game = initial();
  for (const [from, to] of [
    ["f2", "f3"],
    ["e7", "e5"],
    ["g2", "g4"],
    ["d8", "h4"],
  ]) {
    const next = validateAction(new Chess(), game, game.turn_user_id, {
      version: game.version,
      action: "move",
      from,
      to,
    });
    game = {
      ...game,
      ...next,
      version: game.version + 1,
      turn_user_id: next.turn,
    };
  }
  assert.equal(game.finished, true);
  assert.equal(new Chess(game.fen).isCheckmate(), true);
  assert.throws(
    () =>
      validateAction(new Chess(), game, game.turn_user_id, {
        version: game.version,
        action: "move",
        from: "a2",
        to: "a3",
      }),
    /NO_ACTIVE_GAME/,
  );
  const engine = new Chess();
  for (const m of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1"])
    engine.move(m);
  const repeated = validateAction(
    new Chess(),
    { ...initial(), fen: engine.fen(), pgn: engine.pgn(), turn_user_id: "son" },
    "son",
    { version: 1, action: "move", from: "f6", to: "g8" },
  );
  assert.equal(repeated.finished, true);
  const castle = new Chess();
  for (const m of ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"]) castle.move(m);
  const castled = validateAction(
    new Chess(),
    { ...initial(), fen: castle.fen(), pgn: castle.pgn() },
    "dad",
    { version: 1, action: "move", from: "e1", to: "g1" },
  );
  assert.equal(castled.move, "O-O");
});
