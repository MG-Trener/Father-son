import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Text, TextInput } from "react-native";
import { useRecordEditing } from "../hooks/useRecordEditing";
import { editWindowHint, recordEditError } from "../domain/recordEditing";
import { useFeedback } from "../components/Feedback";
import {
  ActionRow,
  Button,
  Card,
  Heading,
  LoadError,
  Page,
  ui,
} from "../components/Everyday";
import {
  ArchiveControls,
  ArchivePages,
  monthBounds,
} from "../components/ArchiveControls";
import { useFamily } from "../context/FamilyContext";
import { supabase } from "../lib/supabase";
type Memory = {
  id: string;
  author_user_id: string;
  prompt: string | null;
  body: string;
  created_at: string;
};
export default function MemoriesScreen() {
  const { id, topic, year } = useLocalSearchParams<{
    id?: string;
    topic?: string;
    year?: string;
  }>();
  const { family, members, me } = useFamily();
  const canEdit = useRecordEditing(me?.user_id);
  const feedback = useFeedback();
  const [editing, setEditing] = useState<Memory | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const saveEdit = async () => {
    if (!supabase || !editing || saving || !draft.trim()) return;
    setSaving(true);
    try {
      const result = await supabase.rpc("edit_reflection", {
        p_id: editing.id,
        p_body: draft.trim(),
        p_expected_body: editing.body,
      });
      if (result.error) throw result.error;
      setEditing(null);
      setError("");
      feedback("Изменения сохранены");
      await load();
    } catch (e) {
      setError(recordEditError(e));
    } finally {
      setSaving(false);
    }
  };
  const [rows, setRows] = useState<Memory[]>([]);
  const [month, setMonth] = useState(0);
  const [author, setAuthor] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const load = useCallback(async () => {
    const revision = ++request.current;
    if (!supabase || !family) return;
    setLoading(true);
    let query = supabase
      .from("reflections")
      .select("id,author_user_id,prompt,body,created_at")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (id) query = query.eq("id", id).limit(1);
    else {
      if (topic && /^\d{4}$/.test(year ?? ""))
        query = query
          .like("prompt", `${topic.replace(/[%_\\]/g, "\\$&")}%`)
          .or(
            `prompt.like.% · Книга года ${year},and(prompt.like.% · Книга года __,created_at.gte.${year}-01-01,created_at.lt.${Number(year) + 1}-01-01)`,
          );
      else {
        const range = monthBounds(month);
        query = query
          .gte("created_at", range.from)
          .lt("created_at", range.until);
      }
      if (author) query = query.eq("author_user_id", author);
      query = query.range(page * 10, page * 10 + 10);
    }
    const result = await query;
    if (revision !== request.current) return;
    setLoading(false);
    if (result.error) {
      setError("Не удалось загрузить воспоминания.");
      return;
    }
    setError("");
    setRows((result.data ?? []).slice(0, id ? 1 : 10));
    setMore((result.data?.length ?? 0) > 10);
  }, [family?.id, id, topic, year, month, author, page]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        request.current++;
      };
    }, [load]),
  );
  return (
    <Page refreshing={loading} onRefresh={() => void load()}>
      <Heading
        title={
          id
            ? "Воспоминание"
            : topic
              ? "Ответы в Книге года"
              : "Текстовые воспоминания"
        }
        subtitle={topic}
        back
      />
      {!id && !topic ? (
        <>
          <Button
            label="Записать воспоминание"
            onPress={() =>
              router.push({
                pathname: "/reflection-new",
                params: { mode: "story" },
              })
            }
          />
          <ArchiveControls
            month={month}
            setMonth={(n) => {
              setMonth(n);
              setPage(0);
            }}
            author={author}
            setAuthor={(a) => {
              setAuthor(a);
              setPage(0);
            }}
          />
        </>
      ) : null}
      {error ? <LoadError message={error} retry={() => void load()} /> : null}
      {!loading && !error && !rows.length ? (
        <Card>
          <Text style={ui.body}>
            {id
              ? "Запись недоступна."
              : "За выбранный период записей пока нет."}
          </Text>
        </Card>
      ) : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <Text style={ui.caption}>
            {members.find((m) => m.user_id === row.author_user_id)
              ?.display_name ?? "Участник"}{" "}
            ·{" "}
            {new Date(row.created_at).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
          {row.prompt ? (
            <Text numberOfLines={id ? undefined : 2} style={ui.rowTitle}>
              {row.prompt.replace(/ · Книга года \d+$/, "")}
            </Text>
          ) : null}
          {editing?.id === row.id ? (
            <>
              <TextInput
                accessibilityLabel="Редактировать воспоминание"
                multiline
                maxLength={4000}
                value={draft}
                onChangeText={setDraft}
                style={[ui.input, ui.textArea]}
                editable={
                  !saving && canEdit(row.created_at, row.author_user_id)
                }
              />
              <Text style={ui.caption}>{editWindowHint}</Text>
              <Button
                label="Сохранить изменения"
                busy={saving}
                disabled={
                  !draft.trim() || !canEdit(row.created_at, row.author_user_id)
                }
                onPress={() => void saveEdit()}
              />
              <Button
                label="Отмена"
                secondary
                disabled={saving}
                onPress={() => {
                  setEditing(null);
                  setError("");
                }}
              />
            </>
          ) : (
            <Text
              selectable={Boolean(id)}
              numberOfLines={id ? undefined : 3}
              style={ui.body}
            >
              {row.body}
            </Text>
          )}
          {id && !editing && canEdit(row.created_at, row.author_user_id) ? (
            <Button
              label="Редактировать текст"
              secondary
              onPress={() => {
                setEditing(row);
                setDraft(row.body);
              }}
            />
          ) : null}
          {id && row.author_user_id === me?.user_id && !editing ? (
            <Text style={ui.caption}>
              {canEdit(row.created_at, row.author_user_id)
                ? editWindowHint
                : "День создания закончился. Запись сохранена без возможности изменения."}
            </Text>
          ) : null}
          {!id ? (
            <Button
              label="Прочитать"
              secondary
              onPress={() =>
                router.push({ pathname: "/memories", params: { id: row.id } })
              }
            />
          ) : null}
        </Card>
      ))}
      {!id ? (
        <ArchivePages
          page={page}
          hasMore={more}
          busy={loading}
          onPage={setPage}
        />
      ) : (
        <ActionRow
          title={
            rows[0]?.prompt?.includes("Книга года")
              ? "Вернуться в Книгу года"
              : "Все воспоминания"
          }
          to={
            rows[0]?.prompt?.includes("Книга года")
              ? "/year-review"
              : "/memories"
          }
        />
      )}
    </Page>
  );
}
