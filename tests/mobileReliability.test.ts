import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { AudioOperation } from "../src/domain/audioOperation.ts";
import { canEditRecord } from "../src/domain/recordEditing.ts";
import { mergeConfirmed, optimisticMove } from "../src/domain/chessPosition.ts";

test("editing window follows family midnight, not UTC midnight or elapsed 24 hours", () => {
  const created = "2026-10-07T18:59:00Z";
  assert.equal(
    canEditRecord(created, "dad", "dad", new Date("2026-10-07T18:59:59Z")),
    true,
  );
  assert.equal(
    canEditRecord(created, "dad", "dad", new Date("2026-10-07T19:00:00Z")),
    false,
  );
  assert.equal(
    canEditRecord(
      "2026-10-06T19:00:00Z",
      "dad",
      "dad",
      new Date("2026-10-07T18:59:59Z"),
    ),
    true,
  );
  assert.equal(canEditRecord(created, "dad", "son", new Date(created)), false);
  assert.equal(canEditRecord("invalid", "dad", "dad"), false);
});

test("audio cannot stop twice or touch released native objects after an await", async () => {
  const audio = new AudioOperation();
  const stop = audio.begin()!;
  assert.equal(audio.begin(), null);
  let accessed = false;
  const continuation = Promise.resolve().then(() => {
    if (audio.valid(stop)) accessed = true;
  });
  audio.dispose();
  await continuation;
  assert.equal(accessed, false);
  assert.equal(audio.begin(), null);
  audio.activate();
  const next = audio.begin()!;
  audio.finish(stop);
  assert.equal(audio.begin(), null); // obsolete cleanup cannot unlock a new action
  audio.finish(next);
  assert.notEqual(audio.begin(), null);
});

const initial = () => ({
  family_id: "family",
  white_user_id: "dad",
  black_user_id: "son",
  fen: new Chess().fen(),
  pgn: "",
  turn_user_id: "dad",
  version: 1,
  finished: false,
  last_move: null,
  updated_at: "2026-10-07T15:00:00Z",
});
test("piece moves immediately without changing the last confirmed position", () => {
  const before = initial();
  const preview = optimisticMove(before, "dad", "e2", "e4");
  assert.equal(new Chess(preview.fen).get("e4")?.type, "p");
  assert.equal(new Chess(before.fen).get("e2")?.type, "p");
  assert.equal(preview.turn_user_id, "son");
  assert.throws(
    () => optimisticMove(before, "son", "e2", "e4"),
    /NOT_YOUR_TURN/,
  );
  assert.throws(() => optimisticMove(before, "dad", "e2", "e5"));
});
test("late polling cannot rewind an acknowledged move or a fast opponent response", () => {
  const first = optimisticMove(initial(), "dad", "e2", "e4");
  const second = optimisticMove(first, "son", "e7", "e5");
  assert.equal(mergeConfirmed(second, first), second);
  assert.equal(mergeConfirmed(first, second), second);
  assert.throws(() => mergeConfirmed(null, { ...initial(), fen: "corrupt" }));
});
