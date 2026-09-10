import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../lib/supabase';
import { colors, gradients, moduleColors, radius, shadows } from '../../theme';

const directions = [
  { id: 'school', icon: '📚', title: 'Школа', detail: 'Цели и маленькие победы', color: moduleColors.school },
  { id: 'football', icon: '⚽', title: 'Футбол', detail: 'Тренировки и матчи', color: moduleColors.football },
  { id: 'chess', icon: '♟', title: 'Шахматы', detail: 'Партии и стратегия', color: moduleColors.chess },
  { id: 'english', icon: 'EN', title: 'English', detail: 'Живая речь', color: moduleColors.english },
  { id: 'leadership', icon: '🧭', title: 'Лидерство', detail: 'Решения и характер', color: moduleColors.leadership },
] as const;

const moodChoices = [
  { key: 'great', emoji: '😄', label: 'Огонь' },
  { key: 'good', emoji: '🙂', label: 'Хорошо' },
  { key: 'okay', emoji: '😐', label: 'Норм' },
  { key: 'low', emoji: '😕', label: 'Так себе' },
  { key: 'sad', emoji: '😔', label: 'Грустно' },
] as const;

type MoodRow = { user_id: string; mood: string; created_at: string };
type LatestMoodMap = Record<string, MoodRow>;
type UpcomingMeeting = { id: string; meeting_date: string; title: string };

const todayIso = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const daysUntil = (dateValue: string) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const meeting = new Date(`${dateValue}T00:00:00`);
  return Math.max(0, Math.round((meeting.getTime() - today.getTime()) / 86_400_000));
};

const countdownText = (meeting: UpcomingMeeting | null) => {
  if (!meeting) return 'Выбрать дату';
  const days = daysUntil(meeting.meeting_date);
  if (days === 0) return 'Сегодня!';
  if (days === 1) return 'Завтра';
  if (days >= 2 && days <= 4) return `${days} дня`;
  return `${days} дней`;
};

const moodPresentation = (mood?: string) => (
  moodChoices.find((choice) => choice.key === mood) ?? { key: 'none', emoji: '○', label: 'Нет отметки' }
);

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase() || '•';

