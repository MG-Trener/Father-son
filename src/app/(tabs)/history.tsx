import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { Card, Heading, LoadError, Page, ui } from "../../components/Everyday";
import {
  ArchiveControls,
  ArchivePages,
  monthBounds,
} from "../../components/ArchiveControls";
import { useFamily } from "../../context/FamilyContext";
import { supabase } from "../../lib/supabase";
const labels: Record<string, string> = {
  growth_entry_added: "Занятие",
  meeting_completed: "Встреча",
  mission_completed: "Цель выполнена",
  achievement_awarded: "Достижение",
  recognition_added: "Благодарность",
  ritual_moment_added: "Наша традиция",
};
type Row = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  occurred_at: string;
  payload: unknown;
};
export default function History() {
  const { family, members } = useFamily();
  const [rows, setRows] = useState<Row[]>([]);
  const [month, setMonth] = useState(0);
  const [author, setAuthor] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!supabase || !family) return;
    setLoading(true);
    const range = monthBounds(month);
    let query = supabase
      .from("activity_events")
      .select("id,event_type,actor_user_id,occurred_at,payload")
      .eq("family_id", family.id)
      .in("event_type", Object.keys(labels))
      .gte("occurred_at", range.from)
      .lt("occurred_at", range.until)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * 10, page * 10 + 10);
    if (author) query = query.eq("actor_user_id", author);
    const result = await query;
    setLoading(false);
    if (result.error) {
      setError("Не удалось загрузить события.");
      return;
    }
    setError("");
    setRows((result.data ?? []).slice(0, 10));
    setMore((result.data?.length ?? 0) > 10);
  }, [family?.id, month, author, page]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Page refreshing={loading} onRefresh={() => void load()}>
      <Heading
        title="Важные события"
        subtitle="Встречи, занятия и достижения. По 10 событий на странице."
        back
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
      {error ? <LoadError message={error} retry={() => void load()} /> : null}
      {!loading && !error && !rows.length ? (
        <Card>
          <Text style={ui.body}>В этом месяце ещё нет событий.</Text>
        </Card>
      ) : null}
      {rows.map((row) => {
        const data = row.payload as { title?: string; note?: string };
        return (
          <Card key={row.id}>
            <Text style={ui.rowTitle}>
              {data?.title || labels[row.event_type]}
            </Text>
            <Text numberOfLines={2} style={ui.caption}>
              {labels[row.event_type]} ·{" "}
              {members.find((m) => m.user_id === row.actor_user_id)
                ?.display_name ?? "Вместе"}{" "}
              · {new Date(row.occurred_at).toLocaleDateString("ru-RU")}
            </Text>
            {data?.note ? (
              <Text numberOfLines={2} style={ui.body}>
                {data.note}
              </Text>
            ) : null}
          </Card>
        );
      })}
      <ArchivePages
        page={page}
        hasMore={more}
        busy={loading}
        onPage={setPage}
      />
    </Page>
  );
}
