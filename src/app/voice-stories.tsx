import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { useRecordEditing } from "../hooks/useRecordEditing";
import { editWindowHint } from "../domain/recordEditing";
import { Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
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
import {
  createVoiceStorySignedUrl,
  type VoiceStory,
} from "../data/memoryArchiveRepository";
import { useFamily } from "../context/FamilyContext";
import { supabase } from "../lib/supabase";
const time = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export default function VoiceStoriesScreen() {
  const { id, topic, year } = useLocalSearchParams<{
    id?: string;
    topic?: string;
    year?: string;
  }>();
  const { family, members, me } = useFamily();
  const canEdit = useRecordEditing(me?.user_id);
  const focused = useIsFocused();
  const audioRequest = useRef(0);
  const sourcePath = useRef<string | null>(null);
  const [rows, setRows] = useState<VoiceStory[]>([]);
  const [month, setMonth] = useState(0);
  const [author, setAuthor] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const request = useRef(0);
  useLayoutEffect(() => {
    setOpening(null);
    return () => {
      audioRequest.current++;
      try {
        player.pause();
      } catch {
        /* Native player cleanup must precede hook release. */
      }
    };
  }, [player, focused]);
  const load = useCallback(async () => {
    const revision = ++request.current;
    if (!supabase || !family) return;
    setLoading(true);
    let query = supabase
      .from("voice_stories")
      .select("*")
      .eq("family_id", family.id)
      .eq("status", "ready")
      .order("recorded_at", { ascending: false })
      .order("id", { ascending: false });
    if (id) query = query.eq("id", id).limit(1);
    else {
      if (topic && /^\d{4}$/.test(year ?? ""))
        query = query
          .like("prompt", `${topic.replace(/[%_\\]/g, "\\$&")}%`)
          .or(
            `prompt.like.% · Книга года ${year},and(prompt.like.% · Книга года __,recorded_at.gte.${year}-01-01,recorded_at.lt.${Number(year) + 1}-01-01)`,
          );
      else {
        const range = monthBounds(month);
        query = query
          .gte("recorded_at", range.from)
          .lt("recorded_at", range.until);
      }
      if (author) query = query.eq("author_user_id", author);
      query = query.range(page * 10, page * 10 + 10);
    }
    const result = await query;
    if (revision !== request.current) return;
    setLoading(false);
    if (result.error) {
      setError("Не удалось загрузить голосовые истории.");
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
    }, [load, player]),
  );
  const play = async (row: VoiceStory) => {
    if (!supabase || opening || !focused) return;
    const revision = ++audioRequest.current;
    setOpening(row.id);
    try {
      if (playing === row.id && sourcePath.current === row.storage_path) {
        if (status.playing) player.pause();
        else {
          if (status.didJustFinish) await player.seekTo(0);
          if (revision === audioRequest.current) player.play();
        }
      } else {
        const url = await createVoiceStorySignedUrl(supabase, row.storage_path);
        if (revision !== audioRequest.current) return;
        player.replace(url);
        sourcePath.current = row.storage_path;
        setPlaying(row.id);
        player.play();
      }
    } catch {
      if (revision === audioRequest.current)
        setError("Не удалось открыть аудио. Попробуйте ещё раз.");
    } finally {
      if (revision === audioRequest.current) setOpening(null);
    }
  };
  return (
    <Page refreshing={loading} onRefresh={() => void load()}>
      <Heading
        title={
          id
            ? "Голосовая история"
            : topic
              ? "Голоса в Книге года"
              : "Голосовые истории"
        }
        subtitle={topic ?? "Нажмите «Слушать», чтобы включить запись."}
        back
      />
      {!id && !topic ? (
        <>
          <Button
            label="Записать голосовую историю"
            onPress={() => router.push("/voice-story-new")}
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
          <Text style={ui.body}>За выбранный период записей пока нет.</Text>
        </Card>
      ) : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <Text style={ui.rowTitle}>{row.title || "Голосовая история"}</Text>
          <Text style={ui.caption}>
            {members.find((m) => m.user_id === row.author_user_id)
              ?.display_name ?? "Участник"}{" "}
            · {new Date(row.recorded_at).toLocaleDateString("ru-RU")} ·{" "}
            {time(row.duration_ms / 1000)}
          </Text>
          {row.prompt ? (
            <Text numberOfLines={id ? undefined : 2} style={ui.body}>
              {row.prompt.replace(/ · Книга года \d+$/, "")}
            </Text>
          ) : null}
          <Button
            label={
              playing === row.id && status.playing ? "Ⅱ Пауза" : "▶ Слушать"
            }
            secondary
            busy={opening === row.id}
            onPress={() => void play(row)}
          />
          {canEdit(row.created_at, row.author_user_id) ? (
            <Button
              label="Перезаписать сегодня"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/voice-story-new",
                  params: { replaceId: row.id },
                })
              }
            />
          ) : null}
          {id && row.author_user_id === me?.user_id ? (
            <Text style={ui.caption}>
              {canEdit(row.created_at, row.author_user_id)
                ? editWindowHint
                : "День создания закончился. Эту запись можно только слушать."}
            </Text>
          ) : null}
          {playing === row.id ? (
            <View style={{ gap: 6 }}>
              <View
                style={{
                  height: 5,
                  backgroundColor: "#E1E9E4",
                  borderRadius: 3,
                }}
              >
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    width: `${Math.min(100, (status.currentTime / (status.duration || 1)) * 100)}%`,
                    backgroundColor: "#287A67",
                  }}
                />
              </View>
              <Text style={ui.caption}>
                {time(status.currentTime)} /{" "}
                {time(status.duration || row.duration_ms / 1000)}
              </Text>
            </View>
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
              : "Все голосовые истории"
          }
          to={
            rows[0]?.prompt?.includes("Книга года")
              ? "/year-review"
              : "/voice-stories"
          }
        />
      )}
    </Page>
  );
}
