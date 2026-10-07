import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
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
import { supabase } from "../lib/supabase";
const prompts = [
  { title: "Гордость года", question: "Чем я горжусь в этом году?" },
  { title: "Сложный момент", question: "Что было самым сложным?" },
  { title: "Мы вместе", question: "Какой наш общий момент я хочу запомнить?" },
  { title: "Важное открытие", question: "Что нового я понял о себе?" },
  {
    title: "Следующая глава",
    question: "Что я хочу попробовать в следующем году?",
  },
];
type Answer = { author: string; prompt: string | null; voice: boolean };
export default function YearBookV2() {
  const { family, members } = useFamily();
  const [year, setYear] = useState(new Date().getFullYear());
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    if (!supabase || !family) return;
    const revision = ++request.current;
    setLoading(true);
    const [text, voice] = await Promise.all([
      supabase
        .from("reflections")
        .select("author_user_id,prompt")
        .eq("family_id", family.id)
        .like("prompt", "% · Книга года %")
        .or(
          `prompt.like.% · Книга года ${year},and(prompt.like.% · Книга года __,created_at.gte.${year}-01-01,created_at.lt.${year + 1}-01-01)`,
        )
        .limit(500),
      supabase
        .from("voice_stories")
        .select("author_user_id,prompt")
        .eq("family_id", family.id)
        .eq("status", "ready")
        .like("prompt", "% · Книга года %")
        .or(
          `prompt.like.% · Книга года ${year},and(prompt.like.% · Книга года __,recorded_at.gte.${year}-01-01,recorded_at.lt.${year + 1}-01-01)`,
        )
        .limit(500),
    ]);
    if (revision !== request.current) return;
    setLoading(false);
    if (text.error || voice.error) {
      setError("Не удалось открыть Книгу года.");
      return;
    }
    setError("");
    setAnswers([
      ...(text.data ?? []).map((r) => ({
        author: r.author_user_id,
        prompt: r.prompt,
        voice: false,
      })),
      ...(voice.data ?? []).map((r) => ({
        author: r.author_user_id,
        prompt: r.prompt,
        voice: true,
      })),
    ]);
  }, [family?.id, year]);
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
        title="Книга года"
        subtitle="Пять вопросов, два взгляда. Сохраните главное об этом годе."
        back
      />
      <View style={ui.between}>
        <Button label="‹ Год" secondary onPress={() => setYear((y) => y - 1)} />
        <Text style={ui.sectionTitle}>{year}</Text>
        <Button
          label="Год ›"
          secondary
          disabled={year >= new Date().getFullYear()}
          onPress={() => setYear((y) => y + 1)}
        />
      </View>
      {error ? <LoadError message={error} retry={() => void load()} /> : null}
      {prompts.map((p) => {
        const saved = answers.filter((a) => a.prompt?.startsWith(p.question));
        return (
          <Card key={p.title}>
            <Text style={ui.sectionTitle}>{p.title}</Text>
            <Text style={ui.body}>{p.question}</Text>
            <View style={ui.wrap}>
              {members.map((m) => (
                <Text key={m.user_id} style={ui.caption}>
                  {m.display_name}:{" "}
                  {saved.some((a) => a.author === m.user_id)
                    ? "есть ответ"
                    : "ещё не ответил"}
                </Text>
              ))}
            </View>
            <Button
              label="Ответить"
              onPress={() =>
                router.push({
                  pathname: "/reflection-new",
                  params: { prompt: `${p.question} · Книга года ${year}` },
                })
              }
            />
            {saved.some((a) => !a.voice) ? (
              <Button
                label="Прочитать ответы"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/memories",
                    params: { topic: p.question, year: String(year) },
                  })
                }
              />
            ) : null}
            {saved.some((a) => a.voice) ? (
              <Button
                label="Послушать ответы"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/voice-stories",
                    params: { topic: p.question, year: String(year) },
                  })
                }
              />
            ) : null}
          </Card>
        );
      })}
      <ActionRow
        title="Все текстовые воспоминания"
        description="Включая ответы, сохранённые раньше"
        to="/memories"
      />
      <ActionRow
        title="Все голосовые истории"
        description="Прослушать записи по месяцам"
        to="/voice-stories"
      />
    </Page>
  );
}
