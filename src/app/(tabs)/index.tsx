import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../components/AppCard';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../lib/supabase';
import { colors, radius } from '../../theme';

const directions = [
  { icon: '📚', title: 'Школа', detail: 'Цели, помощь папы и маленькие победы' },
  { icon: '⚽', title: 'Футбол', detail: 'Тренировки, матчи и личный дневник' },
  { icon: '♟', title: 'Шахматы', detail: 'Партии, задачи и путь стратега' },
  { icon: 'EN', title: 'English', detail: 'Живая речь и короткие челленджи' },
  { icon: '🧭', title: 'Лидерство', detail: 'Ответственность, инициатива и характер' },
];

const moodChoices = [
  { key: 'great', emoji: '😄', label: 'Отлично' },
  { key: 'good', emoji: '🙂', label: 'Хорошо' },
  { key: 'okay', emoji: '😐', label: 'Нормально' },
  { key: 'low', emoji: '😕', label: 'Так себе' },
  { key: 'sad', emoji: '😔', label: 'Грустно' },
] as const;

type MoodRow = {
  user_id: string;
  mood: string;
  created_at: string;
};

type LatestMoodMap = Record<string, MoodRow>;

const moodPresentation = (mood?: string) => {
  const item = moodChoices.find((choice) => choice.key === mood);
  return item ?? { key: 'none', emoji: '○', label: 'Не отмечено' };
};

