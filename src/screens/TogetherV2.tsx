import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StoryHero } from '../components/StoryHero';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { notifyFamilyEvent } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type TogetherMission = {
  id: string;
  title: string;
  description: string | null;
  xp_reward: number;
  due_at: string | null;
  created_by: string;
  assigned_to: string | null;
};

type RecentEvent = {
  id: string;
  actor_user_id: string | null;
  event_type: string;
  occurred_at: string;
  payload: unknown;
};

const questions = [
  'Что сегодня было лучше, чем ты ожидал?',
  'Если бы у нас был свободный день только вдвоём — что бы мы сделали?',
  'Какой навык ты хотел бы заметно улучшить за год?',
  'Какой мой совет тебе реально помог, а какой — нет?',
  'Что взрослые иногда неправильно понимают про детей твоего возраста?',
  'Чему ты хотел бы научить меня?',
  'Какой момент из наших встреч ты помнишь особенно хорошо?',
  'Что для тебя значит быть хорошим другом?',
  'Какое решение за последнее время ты считаешь своим самым удачным?',
  'Что хочется обязательно попробовать до следующего дня рождения?',
];

const adviceTopics = ['Школа', 'Футбол', 'Друзья', 'Решение', 'Просто поговорить'];

const payloadRecord = (payload: unknown): Record<string, unknown> => (
  payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
);
const payloadText = (payload: unknown, key: string) => {
  const value = payloadRecord(payload)[key];
  return typeof value === 'string' ? value : null;
};
const rpcEventId = (data: unknown) => {
  const value = payloadRecord(data).event_id;
  return typeof value === 'string' ? value : null;
};
const timeLabel = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return sameDay ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function TogetherV2() {
  const { session } = useAuth();
  const { family, members, me } = useFamily();
  const other = useMemo(() => members.find((member) => member.user_id !== me?.user_id) ?? null, [members, me]);
  const isChild = me?.role === 'child';
  const myName = me?.display_name ?? (isChild ? 'Артур' : 'Михаил');
  const otherName = other?.display_name ?? (isChild ? 'Михаил' : 'Артур');
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const [mission, setMission] = useState<TogetherMission | null>(null);
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [question, setQuestion] = useState(questions[0] ?? 'О чём хочется поговорить сегодня?');
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [adviceTopic, setAdviceTopic] = useState('Просто поговорить');
  const [adviceNote, setAdviceNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const respondedSignalIds = useMemo(() => {
    const result = new Set<string>();
    for (const event of events) {
      if (event.event_type !== 'connection_response') continue;
      const id = payloadText(event.payload, 'signal_event_id');
      if (id) result.add(id);
    }
    return result;
  }, [events]);

  const pendingSignal = useMemo(() => events.find((event) => (
    (event.event_type === 'five_minutes_ping' || event.event_type === 'advice_requested')
    && event.actor_user_id !== me?.user_id
    && !respondedSignalIds.has(event.id)
  )) ?? null, [events, me, respondedSignalIds]);

  const load = useCallback(async () => {
    if (!supabase || !family) {
      setLoading(false);
      return;
    }
    const [missionResult, eventsResult] = await Promise.all([
      supabase.from('missions').select('id,title,description,xp_reward,due_at,created_by,assigned_to').eq('family_id', family.id).eq('category', 'together').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('activity_events').select('id,actor_user_id,event_type,occurred_at,payload').eq('family_id', family.id).in('event_type', ['five_minutes_ping', 'advice_requested', 'reflection_added', 'connection_response', 'voice_story_added']).order('occurred_at', { ascending: false }).limit(24),
    ]);
    if (missionResult.error) Alert.alert('Не удалось загрузить общую миссию', missionResult.error.message);
    else setMission((missionResult.data as TogetherMission | null) ?? null);
    if (!eventsResult.error) setEvents((eventsResult.data ?? []) as RecentEvent[]);
    setLoading(false);
  }, [family]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sendSignal = async (type: 'five_minutes' | 'advice', message?: string) => {
    if (!supabase || !family || !session || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('send_connection_signal', {
        p_family_id: family.id,
        p_signal_type: type,
        p_message: message?.trim() || null,
      });
      if (error) {
        if (error.message.includes('SIGNAL_TOO_SOON')) {
          Alert.alert('Сигнал уже отправлен', 'Не будем спамить. Подожди немного перед повтором.');
          return;
        }
        throw error;
      }
      const eventId = rpcEventId(data);
      if (eventId) void notifyFamilyEvent(eventId);
      setAdviceOpen(false);
      setAdviceNote('');
      await load();
      Alert.alert(type === 'five_minutes' ? 'Сигнал отправлен ✦' : 'Запрос отправлен', `${otherName} увидит его на своём телефоне.`);
    } catch (caught) {
      Alert.alert('Не удалось отправить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const respond = async (response: 'here' | 'later') => {
    if (!supabase || !pendingSignal || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('respond_connection_signal', { p_signal_event_id: pendingSignal.id, p_response: response });
      if (error) throw error;
      const eventId = rpcEventId(data);
      if (eventId) void notifyFamilyEvent(eventId);
      await load();
      Alert.alert(response === 'here' ? 'Я рядом 🤝' : 'Ответ отправлен', response === 'here' ? 'Можно созвониться или написать прямо сейчас.' : 'Второй участник увидит, что ты ответишь чуть позже.');
    } catch (caught) {
      Alert.alert('Не удалось ответить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const completeMission = async () => {
    if (!supabase || !mission || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('complete_mission', { p_mission_id: mission.id });
      if (error) throw error;
      const record = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
      const achievement = typeof record.achievement_title === 'string' ? record.achievement_title : null;
      await load();
      Alert.alert('Общая миссия выполнена ✦', achievement ? `Открыта веха «${achievement}».` : `+${mission.xp_reward} XP вашей команде.`);
    } catch (caught) {
      Alert.alert('Не удалось завершить миссию', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const drawQuestion = () => {
    const pool = questions.filter((item) => item !== question);
    const next = (pool.length ? pool : questions)[Math.floor(Math.random() * Math.max(1, pool.length || questions.length))];
    if (next) setQuestion(next);
  };

  const eventSummary = (event: RecentEvent) => {
    const actor = event.actor_user_id ? names.get(event.actor_user_id) ?? 'Участник' : 'Команда';
    if (event.event_type === 'five_minutes_ping') return `${actor} позвал на 5 минут`;
    if (event.event_type === 'advice_requested') return `${actor} попросил совета`;
    if (event.event_type === 'connection_response') return `${actor}: ${payloadText(event.payload, 'response') === 'here' ? 'я рядом' : 'чуть позже'}`;
    if (event.event_type === 'voice_story_added') return `${actor} оставил голосовую историю`;
    return `${actor} сохранил важную мысль`;
  };

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  }

  const pendingActor = pendingSignal?.actor_user_id ? names.get(pendingSignal.actor_user_id) ?? otherName : otherName;
  const pendingMessage = pendingSignal?.event_type === 'advice_requested' ? payloadText(pendingSignal.payload, 'message') : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <StoryHero
          kicker="НАША БАЗА · ПАПА & Я"
          title={isChild ? `Я и папа — одна команда` : `Мы рядом, даже когда далеко`}
          subtitle={isChild
            ? `Здесь можно позвать папу, спросить совет, придумать тему для разговора или сохранить то, что хочется помнить.`
            : `Не только контроль и советы. Это место, где ${myName} и ${otherName} остаются частью жизни друг друга каждый день.`}
          emblem="♥"
          variant="warm"
          footer={(
            <View style={styles.heroPeople}>
              <View><Text style={styles.heroName}>{myName}</Text><Text style={styles.heroRole}>{isChild ? 'сын' : 'папа'}</Text></View>
              <View style={styles.heroBridge}><View style={styles.heroLine} /><View style={styles.heroStar}><Text style={styles.heroStarText}>✦</Text></View><View style={styles.heroLine} /></View>
              <View style={styles.heroPersonRight}><Text style={styles.heroName}>{otherName}</Text><Text style={styles.heroRole}>{isChild ? 'папа' : 'сын'}</Text></View>
            </View>
          )}
        />

        {pendingSignal ? (
          <LinearGradient colors={['#FFCF69', '#F5A34B', '#E97B5A']} style={[styles.incoming, shadows.lift]}>
            <View style={styles.signalGlow} />
            <Text style={styles.signalKicker}>СИГНАЛ ОТ {pendingActor.toUpperCase()}</Text>
            <Text style={styles.signalTitle}>{pendingSignal.event_type === 'five_minutes_ping' ? 'Есть 5 минут?' : 'Мне нужен твой совет'}</Text>
            {pendingMessage ? <Text style={styles.signalMessage}>{pendingMessage}</Text> : null}
            <View style={styles.signalActions}>
              <Pressable style={styles.hereButton} disabled={busy} onPress={() => void respond('here')}><Text style={styles.hereText}>🤝 Я рядом</Text></Pressable>
              <Pressable style={styles.laterButton} disabled={busy} onPress={() => void respond('later')}><Text style={styles.laterText}>Чуть позже</Text></Pressable>
            </View>
          </LinearGradient>
        ) : null}

        <View style={styles.sectionHead}>
          <View><Text style={styles.kicker}>БЫСТРО</Text><Text style={styles.sectionTitle}>Что делаем?</Text></View>
        </View>

        <View style={styles.actionGrid}>
          <Pressable style={styles.actionPressable} disabled={busy} onPress={() => void sendSignal('five_minutes')}>
            <LinearGradient colors={['#FFF1C8', '#FFD786']} style={[styles.actionCard, shadows.soft]}>
              <Text style={styles.actionIcon}>✦</Text><Text style={styles.actionTitle}>Есть 5 минут?</Text><Text style={styles.actionText}>Позвать {otherName}</Text>
            </LinearGradient>
          </Pressable>
          <Pressable style={styles.actionPressable} onPress={() => setAdviceOpen((value) => !value)}>
            <LinearGradient colors={['#DFF0F3', '#B9DDE4']} style={[styles.actionCard, shadows.soft]}>
              <Text style={styles.actionIcon}>💬</Text><Text style={styles.actionTitle}>Нужен совет</Text><Text style={styles.actionText}>Можно без длинных объяснений</Text>
            </LinearGradient>
          </Pressable>
          <Pressable style={styles.actionPressable} onPress={() => router.push('/meeting-plan')}>
            <LinearGradient colors={['#E3F0E6', '#C8E4D0']} style={[styles.actionCard, shadows.soft]}>
              <Text style={styles.actionIcon}>🗓️</Text><Text style={styles.actionTitle}>Наша встреча</Text><Text style={styles.actionText}>Запланировать время вместе</Text>
            </LinearGradient>
          </Pressable>
          <Pressable style={styles.actionPressable} onPress={() => router.push('/voice-story-new')}>
            <LinearGradient colors={['#EEE8FA', '#D9CEF2']} style={[styles.actionCard, shadows.soft]}>
              <Text style={styles.actionIcon}>🎙️</Text><Text style={styles.actionTitle}>Голосом</Text><Text style={styles.actionText}>Оставить историю друг другу</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {adviceOpen ? (
          <View style={[styles.adviceCard, shadows.soft]}>
            <Text style={styles.kicker}>ЗАПРОС СОВЕТА</Text>
            <Text style={styles.sectionTitle}>О чём?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicRow}>
              {adviceTopics.map((topic) => (
                <Pressable key={topic} onPress={() => setAdviceTopic(topic)} style={[styles.topicChip, adviceTopic === topic && styles.topicChipActive]}>
                  <Text style={[styles.topicText, adviceTopic === topic && styles.topicTextActive]}>{topic}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              value={adviceNote}
              onChangeText={setAdviceNote}
              placeholder="Коротко: что случилось? Можно оставить пустым."
              placeholderTextColor="#9AA6A6"
              multiline
              style={styles.adviceInput}
            />
            <Pressable disabled={busy} style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void sendSignal('advice', `${adviceTopic}${adviceNote.trim() ? `: ${adviceNote.trim()}` : ''}`)}>
              <Text style={styles.primaryButtonText}>Отправить {otherName} →</Text>
            </Pressable>
          </View>
        ) : null}

        <LinearGradient colors={['#6D63A8', '#8E80C4', '#C3B8E7']} style={[styles.questionCard, shadows.soft]}>
          <View style={styles.quoteMark}><Text style={styles.quoteMarkText}>“</Text></View>
          <Text style={styles.questionKicker}>ВОПРОС ДЛЯ НАС ДВОИХ</Text>
          <Text style={styles.question}>{question}</Text>
          <View style={styles.questionActions}>
            <Pressable style={styles.questionButton} onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: question } })}><Text style={styles.questionButtonText}>Ответить</Text></Pressable>
            <Pressable onPress={drawQuestion}><Text style={styles.anotherQuestion}>Другой вопрос ↻</Text></Pressable>
          </View>
        </LinearGradient>

        {mission ? (
          <View style={[styles.missionCard, shadows.soft]}>
            <View style={styles.missionTop}><Text style={styles.missionIcon}>🏕️</Text><View style={styles.missionCopy}><Text style={styles.kicker}>ОБЩАЯ МИССИЯ</Text><Text style={styles.missionTitle}>{mission.title}</Text></View><View style={styles.xp}><Text style={styles.xpText}>+{mission.xp_reward}</Text></View></View>
            {mission.description ? <Text style={styles.missionText}>{mission.description}</Text> : null}
            <Pressable disabled={busy} style={[styles.missionButton, busy && styles.disabled]} onPress={() => void completeMission()}><Text style={styles.missionButtonText}>Мы это сделали ✓</Text></Pressable>
          </View>
        ) : null}

        <View style={[styles.timelineCard, shadows.soft]}>
          <View style={styles.sectionHead}><View><Text style={styles.kicker}>СЛЕДЫ НАШЕГО ДНЯ</Text><Text style={styles.sectionTitle}>Последние моменты</Text></View><Pressable onPress={() => router.push('/(tabs)/yearbook')}><Text style={styles.link}>В книгу →</Text></Pressable></View>
          {events.slice(0, 6).map((event, index) => (
            <View key={event.id} style={[styles.eventRow, index > 0 && styles.eventBorder]}>
              <View style={styles.eventDot} />
              <View style={styles.eventCopy}><Text style={styles.eventTitle}>{eventSummary(event)}</Text><Text style={styles.eventTime}>{timeLabel(event.occurred_at)}</Text></View>
            </View>
          ))}
          {!events.length ? <Text style={styles.emptyText}>Первые сигналы, ответы и истории появятся здесь.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 34, gap: 16 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroPeople: { flexDirection: 'row', alignItems: 'center' },
  heroName: { color: colors.white, fontSize: 13, fontWeight: '900' },
  heroRole: { color: '#D7E5E5', fontSize: 9, fontWeight: '700', marginTop: 1 },
  heroPersonRight: { alignItems: 'flex-end' },
  heroBridge: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  heroLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
  heroStar: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  heroStarText: { color: colors.navyDeep, fontWeight: '900' },
  incoming: { borderRadius: radius.xl, padding: 19, overflow: 'hidden' },
  signalGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.16)', right: -38, top: -60 },
  signalKicker: { color: '#62401D', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  signalTitle: { color: colors.navyDeep, fontSize: 25, fontWeight: '900', marginTop: 5 },
  signalMessage: { color: '#65472C', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 7 },
  signalActions: { flexDirection: 'row', gap: 8, marginTop: 15 },
  hereButton: { flex: 1, minHeight: 45, borderRadius: 15, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  hereText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  laterButton: { flex: 1, minHeight: 45, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.56)', alignItems: 'center', justifyContent: 'center' },
  laterText: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  kicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionPressable: { width: '48.5%' },
  actionCard: { minHeight: 142, borderRadius: radius.lg, padding: 15 },
  actionIcon: { fontSize: 28 },
  actionTitle: { color: colors.navyDeep, fontSize: 15, fontWeight: '900', marginTop: 13 },
  actionText: { color: '#5E7479', fontSize: 9, lineHeight: 13, fontWeight: '700', marginTop: 4 },
  adviceCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: '#E8DED0' },
  topicRow: { gap: 7, paddingTop: 13, paddingBottom: 10 },
  topicChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: '#F1ECE3' },
  topicChipActive: { backgroundColor: colors.navyDeep },
  topicText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  topicTextActive: { color: colors.white },
  adviceInput: { minHeight: 86, borderRadius: radius.md, backgroundColor: '#F6F1E8', padding: 12, color: colors.navyDeep, fontSize: 11, textAlignVertical: 'top' },
  primaryButton: { minHeight: 46, borderRadius: 15, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  questionCard: { borderRadius: radius.xl, padding: 19, overflow: 'hidden' },
  quoteMark: { position: 'absolute', right: 15, top: -5 },
  quoteMarkText: { color: 'rgba(255,255,255,0.18)', fontSize: 95, fontWeight: '900' },
  questionKicker: { color: '#E9E4FA', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  question: { color: colors.white, fontSize: 21, lineHeight: 27, fontWeight: '900', marginTop: 12, maxWidth: '89%' },
  questionActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  questionButton: { backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
  questionButtonText: { color: '#5C5294', fontSize: 10, fontWeight: '900' },
  anotherQuestion: { color: '#F2EFFB', fontSize: 9, fontWeight: '900' },
  missionCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: '#E8DED0' },
  missionTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  missionIcon: { fontSize: 31 },
  missionCopy: { flex: 1 },
  missionTitle: { color: colors.navyDeep, fontSize: 16, fontWeight: '900', marginTop: 2 },
  xp: { backgroundColor: '#FFF0C7', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6 },
  xpText: { color: '#A56E16', fontSize: 9, fontWeight: '900' },
  missionText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 10 },
  missionButton: { minHeight: 45, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  missionButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  timelineCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: '#E8DED0' },
  link: { color: colors.teal, fontSize: 10, fontWeight: '900' },
  eventRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventBorder: { borderTopWidth: 1, borderTopColor: '#EEE7DC' },
  eventDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.amber },
  eventCopy: { flex: 1 },
  eventTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '800' },
  eventTime: { color: colors.muted, fontSize: 8, marginTop: 2 },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 14 },
});
