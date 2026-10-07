import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Chess, type Square } from "chess.js";
import {
  ActionRow,
  Button,
  Card,
  Heading,
  LoadError,
  Page,
  ui,
} from "../components/Everyday";
import { useFamily } from "../context/FamilyContext";
import { useLiveFamily } from "../hooks/useLiveFamily";
import { supabase } from "../lib/supabase";
import { notifyFamilyEvent } from "../lib/pushNotifications";
import type { ChessGame } from "../types/database";

const pieces = {
  w: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
const pieceNames = {
  k: "король",
  q: "ферзь",
  r: "ладья",
  b: "слон",
  n: "конь",
  p: "пешка",
};
export default function ChessScreen() {
  const { family, me, members } = useFamily();
  const [game, setGame] = useState<ChessGame | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState(true);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const load = useCallback(async () => {
    if (!supabase || !family) return;
    const result = await supabase
      .from("chess_games")
      .select("*")
      .eq("family_id", family.id)
      .maybeSingle();
    if (result.error) {
      setError("Не удалось обновить доску.");
      return;
    }
    setGame(result.data);
  }, [family?.id]);
  useLiveFamily("chess_games", family?.id, load);
  const chess = useMemo(() => new Chess(game?.fen), [game?.fen]);
  const black = me?.user_id === game?.black_user_id;
  const ranks = black ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = black ? "hgfedcba" : "abcdefgh";
  const myTurn = Boolean(
    game && !game.finished && game.turn_user_id === me?.user_id,
  );
  const legal = useMemo(
    () =>
      selected && myTurn
        ? chess.moves({ square: selected, verbose: true })
        : [],
    [chess, selected, myTurn],
  );
  const commit = async (
    action: "new" | "move",
    from?: Square,
    to?: Square,
    promote = "q",
  ) => {
    if (!supabase || !family || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.functions.invoke("chess-game", {
        body: {
          action,
          family_id: family.id,
          version: game?.version ?? 0,
          from,
          to,
          promotion: promote,
          notify,
        },
      });
      if (result.error) {
        let reason = "";
        try {
          reason = (await result.error.context.json()).error;
        } catch {}
        throw new Error(reason);
      }
      if (result.data?.event_id) void notifyFamilyEvent(result.data.event_id);
      setSelected(null);
      setPromotion(null);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === "STALE_POSITION"
          ? "Позиция уже изменилась. Доска обновлена — выберите ход ещё раз."
          : "Ход не сохранён. Проверьте связь и очередность хода.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  };
  const choose = (square: Square) => {
    if (!myTurn || busy) return;
    const move = legal.find((m) => m.to === square);
    if (selected && move) {
      if (move.promotion) setPromotion({ from: selected, to: square });
      else void commit("move", selected, square);
      return;
    }
    setSelected(chess.get(square)?.color === chess.turn() ? square : null);
  };
  const other = members.find((m) => m.user_id !== me?.user_id);
  return (
    <Page>
      <Heading
        title="Шахматы вдвоём"
        subtitle="Одна доска. Ходите, когда есть время."
        back
      />
      {error ? <LoadError message={error} retry={() => void load()} /> : null}
      <View style={styles.header}>
        <Text style={styles.kicker}>
          {game?.finished
            ? "ПАРТИЯ ЗАВЕРШЕНА"
            : myTurn
              ? "ВАШ ХОД"
              : game
                ? "ЖДЁМ ХОД СОПЕРНИКА"
                : "НАЧНЁМ ПАРТИЮ?"}
        </Text>
        <Text style={styles.status}>
          {game?.finished
            ? "Спасибо за игру!"
            : game
              ? `${members.find((m) => m.user_id === game.turn_user_id)?.display_name ?? "Игрок"} · ${chess.turn() === "w" ? "белые" : "чёрные"}${chess.isCheck() ? " · шах" : ""}`
              : `Вы и ${other?.display_name ?? "второй участник"}`}
        </Text>
      </View>
      <View style={styles.board} accessibilityLabel="Шахматная доска">
        {ranks.map((rank) => (
          <View key={rank} style={{ flexDirection: "row" }}>
            {[...files].map((file, index) => {
              const square = `${file}${rank}` as Square;
              const piece = chess.get(square);
              const target = legal.some((m) => m.to === square);
              const dark = (file.charCodeAt(0) - 97 + rank) % 2 === 1;
              return (
                <Pressable
                  key={square}
                  accessibilityRole="button"
                  accessibilityLabel={`${square}${piece ? `, ${piece.color === "w" ? "белые" : "чёрные"} ${pieceNames[piece.type]}` : ""}${target ? ", доступный ход" : ""}`}
                  accessibilityState={{
                    selected: selected === square,
                    disabled: !myTurn || busy,
                  }}
                  onPress={() => choose(square)}
                  disabled={!myTurn || busy}
                  style={[
                    styles.square,
                    {
                      backgroundColor:
                        selected === square
                          ? "#D7BC68"
                          : dark
                            ? "#6B8B7B"
                            : "#EBE8D9",
                    },
                  ]}
                >
                  {index === 0 ? <Text style={styles.rank}>{rank}</Text> : null}
                  {rank === ranks[7] ? (
                    <Text style={styles.file}>{file}</Text>
                  ) : null}
                  {piece ? (
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.piece,
                        {
                          color: piece.color === "w" ? "#FFFFFF" : "#152F31",
                          textShadowColor:
                            piece.color === "w" ? "#193A39" : "transparent",
                        },
                      ]}
                    >
                      {pieces[piece.color][piece.type]}
                    </Text>
                  ) : target ? (
                    <View style={styles.dot} />
                  ) : null}
                  {target && piece ? <View style={styles.capture} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {promotion ? (
        <Card>
          <Text style={ui.rowTitle}>В какую фигуру превратить пешку?</Text>
          <View style={ui.wrap}>
            {(["q", "r", "b", "n"] as const).map((p) => (
              <Button
                key={p}
                label={pieceNames[p]}
                secondary
                busy={busy}
                onPress={() =>
                  void commit("move", promotion.from, promotion.to, p)
                }
              />
            ))}
          </View>
          <Button label="Отмена" secondary onPress={() => setPromotion(null)} />
        </Card>
      ) : null}
      {!game || game.finished ? (
        <Button
          label="Начать новую партию"
          busy={busy}
          disabled={!other}
          onPress={() => void commit("new")}
        />
      ) : (
        <Text style={ui.caption}>
          {myTurn
            ? "Нажмите на фигуру — подсветятся доступные ходы."
            : "Позиция сохранена. Можно закрыть приложение и вернуться позже."}
          {game.last_move ? ` Последний ход: ${game.last_move}.` : ""}
        </Text>
      )}
      <View style={ui.between}>
        <Text style={[ui.body, { flex: 1 }]}>Уведомлять о моём ходе</Text>
        <Switch
          accessibilityLabel="Уведомлять о моём ходе"
          value={notify}
          onValueChange={setNotify}
        />
      </View>
      <Text style={ui.caption}>
        Играем ради общения. Без рейтинга, счёта побед и поражений. Новая партия
        заменит предыдущую.
      </Text>
      <ActionRow
        title="Мои занятия"
        description="Задачи, тренировки и разборы"
        to={{ pathname: "/growth-journal", params: { category: "chess" } }}
      />
    </Page>
  );
}
const styles = StyleSheet.create({
  header: { backgroundColor: "#183E3C", borderRadius: 18, padding: 16, gap: 6 },
  kicker: {
    color: "#D7BD78",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  status: { color: "white", fontSize: 19, fontWeight: "600" },
  board: {
    borderWidth: 7,
    borderColor: "#183E3C",
    borderRadius: 9,
    overflow: "hidden",
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  square: {
    width: "12.5%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  piece: {
    fontSize: 35,
    textShadowRadius: 2,
    textShadowOffset: { width: 1, height: 1 },
  },
  rank: {
    position: "absolute",
    top: 1,
    left: 2,
    fontSize: 9,
    color: "#163735",
  },
  file: {
    position: "absolute",
    bottom: 0,
    right: 2,
    fontSize: 9,
    color: "#163735",
  },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#16373566" },
  capture: {
    position: "absolute",
    inset: 2,
    borderWidth: 3,
    borderColor: "#D7BC68",
    borderRadius: 30,
  },
});
