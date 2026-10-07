type Board = {
  version: number;
  finished: boolean;
  turn_user_id: string;
  white_user_id: string;
  black_user_id: string;
  fen: string;
  pgn: string;
};
type Move = { from: string; to: string; promotion: string };
type Engine = {
  loadPgn: (s: string) => void;
  fen: () => string;
  move: (m: Move) => { san: string };
  turn: () => string;
  isGameOver: () => boolean;
  pgn: () => string;
};
export function validateAction(
  chess: Engine,
  game: Board | null,
  actor: string,
  body: {
    version: number;
    action: string;
    from?: string;
    to?: string;
    promotion?: string;
  },
) {
  if ((game?.version ?? 0) !== body.version) throw new Error("STALE_POSITION");
  let move: string | null = null;
  if (body.action === "new") {
    if (game && !game.finished) throw new Error("GAME_IN_PROGRESS");
  } else if (body.action === "move") {
    if (!game || game.finished) throw new Error("NO_ACTIVE_GAME");
    if (game.turn_user_id !== actor) throw new Error("NOT_YOUR_TURN");
    if (game.pgn) chess.loadPgn(game.pgn);
    if (chess.fen() !== game.fen) throw new Error("POSITION_INVALID");
    if (!body.from || !body.to) throw new Error("ILLEGAL_MOVE");
    try {
      move = chess.move({
        from: body.from,
        to: body.to,
        promotion: body.promotion ?? "q",
      }).san;
    } catch {
      throw new Error("ILLEGAL_MOVE");
    }
  } else throw new Error("INVALID_ACTION");
  return {
    fen: chess.fen(),
    pgn: chess.pgn(),
    finished: chess.isGameOver(),
    move,
    turn:
      body.action === "new"
        ? actor
        : chess.turn() === "w"
          ? game!.white_user_id
          : game!.black_user_id,
  };
}
