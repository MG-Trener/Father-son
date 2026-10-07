import { Chess, type Square } from "chess.js";
import type { ChessGame } from "../types/database";

export function getChessNotice(
  fen: string,
  finished: boolean,
  myTurn: boolean,
) {
  const board = new Chess(fen);
  const threatenedKing = board.isCheck()
    ? (board
        .board()
        .flat()
        .find((piece) => piece?.type === "k" && piece.color === board.turn())
        ?.square ?? null)
    : null;
  if (board.isCheckmate())
    return {
      kind: "mate" as const,
      title: "МАТ — ПАРТИЯ ЗАВЕРШЕНА",
      threatenedKing,
      detail: `Король ${board.turn() === "w" ? "белых" : "чёрных"} под шахом, защиты нет. Можно начать новую партию.`,
    };
  if (finished)
    return {
      kind: "draw" as const,
      title: "НИЧЬЯ — ПАРТИЯ ЗАВЕРШЕНА",
      threatenedKing: null,
      detail: board.isStalemate()
        ? "Пат: король не под шахом, но допустимых ходов нет."
        : "Партия завершилась вничью. Можно сыграть ещё раз.",
    };
  if (board.isCheck())
    return {
      kind: "check" as const,
      title: myTurn ? "ШАХ ВАШЕМУ КОРОЛЮ!" : "ШАХ СОПЕРНИКУ!",
      threatenedKing,
      detail: myTurn
        ? "Ваш ход. Уведите короля, закройте его или возьмите атакующую фигуру. Подсвечиваются только допустимые ходы."
        : "Соперник должен защитить своего короля. Ждём ответный ход.",
    };
  return {
    kind: myTurn ? ("turn" as const) : ("waiting" as const),
    title: myTurn ? "ВАШ ХОД — ИГРАЙТЕ!" : "ЖДЁМ ХОД СОПЕРНИКА",
    threatenedKing: null,
    detail: "",
  };
}

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