export default function HomeScreen() {
  const { session } = useAuth();
  const { family, members, me } = useFamily();
  const [latestMoods, setLatestMoods] = useState<LatestMoodMap>({});
  const [interactions, setInteractions] = useState(0);
  const [completedMissions, setCompletedMissions] = useState(0);
  const [growthCount, setGrowthCount] = useState(0);
  const [nextMeeting, setNextMeeting] = useState<UpcomingMeeting | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const parent = useMemo(() => members.find((member) => member.role === 'parent'), [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child'), [members]);

  const parentName = parent?.display_name ?? 'Михаил';
  const childName = child?.display_name ?? 'Артур';
  const teamName = family?.name ?? 'Михаил + Артур';
  const isLive = Boolean(supabase && session && family && me);

  const loadHomeData = useCallback(async () => {
    if (!supabase || !family) return;

    const [moodsResult, interactionsResult, missionsResult, growthResult, meetingResult] = await Promise.all([
      supabase.from('moods').select('user_id,mood,created_at').eq('family_id', family.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('activity_events').select('id', { count: 'exact', head: true }).eq('family_id', family.id).eq('category', 'together'),
      supabase.from('missions').select('id', { count: 'exact', head: true }).eq('family_id', family.id).eq('status', 'completed'),
      supabase.from('growth_entries').select('id', { count: 'exact', head: true }).eq('family_id', family.id),
      supabase.from('meetings').select('id,meeting_date,title').eq('family_id', family.id).eq('status', 'planned').gte('meeting_date', todayIso()).order('meeting_date', { ascending: true }).limit(1).maybeSingle(),
    ]);

    if (!moodsResult.error) {
      const next: LatestMoodMap = {};
      for (const row of (moodsResult.data ?? []) as MoodRow[]) if (!next[row.user_id]) next[row.user_id] = row;
      setLatestMoods(next);
    }
    if (!interactionsResult.error) setInteractions(interactionsResult.count ?? 0);
    if (!missionsResult.error) setCompletedMissions(missionsResult.count ?? 0);
    if (!growthResult.error) setGrowthCount(growthResult.count ?? 0);
    if (!meetingResult.error) setNextMeeting((meetingResult.data as UpcomingMeeting | null) ?? null);
  }, [family]);

  useEffect(() => { void loadHomeData(); }, [loadHomeData]);

  const saveMood = async (mood: string) => {
    if (!supabase || !family || !session || actionBusy) return;
    setActionBusy(true);
    try {
      const { error } = await supabase.from('moods').insert({ family_id: family.id, user_id: session.user.id, mood });
      if (error) throw error;
      await loadHomeData();
    } catch (caught) {
      Alert.alert('Не удалось сохранить настроение', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally { setActionBusy(false); }
  };

  const sendFiveMinutes = async () => {
    if (!supabase || !family || !session || actionBusy) {
      if (!isLive) Alert.alert('Демо-режим', 'После подключения Supabase эта карточка отправит сигнал второму участнику.');
      return;
    }
    setActionBusy(true);
    try {
      const { error } = await supabase.rpc('send_connection_signal', {
        p_family_id: family.id,
        p_signal_type: 'five_minutes',
        p_message: null,
      });
      if (error) {
        if (error.message.includes('SIGNAL_TOO_SOON')) {
          Alert.alert('Сигнал уже отправлен', 'Не будем спамить. Подожди немного перед повторной отправкой.');
          return;
        }
        throw error;
      }
      setInteractions((value) => value + 1);
      Alert.alert('Отправлено ✦', `${me?.role === 'parent' ? childName : parentName} увидит, что у тебя есть несколько минут на связь.`);
    } catch (caught) {
      Alert.alert('Не удалось отправить сигнал', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally { setActionBusy(false); }
  };

  const parentMood = moodPresentation(parent ? latestMoods[parent.user_id]?.mood : 'great');
  const childMood = moodPresentation(child ? latestMoods[child.user_id]?.mood : 'good');
  const myMood = me ? moodPresentation(latestMoods[me.user_id]?.mood) : null;
  const todayQuestion = me?.role === 'child'
    ? 'Какой момент сегодня ты хотел бы показать папе?'
    : 'Что сегодня ты хотел бы рассказать Артуру не как совет, а просто как историю?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.team} start={{ x: 0.05, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroRing} />
          <Text style={styles.heroStar}>✦</Text>

          <View style={styles.heroTop}>
            <View>
              <Text style={styles.brand}>Папа & Я</Text>
              <Text style={styles.tagline}>Одна команда. Где бы мы ни были.</Text>
            </View>
            <Pressable style={styles.teamBadge} onPress={() => router.push('/(tabs)/us')}>
              <Text style={styles.teamBadgeText}>КОМАНДА</Text>
              <Text style={styles.teamBadgeName}>{teamName}</Text>
            </Pressable>
          </View>

          <View style={styles.peopleScene}>
            <View style={styles.personHero}>
              <View style={[styles.avatar, styles.avatarParent]}>
                <Text style={styles.avatarInitial}>{initial(parentName)}</Text>
                <View style={styles.moodBubble}><Text style={styles.moodBubbleEmoji}>{parentMood.emoji}</Text></View>
              </View>
              <Text style={styles.personHeroName}>{parentName}</Text>
              <Text style={styles.personHeroMood}>{parentMood.label}</Text>
            </View>

            <View style={styles.routeWrap}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
              <View style={styles.routeCompass}><Text style={styles.routeCompassText}>✦</Text></View>
              <View style={styles.routeLine} />
              <View style={styles.routeDot} />
            </View>

            <View style={styles.personHero}>
              <View style={[styles.avatar, styles.avatarChild]}>
                <Text style={styles.avatarInitial}>{initial(childName)}</Text>
                <View style={styles.moodBubble}><Text style={styles.moodBubbleEmoji}>{childMood.emoji}</Text></View>
              </View>
              <Text style={styles.personHeroName}>{childName}</Text>
              <Text style={styles.personHeroMood}>{child ? childMood.label : 'Ждём в команде'}</Text>
            </View>
          </View>

          <Pressable style={styles.meetingStrip} onPress={() => router.push('/meeting-plan')}>
            <View style={styles.calendarIcon}><Text style={styles.calendarIconText}>⌁</Text></View>
            <View style={styles.meetingStripText}>
              <Text style={styles.meetingStripLabel}>{nextMeeting ? 'ДО СЛЕДУЮЩЕЙ ВСТРЕЧИ' : 'НАША СЛЕДУЮЩАЯ ВСТРЕЧА'}</Text>
              <Text style={styles.meetingStripTitle}>{countdownText(nextMeeting)}</Text>
              <Text style={styles.meetingStripHint}>{nextMeeting?.title ?? 'Выбрать дату и придумать приключение'}</Text>
            </View>
            <Text style={styles.heroChevron}>›</Text>
          </Pressable>
        </LinearGradient>

        {isLive ? (
          <View style={[styles.moodPanel, shadows.soft]}>
            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.eyebrow}>СЕГОДНЯ</Text>
                <Text style={styles.panelTitle}>Как ты?</Text>
              </View>
              {myMood ? <Text style={styles.currentMood}>{myMood.emoji} {myMood.label}</Text> : null}
            </View>
            <View style={styles.moodRow}>
              {moodChoices.map((choice) => {
                const active = me ? latestMoods[me.user_id]?.mood === choice.key : false;
                return (
                  <Pressable key={choice.key} disabled={actionBusy} onPress={() => void saveMood(choice.key)} style={[styles.moodButton, active && styles.moodButtonActive]}>
                    <Text style={styles.moodEmoji}>{choice.emoji}</Text>
                    <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{choice.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.connectionGrid}>
          <Pressable style={[styles.connectionPressable, actionBusy && styles.disabled]} onPress={() => void sendFiveMinutes()} disabled={actionBusy}>
            <LinearGradient colors={gradients.connection} style={[styles.connectionCard, shadows.soft]}>
              <View style={styles.chatBubbleOne}><Text style={styles.chatBubbleText}>●</Text></View>
              <View style={styles.chatBubbleTwo} />
              <Text style={styles.connectionKicker}>БЫСТРАЯ СВЯЗЬ</Text>
              <Text style={styles.connectionTitle}>Есть{`\n`}5 минут?</Text>
              <Text style={styles.connectionText}>Позвать друг друга поговорить или сыграть</Text>
              <View style={styles.connectionArrow}><Text style={styles.connectionArrowText}>→</Text></View>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.connectionPressable} onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: todayQuestion } })}>
            <LinearGradient colors={gradients.story} style={[styles.storyCard, shadows.soft]}>
              <View style={styles.storyMoon} />
              <Text style={styles.storyGlyph}>“</Text>
              <Text style={styles.storyKicker}>ВОПРОС ДНЯ</Text>
              <Text style={styles.storyQuestion}>{todayQuestion}</Text>
              <View style={styles.storyAction}><Text style={styles.storyActionText}>Ответить ↗</Text></View>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.eyebrow}>КАРТА РОСТА</Text>
            <Text style={styles.sectionTitle}>Наши направления</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/development')}><Text style={styles.sectionLink}>Весь путь →</Text></Pressable>
        </View>

        <View style={styles.directionGrid}>
          {directions.map((item, index) => (
            <Pressable
              key={item.id}
              style={[styles.directionCard, index === directions.length - 1 && styles.directionCardWide, { backgroundColor: item.color.base }, shadows.soft]}
              onPress={() => router.push({ pathname: '/growth-journal', params: { category: item.id } })}
            >
              <View style={[styles.directionGlow, { backgroundColor: item.color.glow }]} />
              <View style={[styles.directionIcon, { backgroundColor: item.color.strong }]}>
                <Text style={styles.directionIconText}>{item.icon}</Text>
              </View>
              <Text style={styles.directionTitle}>{item.title}</Text>
              <Text style={styles.directionDetail}>{item.detail}</Text>
              <View style={styles.directionFooter}>
                <Text style={[styles.directionJournal, { color: item.color.strong }]}>Открыть журнал</Text>
                <Text style={[styles.directionArrow, { color: item.color.strong }]}>↗</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={[styles.progressCard, shadows.soft]}>
          <View style={styles.progressArt}>
            <View style={styles.progressPlanet}><Text style={styles.progressPlanetText}>✦</Text></View>
            <View style={styles.progressOrbit} />
          </View>
          <Text style={styles.eyebrow}>НАША КОМАНДА</Text>
          <Text style={styles.progressTitle}>Напарники</Text>
          <Text style={styles.progressText}>Каждый разговор, встреча и настоящий шаг делает вашу общую историю длиннее.</Text>
          <View style={styles.progressTrack}>
            <LinearGradient colors={[colors.amber, colors.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.progressFill} />
            <View style={styles.progressMarker} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}><Text style={styles.statValue}>{interactions}</Text><Text style={styles.statLabel}>моментов вместе</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={styles.statValue}>{completedMissions}</Text><Text style={styles.statLabel}>миссий</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={styles.statValue}>{growthCount}</Text><Text style={styles.statLabel}>записей пути</Text></View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 36, gap: 18 },
  hero: { borderRadius: radius.xl, padding: 21, overflow: 'hidden', minHeight: 430 },
  heroOrbOne: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,215,106,0.09)', right: -70, top: -70 },
  heroOrbTwo: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(75,158,158,0.16)', left: -45, bottom: 40 },
  heroRing: { position: 'absolute', width: 170, height: 170, borderRadius: 85, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', right: 8, top: 100 },
  heroStar: { position: 'absolute', color: 'rgba(255,215,106,0.35)', fontSize: 76, right: 30, top: 110 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  brand: { color: colors.white, fontSize: 31, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: '#D9E8E9', fontSize: 12, marginTop: 4, fontWeight: '700' },
  teamBadge: { alignItems: 'flex-end', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8, maxWidth: 112 },
  teamBadgeText: { color: '#AFC9CC', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  teamBadgeName: { color: colors.white, fontSize: 10, fontWeight: '900', marginTop: 2 },
  peopleScene: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 34 },
  personHero: { alignItems: 'center', width: 86 },
  avatar: { width: 70, height: 70, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', position: 'relative' },
  avatarParent: { backgroundColor: colors.blue, transform: [{ rotate: '-3deg' }] },
  avatarChild: { backgroundColor: colors.orange, transform: [{ rotate: '3deg' }] },
  avatarInitial: { color: colors.white, fontSize: 28, fontWeight: '900' },
  moodBubble: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, right: -9, bottom: -7, alignItems: 'center', justifyContent: 'center' },
  moodBubbleEmoji: { fontSize: 16 },
  personHeroName: { color: colors.white, fontSize: 13, fontWeight: '900', marginTop: 11 },
  personHeroMood: { color: '#BFD2D4', fontSize: 9, fontWeight: '700', marginTop: 2 },
  routeWrap: { width: 105, flexDirection: 'row', alignItems: 'center', marginHorizontal: -2, marginBottom: 34 },
  routeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  routeLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  routeCompass: { width: 31, height: 31, borderRadius: 16, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  routeCompassText: { color: colors.navyDeep, fontSize: 15, fontWeight: '900' },
  meetingStrip: { marginTop: 30, minHeight: 91, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  calendarIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  calendarIconText: { color: colors.navyDeep, fontSize: 28, fontWeight: '900', transform: [{ rotate: '-12deg' }] },
  meetingStripText: { flex: 1 },
  meetingStripLabel: { color: '#B9CFD1', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  meetingStripTitle: { color: colors.white, fontSize: 22, fontWeight: '900', marginTop: 1 },
  meetingStripHint: { color: '#D6E3E4', fontSize: 10, marginTop: 2 },
  heroChevron: { color: colors.white, fontSize: 30, opacity: 0.75 },
  moodPanel: { borderRadius: radius.lg, backgroundColor: colors.paper, padding: 16, borderWidth: 1, borderColor: colors.lineWarm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  eyebrow: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.25 },
  panelTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 2 },
  currentMood: { color: colors.green, fontSize: 11, fontWeight: '900', backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill },
  moodRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  moodButton: { flex: 1, minHeight: 67, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand, borderWidth: 1.5, borderColor: 'transparent' },
  moodButtonActive: { backgroundColor: '#E0F0E7', borderColor: colors.green, transform: [{ translateY: -2 }] },
  moodEmoji: { fontSize: 23 },
  moodLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', marginTop: 5 },
  moodLabelActive: { color: colors.green },
  connectionGrid: { flexDirection: 'row', gap: 11 },
  connectionPressable: { flex: 1 },
  connectionCard: { minHeight: 238, borderRadius: radius.lg, padding: 17, overflow: 'hidden' },
  chatBubbleOne: { position: 'absolute', width: 74, height: 58, borderRadius: 24, borderBottomLeftRadius: 7, backgroundColor: 'rgba(255,255,255,0.23)', right: -13, top: 16, alignItems: 'center', justifyContent: 'center' },
  chatBubbleText: { color: 'rgba(255,255,255,0.75)', fontSize: 22 },
  chatBubbleTwo: { position: 'absolute', width: 36, height: 28, borderRadius: 13, borderBottomRightRadius: 4, backgroundColor: 'rgba(7,31,42,0.12)', right: 49, top: 72 },
  connectionKicker: { color: 'rgba(13,46,57,0.62)', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  connectionTitle: { color: colors.navyDeep, fontSize: 29, lineHeight: 28, fontWeight: '900', marginTop: 36, letterSpacing: -0.8 },
  connectionText: { color: '#684E2F', fontSize: 10, lineHeight: 15, fontWeight: '700', marginTop: 9, maxWidth: '90%' },
  connectionArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.48)', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  connectionArrowText: { color: colors.navyDeep, fontSize: 19, fontWeight: '900' },
  storyCard: { minHeight: 238, borderRadius: radius.lg, padding: 17, overflow: 'hidden' },
  storyMoon: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.13)', right: -32, top: -20 },
  storyGlyph: { position: 'absolute', color: 'rgba(255,255,255,0.18)', fontSize: 104, fontWeight: '900', right: 17, top: 3 },
  storyKicker: { color: '#E9E5FA', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  storyQuestion: { color: colors.white, fontSize: 15, lineHeight: 21, fontWeight: '900', marginTop: 33 },
  storyAction: { alignSelf: 'flex-start', marginTop: 'auto', paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)' },
  storyActionText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  sectionTitle: { color: colors.navyDeep, fontSize: 23, fontWeight: '900', marginTop: 2, letterSpacing: -0.4 },
  sectionLink: { color: colors.teal, fontSize: 11, fontWeight: '900', paddingBottom: 3 },
  directionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  directionCard: { width: '48.5%', minHeight: 183, borderRadius: radius.lg, padding: 15, overflow: 'hidden' },
  directionCardWide: { width: '100%', minHeight: 145 },
  directionGlow: { position: 'absolute', width: 110, height: 110, borderRadius: 55, right: -35, top: -35, opacity: 0.65 },
  directionIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  directionIconText: { color: colors.white, fontSize: 22, fontWeight: '900' },
  directionTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 15 },
  directionDetail: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3, maxWidth: '86%' },
  directionFooter: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  directionJournal: { fontSize: 9, fontWeight: '900' },
  directionArrow: { fontSize: 20, fontWeight: '900' },
  progressCard: { minHeight: 260, borderRadius: radius.xl, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, padding: 20, overflow: 'hidden' },
  progressArt: { position: 'absolute', right: 13, top: 15, width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  progressPlanet: { width: 55, height: 55, borderRadius: 28, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  progressPlanetText: { color: colors.navyDeep, fontSize: 24, fontWeight: '900' },
  progressOrbit: { position: 'absolute', width: 92, height: 45, borderRadius: 46, borderWidth: 2, borderColor: colors.lineWarm, transform: [{ rotate: '-28deg' }] },
  progressTitle: { color: colors.navyDeep, fontSize: 28, fontWeight: '900', marginTop: 4 },
  progressText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6, maxWidth: '70%' },
  progressTrack: { height: 9, borderRadius: radius.pill, backgroundColor: colors.sandWarm, marginTop: 23, overflow: 'visible' },
  progressFill: { width: '38%', height: 9, borderRadius: radius.pill },
  progressMarker: { position: 'absolute', left: '36%', top: -5, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.white, borderWidth: 5, borderColor: colors.orange },
  statsRow: { flexDirection: 'row', marginTop: 22, alignItems: 'center' },
  statItem: { flex: 1 },
  statValue: { color: colors.navyDeep, fontSize: 21, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 8, lineHeight: 11, fontWeight: '800', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.lineWarm, marginHorizontal: 8 },
  disabled: { opacity: 0.55 },
});
