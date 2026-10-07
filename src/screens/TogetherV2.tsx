import { useCallback, useState } from "react";
import { Text } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  ActionRow,
  Button,
  Card,
  Heading,
  LoadError,
  Page,
  Section,
  ui,
} from "../components/Everyday";
import { useFeedback } from "../components/Feedback";
import { useFamily } from "../context/FamilyContext";
import { useFamilyPresentation } from "../hooks/useFamilyPresentation";
import { supabase } from "../lib/supabase";
import { brandAssets } from "../brandAssets";
export default function TogetherV2() {
  const { family } = useFamily();
  const { isChild } = useFamilyPresentation();
  const feedback = useFeedback();
  const [mission, setMission] = useState<{
    id: string;
    title: string;
    description: string | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!supabase || !family) return;
    const result = await supabase
      .from("missions")
      .select("id,title,description")
      .eq("family_id", family.id)
      .eq("category", "together")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) setError("Не удалось обновить общее дело.");
    else {
      setMission(result.data);
      setError("");
    }
  }, [family?.id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const complete = async () => {
    if (!supabase || !mission || busy) return;
    setBusy(true);
    const result = await supabase.rpc("complete_mission", {
      p_mission_id: mission.id,
    });
    setBusy(false);
    if (result.error) setError("Не удалось завершить дело.");
    else {
      feedback("Общее дело выполнено");
      await load();
    }
  };
  return (
    <Page>
      <Heading
        title="Вместе"
        subtitle={
          isChild
            ? "Ваше место для общения с папой."
            : "Общение и время с сыном."
        }
      />
      {error ? <LoadError message={error} retry={() => void load()} /> : null}
      <Card tone="warm">
        <Text style={ui.sectionTitle}>Наш чат</Text>
        <Text style={ui.body}>
          Пишите друг другу в любое время. В чате можно позвать на разговор.
        </Text>
        <Button label="Открыть чат" onPress={() => router.push("/chat")} />
      </Card>
      <Section title="Наше время">
        <ActionRow
          title="Шахматы вдвоём"
          description="Сделайте ход и продолжайте, когда удобно"
          image={require("../../assets/generated/direction-chess.png")}
          to="/chess"
        />
        <ActionRow
          title="Встречи и планы"
          description="Выбрать день и придумать, что сделаем"
          image={brandAssets.utility.calendar}
          to="/meeting-plan"
        />
        <ActionRow
          title="Общие привычки"
          description="Маленькие дела, которые нас сближают"
          image={brandAssets.actions.rituals}
          to="/rituals"
        />
        <ActionRow
          title="Наши договорённости"
          description="Правила, удобные обоим"
          image={brandAssets.utility.agreements}
          to="/agreements"
        />
        <ActionRow
          title="Сказать спасибо"
          description="Замечать заботу и старание"
          image={brandAssets.utility.recognition}
          to="/recognitions"
        />
        <ActionRow
          title="Идеи для разговоров"
          description="Выбрать тему и узнать друг друга лучше"
          to="/conversation-cards"
        />
      </Section>
      {mission ? (
        <Card tone="mint">
          <Text style={ui.caption}>Наше общее дело</Text>
          <Text style={ui.sectionTitle}>{mission.title}</Text>
          {mission.description ? (
            <Text style={ui.body}>{mission.description}</Text>
          ) : null}
          <Button
            label="Мы это сделали"
            busy={busy}
            onPress={() => void complete()}
          />
        </Card>
      ) : (
        <ActionRow
          title="Придумать общее дело"
          description="Одна цель для вас двоих"
          to={{ pathname: "/mission-new", params: { category: "together" } }}
        />
      )}
    </Page>
  );
}
