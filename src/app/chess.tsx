import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  Vibration,
  View,
} from "react-native";
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
import {
  optimisticMove,
  mergeConfirmed,
  getChessNotice,
} from "../domain/chessPosition";
import { useIsFocused } from "expo-router";
import { useFeedback } from "../components/Feedback";
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
  const [confirmed, setConfirmed] = useState<ChessGame | null>(null);
  const [pending, setPending] = useState<ChessGame | null>(null);
  const game =
    pending && (!confirmed || confirmed.version < pending.version)
      ? pending
      : confirmed;
  const confirmedRef = useRef<ChessGame | null>(null);
  const busyRef = useRef(false);
  const [needsSync, setNeedsSync] = useState(false);
  const focused = useIsFocused();
  const feedback = useFeedback();
  const notified = useRef(0);
  const receive = useCallback((incoming: ChessGame | null) => {
    const next = mergeConfirmed(confirmedRef.current, incoming);
    confirmedRef.current = next;
    setConfirmed(next);
  }, []);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const result = await supabase
        .from("chess_games")
        .select("*")
        .eq("family_id", family.id)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (result.error) {
        setError("Не удалось обновить доску.");
        setNeedsSync(true);
        return;
      }
      try {
        receive(result.data);
        setNeedsSync(false);
        setError("");
      } catch {
        setError("Не удалось прочитать позицию. Обновите доску.");
        setNeedsSync(true);
      }
    } catch {
      setError("Не удалось обновить доску. Проверьте интернет.");
      setNeedsSync(true);
    } finally {
      clearTimeout(timeout);
    }
  }, [family?.id]);
  useLiveFamily("chess_games", family?.id, load);
  const chess = useMemo(() => new Chess(game?.fen), [game?.fen]);
  const notice = useMemo(
    () =>
      game
        ? getChessNotice(
            game.fen,
            game.finished,
            game.turn_user_id === me?.user_id,
          )
        : null,
    [game?.fen, game?.finished, game?.turn_user_id, me?.user_id],
  );
  const black = me?.user_id === game?.black_user_id;
  const ranks = black ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = black ? "hgfedcba" : "abcdefgh";
  const myTurn = Boolean(
    game && !game.finished && game.turn_user_id === me?.user_id && !needsSync,
  );
  const legal = useMemo(
    () =>
      selected && myTurn
        ? chess.moves({ square: selected, verbose: true })
        : [],
    [chess, selected, myTurn],
  );
  useEffect(() => {
    if (
      !focused ||
      busy ||
      !confirmed ||
      (!confirmed.finished &&
        confirmed.turn_user_id !== me?.user_id &&
        !new Chess(confirmed.fen).isCheck()) ||
      notified.current >= confirmed.version
    )
      return;
    notified.current = confirmed.version;
    const alert = getChessNotice(
      confirmed.fen,
      confirmed.finished,
      confirmed.turn_user_id === me?.user_id,
    );
    feedback(alert.title);
    AccessibilityInfo.announceForAccessibility(alert.title);
    if (Platform.OS !== "web" && AppState.currentState === "active")
      Vibration.vibrate(
        confirmed.finished ? [0, 250, 100, 250, 100, 250] : [0, 160, 90, 160],
      );
  }, [confirmed?.version, confirmed?.turn_user_id, busy, focused, me?.user_id]);
  const commit = async (
    action: "new" | "move",
    from?: Square,
    to?: Square,
    promote = "q",
  ) => {
    if (!supabase || !family || busyRef.current || needsSync) return;
    const base = confirmedRef.current;
    let preview: ChessGame | null = null;
    try {
      if (action === "move" && base && from && to && me)
        preview = optimisticMove(base, me.user_id, from, to, promote);
    } catch {
      setError("Этот ход недоступен. Обновите доску.");
      return;
    }
    busyRef.current = true;
    setPending(preview);
    setBusy(true);
    setError("");
    setSelected(null);
    setPromotion(null);
    try {
      const result = await supabase.functions.invoke("chess-game", {
        timeout: 15000,
        body: {
          action,
          family_id: family.id,
          version: base?.version ?? 0,
          from,
          to,
          promotion: promote,
          notify,
        },
      });
      if (result.error) throw result.error;
      if (result.data?.game) receive(result.data.game);
      else await load(); // compatibility with a server that has not yet been upgraded
      if (result.data?.event_id) void notifyFamilyEvent(result.data.event_id);
      setPending(null);
    } catch {
      setPending(null);
      setNeedsSync(true);
      setError(
        "Не удалось подтвердить ход. Проверяем доску; при отсутствии связи нажмите «Повторить».",
      );
      await load();
      if (
        (confirmedRef.current?.version ?? 0) >=
        (preview?.version ?? (base?.version ?? 0) + 1)
      )
        setError("");
      else
        setError(
          "Ход не подтверждён. После обновления доски можно повторить его.",
        );
    } finally {
      busyRef.current = false;
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
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.header,
          !busy &&
            (notice?.kind === "check" || notice?.kind === "mate") && {
              backgroundColor: "#7D3437",
              borderWidth: 2,
              borderColor: "#DAADA0",
            },
          myTurn &&
            !busy &&
            notice?.kind !== "check" && {
              backgroundColor: "#176B50",
              borderWidth: 2,
              borderColor: "#D7BD78",
            },
        ]}
      >
        <Text style={styles.kicker}>
          {busy
            ? "СОХРАНЯЕМ ХОД…"
            : needsSync
              ? "НУЖНО ОБНОВИТЬ ДОСКУ"
              : (notice?.title ?? "НАЧНЁМ ПАРТИЮ?")}
        </Text>
        <Text style={styles.status}>
          {notice?.detail ||
            (game
              ? `${members.find((m) => m.user_id === game.turn_user_id)?.display_name ?? "Игрок"} · ${chess.turn() === "w" ? "белые" : "чёрные"}`
              : `Вы и ${other?.display_name ?? "второй участник"}`)}
        </Text>
      </View>
      <View style={styles.board} accessibilityLabel="Шахматная доска">
        {ranks.map((rank) => (
          <View key={rank} style={{ flexDirection: "row" }}>
            {[...files].map((file, index) => {
              const square = `${file}${rank}` as Square;
              const piece = chess.get(square);
              const target = legal.some((m) => m.to === square);
              const threatened = notice?.threatenedKing === square;
              const dark = (file.charCodeAt(0) - 97 + rank) % 2 === 1;
              return (
                <Pressable
                  key={square}
                  accessibilityRole="button"
                  accessibilityLabel={`${square}${piece ? `, ${piece.color === "w" ? "белые" : "чёрные"} ${pieceNames[piece.type]}` : ""}${target ? ", доступный ход" : ""}${threatened ? ", король под шахом" : ""}`}
                  accessibilityState={{
                    selected: selected === square,
                    disabled: !myTurn || busy,
                  }}
                  onPress={() => choose(square)}
                  disabled={!myTurn || busy}
                  style={[
                    styles.square,
                    {
                      borderWidth: threatened ? 3 : 0,
                      borderColor: "#A52C36",
                      backgroundColor: threatened
                        ? "#E9ABA0"
                        : selected === square
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
          {busy
            ? "Фигура перемещена. Ждём подтверждения сервера…"
            : myTurn
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
    fontSize: 18,
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
