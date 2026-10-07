import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFamily } from "../context/FamilyContext";
import { supabase } from "../lib/supabase";
import { notifyFamilyEvent } from "../lib/pushNotifications";
import { Button, ui } from "./Everyday";
import { useFeedback } from "./Feedback";

type Incoming = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  payload: unknown;
};
const types = [
  "five_minutes_ping",
  "advice_requested",
  "connection_response",
  "chat_message",
  "chess_move",
];
export function ConversationBanner() {
  const { family, me, members } = useFamily();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [busy, setBusy] = useState(false);
  const dismissed = useRef(new Set<string>());
  const fetching = useRef(false);
  const load = useCallback(async () => {
    if (!supabase || !family || !me || fetching.current) return;
    fetching.current = true;
    try {
      const result = await supabase
        .from("activity_events")
        .select("id,event_type,actor_user_id,payload")
        .eq("family_id", family.id)
        .in("event_type", types)
        .gte("occurred_at", new Date(Date.now() - 24 * 3600000).toISOString())
        .order("occurred_at", { ascending: false })
        .limit(60);
      if (result.error) return;
      const rows = result.data ?? [];
      const reads = await supabase
        .from("activity_event_reads")
        .select("event_id")
        .eq("user_id", me.user_id)
        .in(
          "event_id",
          rows.map((r) => r.id),
        );
      if (reads.error) return;
      const read = new Set((reads.data ?? []).map((r) => r.event_id));
      const chess = rows.some((r) => r.event_type === "chess_move")
        ? await supabase
            .from("chess_games")
            .select("version,turn_user_id,finished")
            .eq("family_id", family.id)
            .maybeSingle()
        : null;
      const answered = new Set(
        rows
          .filter((r) => r.event_type === "connection_response")
          .map(
            (r) => (r.payload as { signal_event_id?: string })?.signal_event_id,
          ),
      );
      const candidate = rows.find(
        (r) =>
          r.actor_user_id !== me.user_id &&
          !read.has(r.id) &&
          !dismissed.current.has(r.id) &&
          !answered.has(r.id) &&
          (r.event_type !== "chess_move" ||
            (chess?.data &&
              !chess.data.finished &&
              chess.data.turn_user_id === me.user_id &&
              (r.payload as { version?: number })?.version ===
                chess.data.version)),
      );
      if (
        candidate &&
        ((path === "/chat" && candidate.event_type === "chat_message") ||
          (path === "/chess" && candidate.event_type === "chess_move"))
      ) {
        dismissed.current.add(candidate.id);
        await supabase.rpc("mark_activity_events_read", {
          p_family_id: family.id,
          p_event_ids: [candidate.id],
        });
        setIncoming(null);
      } else setIncoming(candidate ?? null);
    } catch {
      // A reconnect/poll will retry; a transient notification error must not crash the app.
    } finally {
      fetching.current = false;
    }
  }, [family?.id, me?.user_id, path]);
  useEffect(() => {
    if (!supabase || !family || !me) return;
    void load();
    const client = supabase;
    const channel = client
      .channel(`incoming-${family.id}-${me.user_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_events",
          filter: `family_id=eq.${family.id}`,
        },
        () => void load(),
      )
      .subscribe();
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void load();
    }, 15000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => {
      clearInterval(interval);
      listener.remove();
      void client.removeChannel(channel);
    };
  }, [load, family?.id, me?.user_id]);
  const dismiss = async () => {
    if (!incoming || !supabase || !family) return;
    dismissed.current.add(incoming.id);
    setIncoming(null);
    await supabase.rpc("mark_activity_events_read", {
      p_family_id: family.id,
      p_event_ids: [incoming.id],
    });
  };
  const respond = async (response: "here" | "later") => {
    if (!supabase || !incoming || busy) return;
    setBusy(true);
    const result = await supabase.rpc("respond_connection_signal", {
      p_signal_event_id: incoming.id,
      p_response: response,
    });
    setBusy(false);
    if (result.error) {
      feedback("Не удалось ответить. Попробуйте ещё раз");
      return;
    }
    const data = result.data as { event_id?: string };
    if (data.event_id) void notifyFamilyEvent(data.event_id);
    await dismiss();
    if (response === "here") router.navigate("/chat");
  };
  if (!incoming) return null;
  const actor =
    members.find((m) => m.user_id === incoming.actor_user_id)?.display_name ??
    "Собеседник";
  const call = ["five_minutes_ping", "advice_requested"].includes(
    incoming.event_type,
  );
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 12,
        right: 12,
        zIndex: 50,
      }}
    >
      <View
        style={[
          ui.card,
          {
            backgroundColor: "#FFF4DB",
            borderColor: "#D9C78D",
            shadowColor: "#102C36",
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 9,
          },
        ]}
      >
        <View style={ui.between}>
          <Text style={[ui.rowTitle, { flex: 1 }]}>
            {call
              ? `${actor} хочет поговорить`
              : incoming.event_type === "chess_move"
                ? `Ваш ход в шахматах! ${actor} уже сходил`
                : incoming.event_type === "connection_response"
                  ? (incoming.payload as { response?: string })?.response ===
                    "later"
                    ? `${actor} сможет поговорить чуть позже`
                    : `${actor} принял приглашение — можно писать`
                  : `Новое сообщение от ${actor}`}
          </Text>
          <Pressable
            accessibilityLabel="Закрыть уведомление"
            style={ui.smallButton}
            onPress={() => void dismiss()}
          >
            <Text style={ui.link}>×</Text>
          </Pressable>
        </View>
        {call ? (
          <>
            <Button
              label="Принять и открыть чат"
              busy={busy}
              onPress={() => void respond("here")}
            />
            <Button
              label="Чуть позже"
              secondary
              disabled={busy}
              onPress={() => void respond("later")}
            />
          </>
        ) : (
          <Button
            label={
              incoming.event_type === "chess_move"
                ? "Открыть доску"
                : "Открыть чат"
            }
            onPress={() => {
              const chess = incoming.event_type === "chess_move";
              void dismiss();
              router.navigate(chess ? "/chess" : "/chat");
            }}
          />
        )}
      </View>
    </View>
  );
}