export default function HomeScreen() {
  const { session } = useAuth();
  const { family, members, me } = useFamily();
  const [latestMoods, setLatestMoods] = useState<LatestMoodMap>({});
  const [interactions, setInteractions] = useState(0);
  const [completedMissions, setCompletedMissions] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);

  const parent = useMemo(
    () => members.find((member) => member.role === 'parent'),
    [members],
  );
  const child = useMemo(
    () => members.find((member) => member.role === 'child'),
    [members],
  );

  const parentName = parent?.display_name ?? 'Михаил';
  const childName = child?.display_name ?? 'Артур';
  const teamName = family?.name ?? 'Михаил + Артур';
  const isLive = Boolean(supabase && session && family && me);

  const loadHomeData = useCallback(async () => {
    if (!supabase || !family) return;

    const [moodsResult, interactionsResult, missionsResult] = await Promise.all([
      supabase
        .from('moods')
        .select('user_id,mood,created_at')
        .eq('family_id', family.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('family_id', family.id)
        .eq('category', 'together'),
      supabase
        .from('missions')
        .select('id', { count: 'exact', head: true })
        .eq('family_id', family.id)
        .eq('status', 'completed'),
    ]);

    if (!moodsResult.error) {
      const next: LatestMoodMap = {};
      for (const row of (moodsResult.data ?? []) as MoodRow[]) {
        if (!next[row.user_id]) next[row.user_id] = row;
      }
      setLatestMoods(next);
    }
    if (!interactionsResult.error) setInteractions(interactionsResult.count ?? 0);
    if (!missionsResult.error) setCompletedMissions(missionsResult.count ?? 0);
  }, [family]);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  const saveMood = async (mood: string) => {
    if (!supabase || !family || !session || actionBusy) return;

    setActionBusy(true);
    try {
      const { error } = await supabase.from('moods').insert({
        family_id: family.id,
        user_id: session.user.id,
        mood,
      });
      if (error) throw error;
      await loadHomeData();
    } catch (caught) {
      Alert.alert('Не удалось сохранить настроение', caught instanceof Error ? caught.message : 'Попробуйте ещё раз.');
    } finally {
      setActionBusy(false);
    }
  };

  const sendFiveMinutes = async () => {
    if (!supabase || !family || !session || actionBusy) {
      if (!isLive) Alert.alert('Демо-режим', 'После подключения Supabase эта кнопка отправит сигнал второму участнику.');
      return;
    }

    setActionBusy(true);
    try {
      const { error } = await supabase.from('activity_events').insert({
        family_id: family.id,
        actor_user_id: session.user.id,
        event_type: 'five_minutes_ping',
        category: 'together',
        payload: { intent: 'connect' },
      });
      if (error) throw error;
      setInteractions((value) => value + 1);
      Alert.alert('Сигнал отправлен в команду', 'Событие уже сохранено. Push-уведомление подключим следующим слоем.');
    } catch (caught) {
      Alert.alert('Не удалось отправить сигнал', caught instanceof Error ? caught.message : 'Попробуйте ещё раз.');
    } finally {
      setActionBusy(false);
    }
  };

  const parentMood = moodPresentation(parent ? latestMoods[parent.user_id]?.mood : 'great');
  const childMood = moodPresentation(child ? latestMoods[child.user_id]?.mood : 'good');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.brand}>Папа & Я</Text>
          <Text style={styles.tagline}>{teamName} · одна команда, где бы мы ни были</Text>
        </View>

        <View style={styles.peopleRow}>
          <View style={styles.personCard}>
            <Text style={styles.personEmoji}>{parentMood.emoji}</Text>
            <View style={styles.personText}>
              <Text style={styles.personName}>{parentName}</Text>
              <Text style={styles.personMood}>{parentMood.label}</Text>
            </View>
          </View>
          <View style={styles.personCard}>
            <Text style={styles.personEmoji}>{childMood.emoji}</Text>
            <View style={styles.personText}>
              <Text style={styles.personName}>{childName}</Text>
              <Text style={styles.personMood}>{child ? childMood.label : 'Ещё не подключён'}</Text>
            </View>
          </View>
        </View>

        {isLive ? (
          <AppCard title="Как ты сегодня?" subtitle="Одно нажатие — и второй увидит твоё настроение">
            <View style={styles.moodRow}>
              {moodChoices.map((choice) => {
                const active = me ? latestMoods[me.user_id]?.mood === choice.key : false;
                return (
                  <Pressable
                    key={choice.key}
                    disabled={actionBusy}
                    onPress={() => void saveMood(choice.key)}
                    style={[styles.moodButton, active && styles.moodButtonActive]}
                  >
                    <Text style={styles.moodEmoji}>{choice.emoji}</Text>
                    <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{choice.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </AppCard>
        ) : null}

        <View style={styles.meetingCard}>
          <Text style={styles.meetingLabel}>ДО СЛЕДУЮЩЕЙ ВСТРЕЧИ</Text>
          <Text style={styles.meetingValue}>12 дней</Text>
          <Text style={styles.meetingHint}>Следующим этапом подключим реальную дату и совместные планы →</Text>
        </View>

        <Pressable style={[styles.fiveButton, actionBusy && styles.disabled]} onPress={() => void sendFiveMinutes()} disabled={actionBusy}>
          <Text style={styles.fiveTitle}>Есть 5 минут?</Text>
          <Text style={styles.fiveText}>Мягко позвать друг друга поговорить, сыграть или посоветоваться</Text>
        </Pressable>

        <AppCard title="Сегодня вместе" subtitle="Вопрос дня">
          <Text style={styles.question}>Какой момент сегодня ты хотел бы показать папе?</Text>
          <Pressable style={styles.voiceButton}>
            <Text style={styles.voiceButtonText}>🎙 Рассказать голосом</Text>
          </Pressable>
        </AppCard>

        <View>
          <Text style={styles.sectionTitle}>Наши направления</Text>
          <View style={styles.directionList}>
            {directions.map((item) => (
              <View key={item.title} style={styles.directionRow}>
                <View style={styles.directionIcon}><Text style={styles.directionIconText}>{item.icon}</Text></View>
                <View style={styles.directionText}>
                  <Text style={styles.directionTitle}>{item.title}</Text>
                  <Text style={styles.directionDetail}>{item.detail}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            ))}
          </View>
        </View>

        <AppCard title={`Команда ${teamName}`} subtitle="Уровень 1 · Напарники">
          <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
          <View style={styles.statsRow}>
            <Text style={styles.stat}>❤️ {interactions} взаимодействий</Text>
            <Text style={styles.stat}>🎯 {completedMissions} миссий</Text>
            <Text style={styles.stat}>📖 История начинается</Text>
          </View>
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 32, gap: 18 },
  brand: { color: colors.navyDeep, fontSize: 31, fontWeight: '900', letterSpacing: -0.8 },
  tagline: { marginTop: 5, color: colors.muted, fontSize: 14, lineHeight: 20 },
  peopleRow: { flexDirection: 'row', gap: 10 },
  personCard: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.md, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line },
  personEmoji: { fontSize: 26 },
  personText: { flex: 1 },
  personName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  personMood: { color: colors.green, marginTop: 2, fontSize: 12, fontWeight: '700' },
  moodRow: { flexDirection: 'row', gap: 7 },
  moodButton: { flex: 1, minHeight: 74, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand, paddingHorizontal: 3, borderWidth: 1, borderColor: 'transparent' },
  moodButtonActive: { backgroundColor: '#E7F0EA', borderColor: colors.green },
  moodEmoji: { fontSize: 24 },
  moodLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  moodLabelActive: { color: colors.green },
  meetingCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 22 },
  meetingLabel: { color: '#C9D7D7', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  meetingValue: { color: colors.white, fontSize: 38, fontWeight: '900', marginTop: 5 },
  meetingHint: { color: '#E7EEEE', fontSize: 13, marginTop: 7, lineHeight: 19 },
  fiveButton: { backgroundColor: colors.amber, borderRadius: radius.lg, padding: 20 },
  fiveTitle: { color: colors.navyDeep, fontSize: 22, fontWeight: '900' },
  fiveText: { color: colors.navyDeep, opacity: 0.76, marginTop: 4, lineHeight: 19, fontSize: 13 },
  disabled: { opacity: 0.55 },
  question: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 24 },
  voiceButton: { alignSelf: 'flex-start', backgroundColor: colors.navy, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  voiceButtonText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 10 },
  directionList: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  directionRow: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  directionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  directionIconText: { fontSize: 17, fontWeight: '900', color: colors.navy },
  directionText: { flex: 1, paddingHorizontal: 12 },
  directionTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  directionDetail: { color: colors.muted, marginTop: 2, fontSize: 12 },
  chevron: { color: colors.muted, fontSize: 25 },
  progressTrack: { height: 9, borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },
  progressFill: { width: '22%', height: '100%', backgroundColor: colors.green, borderRadius: radius.pill },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});
