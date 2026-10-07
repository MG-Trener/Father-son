import { Chess, type Square } from "chess.js";
import type { ChessGame } from "../types/database";

export function optimisticMove(
  game: ChessGame,
  actor: string,
  from: Square,
  to: Square,
  promotion = "q",
): ChessGame {
  if (game.finished || game.turn_user_id !== actor)
    throw new Error("NOT_YOUR_TURN");
  const board = new Chess(game.fen);
  if (game.pgn) {
    board.loadPgn(game.pgn);
    if (board.fen() !== game.fen) throw new Error("INVALID_POSITION");
  }
  const move = board.move({ from, to, promotion });
  return {
    ...game,
    fen: board.fen(),
    pgn: board.pgn(),
    last_move: move.san,
    version: game.version + 1,
    finished: board.isGameOver(),
    turn_user_id:
      board.turn() === "w" ? game.white_user_id : game.black_user_id,
  };
}

export function mergeConfirmed(
  current: ChessGame | null,
  incoming: ChessGame | null,
): ChessGame | null {
  if (!incoming) return current;
  // Ignore stale polling responses after an acknowledgement or realtime refresh.
  if (
    current &&
    current.family_id === incoming.family_id &&
    current.version > incoming.version
  )
    return current;
  new Chess(incoming.fen); // validate before rendering; callers display a recoverable error
  if (!Number.isInteger(incoming.version) || incoming.version < 1)
    throw new Error("INVALID_POSITION");
  return incoming;
}
