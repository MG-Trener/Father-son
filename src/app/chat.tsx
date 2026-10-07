import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { Button, Heading, ui } from "../components/Everyday";
import { useFeedback } from "../components/Feedback";
import { useFamily } from "../context/FamilyContext";
import { useFamilyPresentation } from "../hooks/useFamilyPresentation";
import { useLiveFamily } from "../hooks/useLiveFamily";
import { supabase } from "../lib/supabase";
import { notifyFamilyEvent } from "../lib/pushNotifications";
import type { ChatMessage } from "../types/database";
import { useRecordEditing } from "../hooks/useRecordEditing";
import { recordEditError } from "../domain/recordEditing";

export default function ChatScreen() {
  const { family, me } = useFamily();
  const canEdit = useRecordEditing(me?.user_id);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const unsentDraft = useRef("");
  const { otherName, other } = useFamilyPresentation();
  const feedback = useFeedback();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const retryMessage = useRef<{ id: string; body: string } | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    if (!supabase || !family) return;
    const revision = ++request.current;
    const result = await supabase
      .from("chat_messages")
      .select("*")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * 30, page * 30 + 30);
    if (revision !== request.current) return;
    if (result.error) {
      setError("Не удалось обновить чат. Проверьте интернет.");
      return;
    }
    setError("");
    setMessages((result.data ?? []).slice(0, 30));
    setHasMore((result.data?.length ?? 0) > 30);
  }, [family?.id, page]);
  useLiveFamily("chat_messages", family?.id, load);
  const send = async () => {
    if (!supabase || !family || !body.trim() || busy) return;
    const text = body.trim();
    if (retryMessage.current?.body !== text)
      retryMessage.current = { id: Crypto.randomUUID(), body: text };
    setBusy(true);
    setError("");
    try {
      if (editing) {
        const result = await supabase.rpc("edit_chat_message", {
          p_id: editing.id,
          p_body: text,
          p_expected_body: editing.body,
        });
        if (result.error) throw result.error;
        setEditing(null);
        setBody(unsentDraft.current);
        feedback("Сообщение изменено");
        await load();
        return;
      }
      const result = await supabase.rpc("send_chat_message", {
        p_family_id: family.id,
        p_id: retryMessage.current!.id,
        p_body: text,
      });
      if (result.error) throw result.error;
      retryMessage.current = null;
      setBody("");
      setPage(0);
      if (page === 0) await load();
    } catch (e) {
      setError(
        editing
          ? recordEditError(e)
          : "Сообщение не отправлено. Текст сохранён — попробуйте ещё раз.",
      );
    } finally {
      setBusy(false);
    }
  };
  const call = async () => {
    if (!supabase || !family || calling) return;
    setCalling(true);
    try {
      const result = await supabase.rpc("send_connection_signal", {
        p_family_id: family.id,
        p_signal_type: "five_minutes",
      });
      if (result.error) throw result.error;
      const data = result.data as { event_id?: string };
      if (data.event_id) void notifyFamilyEvent(data.event_id);
      feedback("Приглашение поговорить отправлено");
    } catch {
      setError("Не удалось позвать. Если уже приглашали, подождите минуту.");
    } finally {
      setCalling(false);
    }
  };
  return (
    <SafeAreaView edges={["top"]} style={ui.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ padding: 16, gap: 10 }}>
          <Heading title="Наш чат" subtitle={`Вы и ${otherName}`} back />
          <Button
            label="Позвать на разговор"
            secondary
            disabled={!other}
            busy={calling}
            onPress={() => void call()}
          />
          {error ? (
            <Text accessibilityRole="alert" style={ui.caption}>
              {error}
            </Text>
          ) : null}
          <View style={ui.between}>
            {page > 0 ? (
              <Pressable
                onPress={() => setPage((p) => p - 1)}
                style={ui.smallButton}
              >
                <Text style={ui.link}>← Новее</Text>
              </Pressable>
            ) : (
              <Text style={ui.caption}>Последние сообщения</Text>
            )}
            {hasMore ? (
              <Pressable
                onPress={() => setPage((p) => p + 1)}
                style={ui.smallButton}
              >
                <Text style={ui.link}>Раньше →</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {messages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
            <Text style={[ui.body, { textAlign: "center" }]}>
              Здесь можно написать друг другу в любое время.
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(row) => row.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 8,
              gap: 8,
            }}
            renderItem={({ item }) => (
              <View
                style={{
                  maxWidth: "88%",
                  alignSelf:
                    item.author_user_id === me?.user_id
                      ? "flex-end"
                      : "flex-start",
                  backgroundColor:
                    item.author_user_id === me?.user_id ? "#DDEDE3" : "#FFFFFF",
                  padding: 13,
                  borderRadius: 18,
                  gap: 5,
                }}
              >
                <Text selectable style={ui.body}>
                  {item.body}
                </Text>
                {canEdit(item.created_at, item.author_user_id) ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => {
                      if (!editing) unsentDraft.current = body;
                      setEditing(item);
                      setBody(item.body);
                      setError("");
                    }}
                    style={{ paddingVertical: 6 }}
                  >
                    <Text style={[ui.link, { fontSize: 12 }]}>Изменить</Text>
                  </Pressable>
                ) : null}
                <Text
                  style={[ui.caption, { textAlign: "right", fontSize: 11 }]}
                >
                  {new Date(item.created_at).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
          />
        )}
        <View style={{ padding: 12, gap: 8, backgroundColor: "white" }}>
          {editing ? (
            <View style={ui.between}>
              <Text style={ui.caption}>Редактирование · только сегодня</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  setEditing(null);
                  setBody(unsentDraft.current);
                  setError("");
                }}
              >
                <Text style={ui.link}>Отмена</Text>
              </Pressable>
            </View>
          ) : null}
          <TextInput
            accessibilityLabel="Сообщение"
            placeholder="Написать сообщение…"
            multiline
            maxLength={4000}
            value={body}
            onChangeText={setBody}
            editable={!busy}
            style={[ui.input, { maxHeight: 110 }]}
          />
          <Button
            label={editing ? "Сохранить изменения" : "Отправить"}
            busy={busy}
            disabled={
              !body.trim() ||
              !other ||
              Boolean(
                editing && !canEdit(editing.created_at, editing.author_user_id),
              )
            }
            onPress={() => void send()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
