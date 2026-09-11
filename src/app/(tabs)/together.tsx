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
import { ConnectionPulse } from '../../components/ConnectionPulse';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { notifyFamilyEvent } from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabase';
import { colors, gradients, radius, shadows } from '../../theme';

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

const adviceTopics = ['Школа', 'Футбол', 'Друзья', 'Решение', 'Просто поговорить'];
const questionDeck = [
  'Что за последнюю неделю тебя приятно удивило?',
  'Какой навык ты хотел бы уметь заметно лучше через год?',
  'Что взрослые иногда неправильно понимают про детей твоего возраста?',
  'Какой мой совет тебе реально пригодился, а какой — нет?',
  'Если бы у нас был целый свободный день только вдвоём, как бы ты его провёл?',
  'Какое решение за последнее время ты считаешь своим самым удачным?',
  'Что для тебя значит быть хорошим другом?',
  'Какой момент из наших встреч ты помнишь особенно хорошо?',
  'Есть ли что-то, чему ты хотел бы научить меня?',
  'Как ты понимаешь, что человеку можно доверять?',
  'Какой школьный предмет стал бы интереснее, если бы его преподавали иначе?',
  'Что тебе сейчас кажется сложным, хотя год назад было бы ещё сложнее?',
  'Какой поступок другого человека недавно вызвал у тебя уважение?',
  'Что ты хотел бы обязательно попробовать до следующего дня рождения?',
  'Какая наша маленькая традиция могла бы стать постоянной?',
  'Если бы можно было задать мне любой вопрос и получить точный ответ, что бы ты спросил?',
];

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
const prettyDue = (value: string | null) => {
  if (!value) return 'без срока';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'без срока' : `до ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
};
const timeLabel = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return sameDay ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function TogetherScreen() {
  const { session } = useAuth();
  const { family, members, me } = useFamily();
  const [mission, setMission] = useState<TogetherMission | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [question, setQuestion] = useState(questionDeck[0] ?? 'О чём хочется поговорить сегодня?');
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [adviceTopic, setAdviceTopic] = useState('Просто поговорить');
  const [adviceNote, setAdviceNote] = useState('');
  const [loading, setLoading] = useState(Boolean(supabase && family));
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const other = useMemo(() => members.find((member) => member.user_id !== me?.user_id) ?? null, [members, me]);
  const teamTitle = members.length >= 2 ? `${members[0]?.display_name ?? 'Михаил'} + ${members[1]?.display_name ?? 'Артур'}` : family?.name ?? 'Папа & Я';

  const respondedSignalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of recentEvents) {
      if (event.event_type !== 'connection_response') continue;
      const signalId = payloadText(event.payload, 'signal_event_id');
      if (signalId) ids.add(signalId);
    }
    return ids;
  }, [recentEvents]);

  const pendingSignal = useMemo(() => recentEvents.find((event) => (
    (event.event_type === 'five_minutes_ping' || event.event_type === 'advice_requested')
    && event.actor_user_id !== me?.user_id
    && !respondedSignalIds.has(event.id)
  )) ?? null, [recentEvents, me, respondedSignalIds]);

  const load = useCallback(async () => {
    if (!supabase || !family) { setLoading(false); return; }
    const [missionResult, eventsResult] = await Promise.all([
      supabase.from('missions').select('id,title,description,xp_reward,due_at,created_by,assigned_to').eq('family_id', family.id).eq('category', 'together').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('activity_events').select('id,actor_user_id,event_type,occurred_at,payload').eq('family_id', family.id).in('event_type', ['five_minutes_ping', 'advice_requested', 'reflection_added', 'connection_response', 'voice_story_added']).order('occurred_at', { ascending: false }).limit(20),
    ]);
    if (!missionResult.error) setMission((missionResult.data as TogetherMission | null) ?? null);
    if (!eventsResult.error) setRecentEvents((eventsResult.data ?? []) as RecentEvent[]);
    setLoading(false);
  }, [family]);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const sendSignal = async (signalType: 'five_minutes' | 'advice', message?: string) => {
    if (!supabase || !family || !session || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('send_connection_signal', {
        p_family_id: family.id,
        p_signal_type: signalType,
        p_message: message?.trim() || null,
      });
      if (error) {
        if (error.message.includes('SIGNAL_TOO_SOON')) {
          Alert.alert('Сигнал уже отправлен', 'Не будем спамить. Подожди немного перед повторной отправкой.');
          return;
        }
        throw error;
      }
      const eventId = rpcEventId(data);
      if (eventId) void notifyFamilyEvent(eventId);
      await load();
      if (signalType === 'five_minutes') Alert.alert('Отправлено ✦', `${other?.display_name ?? 'Второй участник'} увидит твой сигнал.`);
      else {
        setAdviceOpen(false);
        setAdviceNote('');
        Alert.alert('Запрос отправлен', `${other?.display_name ?? 'Второй участник'} увидит, что тебе нужен совет.`);
      }
    } catch (caught) {
      Alert.alert('Не удалось отправить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally { setBusy(false); }
  };

  const respondToSignal = async (response: 'here' | 'later') => {
    if (!supabase || !pendingSignal || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('respond_connection_signal', { p_signal_event_id: pendingSignal.id, p_response: response });
      if (error) throw error;
      const eventId = rpcEventId(data);
      if (eventId) void notifyFamilyEvent(eventId);
      await load();
      Alert.alert(response === 'here' ? 'Я рядом 🤝' : 'Хорошо', response === 'here' ? 'Ответ отправлен.' : 'Второй участник увидит, что ты ответишь чуть позже.');
    } catch (caught) {
      Alert.alert('Не удалось ответить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally { setBusy(false); }
  };

  const drawQuestion = () => {
    const pool = questionDeck.filter((item) => item !== question);
    const next = (pool.length ? pool : questionDeck)[Math.floor(Math.random() * (pool.length || questionDeck.length))];
    if (next) setQuestion(next);
  };

  const completeMission = async () => {
    if (!supabase || !mission || !session || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('complete_mission', { p_mission_id: mission.id });
      if (error) throw error;
      await load();
      const result = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
      const achievement = typeof result.achievement_title === 'string' ? result.achievement_title : null;
      Alert.alert('Миссия выполнена ✦', achievement ? `Открыто достижение «${achievement}».` : `+${mission.xp_reward} XP вашей команде.`);
    } catch (caught) {
      Alert.alert('Не удалось завершить миссию', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally { setBusy(false); }
  };

  const canCompleteMission = Boolean(session && mission && (mission.created_by === session.user.id || mission.assigned_to === session.user.id));
  const eventSummary = (event: RecentEvent) => {
    const actor = event.actor_user_id ? names.get(event.actor_user_id) ?? 'Участник команды' : 'Команда';
    if (event.event_type === 'five_minutes_ping') return `${actor}: есть 5 минут на связь`;
    if (event.event_type === 'advice_requested') return `${actor}: нужен совет${payloadText(event.payload, 'message') ? ` · ${payloadText(event.payload, 'message')}` : ''}`;
    if (event.event_type === 'connection_response') return `${actor}: ${payloadText(event.payload, 'response') === 'here' ? 'я рядом' : 'отвечу чуть позже'}`;
    if (event.event_type === 'voice_story_added') return `${actor} оставил голосовую историю${payloadText(event.payload, 'title') ? ` · ${payloadText(event.payload, 'title')}` : ''}`;
    return `${actor} сохранил историю${payloadText(event.payload, 'preview') ? ` · ${payloadText(event.payload, 'preview')}` : ''}`;
  };

  const pendingActor = pendingSignal?.actor_user_id ? names.get(pendingSignal.actor_user_id) ?? 'Второй участник' : 'Второй участник';
  const pendingMessage = pendingSignal?.event_type === 'advice_requested' ? payloadText(pendingSignal.payload, 'message') : null;

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.loading}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}>
        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroOrb} />
          <View style={styles.heroRing} />
          <Text style={styles.heroGlyph}>∞</Text>
          <Text style={styles.kicker}>ВАШЕ ПРОСТРАНСТВО</Text>
          <Text style={styles.heroTitle}>Вместе</Text>
          <Text style={styles.heroText}>{teamTitle}{`\n`}Поводы быть ближе, даже когда между вами километры.</Text>
          <View style={styles.heroRoute}><View style={styles.heroRouteDot} /><View style={styles.heroRouteLine} /><View style={styles.heroRouteStar}><Text style={styles.heroRouteStarText}>✦</Text></View><View style={styles.heroRouteLine} /><View style={styles.heroRouteDot} /></View>
        </LinearGradient>

        {pendingSignal ? (
          <LinearGradient colors={gradients.connection} style={[styles.incomingCard, shadows.lift]}>
            <View style={styles.incomingBubble} />
            {pendingSignal.event_type === 'five_minutes_ping' ? <View pointerEvents="none" style={{ position: 'absolute', top: 15, right: 15, opacity: 0.82 }}><ConnectionPulse size={72} color={colors.white} /></View> : null}
            <Text style={styles.incomingEyebrow}>ВХОДЯЩИЙ СИГНАЛ</Text>
            <Text style={styles.incomingTitle}>{pendingSignal.event_type === 'five_minutes_ping' ? `${pendingActor}: есть 5 минут?` : `${pendingActor}: мне нужен совет`}</Text>
            {pendingMessage ? <Text style={styles.incomingMessage}>{pendingMessage}</Text> : null}
            <View style={styles.incomingActions}>
              <Pressable style={styles.hereButton} disabled={busy} onPress={() => void respondToSignal('here')}><Text style={styles.hereText}>🤝 Я рядом</Text></Pressable>
              <Pressable style={styles.laterButton} disabled={busy} onPress={() => void respondToSignal('later')}><Text style={styles.laterText}>Чуть позже</Text></Pressable>
            </View>
          </LinearGradient>
        ) : null}

        <View style={styles.quickGrid}>
          <Pressable style={styles.quickPressable} disabled={busy} onPress={() => void sendSignal('five_minutes')}>
            <LinearGradient colors={gradients.connection} style={[styles.quickCard, shadows.soft]}>
              <View style={styles.quickDecorOne} /><View style={styles.quickDecorTwo} />
              <View pointerEvents="none" style={{ position: 'absolute', top: 13, right: 14, opacity: 0.78 }}><ConnectionPulse size={66} color={colors.white} active={!busy} /></View>
              <Text style={styles.quickIcon}>⏱</Text>
              <Text style={styles.quickTitle}>Есть{`\n`}5 минут?</Text>
              <Text style={styles.quickText}>Позвать друг друга на короткую связь</Text>
              <Text style={styles.quickArrow}>→</Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.quickPressable} disabled={busy} onPress={() => setAdviceOpen((value) => !value)}>
            <LinearGradient colors={['#E8785E', '#F3A15E']} style={[styles.quickCard, shadows.soft]}>
              <View style={styles.compassRing}><Text style={styles.compassNeedle}>⌁</Text></View>
              <Text style={styles.quickIcon}>🧭</Text>
              <Text style={[styles.quickTitle, styles.quickTitleLight]}>Мне нужен{`\n`}совет</Text>
              <Text style={[styles.quickText, styles.quickTextLight]}>Дать понять: сейчас важно поговорить</Text>
              <Text style={[styles.quickArrow, styles.quickArrowLight]}>{adviceOpen ? '⌄' : '→'}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {adviceOpen ? (
          <View style={[styles.advicePanel, shadows.soft]}>
            <Text style={styles.panelKicker}>О ЧЁМ ХОЧЕТСЯ ПОГОВОРИТЬ?</Text>
            <View style={styles.chips}>
              {adviceTopics.map((topic) => (
                <Pressable key={topic} onPress={() => setAdviceTopic(topic)} style={[styles.chip, adviceTopic === topic && styles.chipActive]}>
                  <Text style={[styles.chipText, adviceTopic === topic && styles.chipTextActive]}>{topic}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={adviceNote} onChangeText={setAdviceNote} placeholder="Пара слов — необязательно" placeholderTextColor={colors.mutedSoft} style={styles.input} maxLength={420} />
            <Pressable disabled={busy} onPress={() => void sendSignal('advice', `${adviceTopic}${adviceNote.trim() ? `: ${adviceNote.trim()}` : ''}`)} style={[styles.sendAdvice, busy && styles.disabled]}>
              <Text style={styles.sendAdviceText}>{busy ? 'Отправляем…' : 'Отправить сигнал'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHead}><View><Text style={styles.kickerDark}>СОХРАНИТЬ МОМЕНТ</Text><Text style={styles.sectionTitle}>Истории между вами</Text></View></View>
        <View style={styles.storyGrid}>
          <Pressable style={[styles.storyTile, styles.voiceTile, shadows.soft]} onPress={() => router.push('/voice-story-new')}>
            <View style={styles.voiceWaves}><View style={styles.waveSmall} /><View style={styles.waveTall} /><View style={styles.waveMid} /><View style={styles.waveTall} /><View style={styles.waveSmall} /></View>
            <Text style={styles.storyIcon}>🎙</Text><Text style={styles.storyTitle}>Голосовая{`\n`}история</Text><Text style={styles.storyText}>Голос останется в вашей летописи</Text><Text style={styles.tileArrow}>↗</Text>
          </Pressable>
          <Pressable style={[styles.storyTile, styles.dayTile, shadows.soft]} onPress={() => router.push({ pathname: '/reflection-new', params: { mode: 'story' } })}>
            <Text style={styles.paperLines}>≡</Text><Text style={styles.storyIcon}>✍️</Text><Text style={styles.storyTitle}>История{`\n`}дня</Text><Text style={styles.storyText}>Мысль, смешной момент или важное событие</Text><Text style={styles.tileArrow}>↗</Text>
          </Pressable>
        </View>

        <LinearGradient colors={gradients.story} style={[styles.questionCard, shadows.soft]}>
          <Text style={styles.quoteGlyph}>“</Text>
          <Text style={styles.questionKicker}>ВОПРОС ДЛЯ РАЗГОВОРА</Text>
          <Text style={styles.question}>{question}</Text>
          <View style={styles.questionActions}>
            <Pressable style={styles.questionSecondary} onPress={drawQuestion}><Text style={styles.questionSecondaryText}>🎲 Другой</Text></Pressable>
            <Pressable style={styles.questionPrimary} onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: question } })}><Text style={styles.questionPrimaryText}>Ответить →</Text></Pressable>
          </View>
        </LinearGradient>

        <View style={[styles.missionCard, shadows.soft]}>
          <View style={styles.missionDecor}><Text style={styles.missionDecorText}>✦</Text></View>
          <Text style={styles.kickerDark}>СОВМЕСТНАЯ МИССИЯ</Text>
          <Text style={styles.missionTeam}>{teamTitle}</Text>
          {mission ? (
            <>
              <Text style={styles.missionTitle}>{mission.title}</Text>
              {mission.description ? <Text style={styles.missionDetail}>{mission.description}</Text> : null}
              <View style={styles.missionMeta}><View style={styles.reward}><Text style={styles.rewardText}>+{mission.xp_reward} XP</Text></View><Text style={styles.due}>{prettyDue(mission.due_at)}</Text></View>
              {canCompleteMission ? <Pressable style={styles.completeButton} disabled={busy} onPress={() => void completeMission()}><Text style={styles.completeText}>{busy ? 'Сохраняем…' : '✓ Мы это сделали'}</Text></Pressable> : null}
            </>
          ) : (
            <>
              <Text style={styles.missionTitle}>Одно небольшое дело. Два участника.</Text>
              <Text style={styles.missionDetail}>Сыграть партию, посмотреть один фильм, приготовить одно блюдо или придумать собственное маленькое приключение.</Text>
              <Pressable style={styles.createMission} onPress={() => router.push({ pathname: '/mission-new', params: { category: 'together' } })}><Text style={styles.createMissionText}>Создать миссию →</Text></Pressable>
            </>
          )}
        </View>

        {recentEvents.length ? (
          <View style={[styles.recentCard, shadows.soft]}>
            <Text style={styles.kickerDark}>ПОСЛЕДНИЕ СИГНАЛЫ</Text>
            <Text style={styles.recentTitle}>Следы связи</Text>
            {recentEvents.slice(0, 6).map((event, index) => (
              <View key={event.id} style={styles.recentRow}>
                <View style={styles.recentRail}><View style={styles.recentDot} />{index < Math.min(5, recentEvents.length - 1) ? <View style={styles.recentLine} /> : null}</View>
                <View style={styles.recentContent}><Text style={styles.recentTime}>{timeLabel(event.occurred_at)}</Text><Text style={styles.recentText}>{eventSummary(event)}</Text></View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 36, gap: 18 },
  hero: { minHeight: 250, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'flex-end' }, heroOrb: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -45, top: -55, backgroundColor: 'rgba(255,215,106,0.09)' }, heroRing: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', right: 30, top: 25 }, heroGlyph: { position: 'absolute', color: 'rgba(255,255,255,0.09)', fontSize: 154, right: 5, top: 10, fontWeight: '900' },
  kicker: { color: '#BBD1D2', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 }, heroTitle: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.2, marginTop: 3 }, heroText: { color: '#D6E5E6', fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: '76%' }, heroRoute: { flexDirection: 'row', alignItems: 'center', width: '72%', marginTop: 22 }, heroRouteDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A8C2C5' }, heroRouteLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.23)' }, heroRouteStar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }, heroRouteStarText: { color: colors.navyDeep, fontWeight: '900' },
  incomingCard: { borderRadius: radius.lg, padding: 19, overflow: 'hidden' }, incomingBubble: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)', right: -25, top: -25 }, incomingEyebrow: { color: '#785832', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, incomingTitle: { color: colors.navyDeep, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 4, maxWidth: '82%' }, incomingMessage: { color: '#705A42', fontSize: 12, lineHeight: 18, marginTop: 4 }, incomingActions: { flexDirection: 'row', gap: 8, marginTop: 14 }, hereButton: { flex: 1, minHeight: 45, borderRadius: radius.md, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' }, hereText: { color: colors.white, fontWeight: '900', fontSize: 12 }, laterButton: { flex: 1, minHeight: 45, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.52)', alignItems: 'center', justifyContent: 'center' }, laterText: { color: colors.navyDeep, fontWeight: '900', fontSize: 12 },
  quickGrid: { flexDirection: 'row', gap: 10 }, quickPressable: { flex: 1 }, quickCard: { minHeight: 220, borderRadius: radius.lg, padding: 16, overflow: 'hidden' }, quickDecorOne: { position: 'absolute', width: 84, height: 60, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.21)', right: -18, top: 20 }, quickDecorTwo: { position: 'absolute', width: 36, height: 28, borderRadius: 11, backgroundColor: 'rgba(7,31,42,0.10)', right: 44, top: 72 }, compassRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', right: -25, top: -20, alignItems: 'center', justifyContent: 'center' }, compassNeedle: { color: 'rgba(255,255,255,0.25)', fontSize: 55, transform: [{ rotate: '-25deg' }] }, quickIcon: { fontSize: 25 }, quickTitle: { color: colors.navyDeep, fontSize: 24, lineHeight: 24, fontWeight: '900', marginTop: 23, letterSpacing: -0.6 }, quickTitleLight: { color: colors.white }, quickText: { color: '#6E5434', fontSize: 10, lineHeight: 15, fontWeight: '700', marginTop: 8 }, quickTextLight: { color: '#FFF1E9' }, quickArrow: { color: colors.navyDeep, fontSize: 24, fontWeight: '900', marginTop: 'auto' }, quickArrowLight: { color: colors.white },
  advicePanel: { backgroundColor: colors.paper, borderRadius: radius.lg, padding: 16, gap: 11, borderWidth: 1, borderColor: colors.lineWarm }, panelKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.sandWarm }, chipActive: { backgroundColor: colors.amber }, chipText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, chipTextActive: { color: colors.navyDeep }, input: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.sand, paddingHorizontal: 13, color: colors.text, borderWidth: 1, borderColor: colors.lineWarm }, sendAdvice: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }, sendAdviceText: { color: colors.white, fontWeight: '900' },
  sectionHead: { marginTop: 3 }, kickerDark: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.15 }, sectionTitle: { color: colors.navyDeep, fontSize: 23, fontWeight: '900', marginTop: 2 }, storyGrid: { flexDirection: 'row', gap: 10 }, storyTile: { flex: 1, minHeight: 205, borderRadius: radius.lg, padding: 16, overflow: 'hidden' }, voiceTile: { backgroundColor: '#DCEEF1' }, dayTile: { backgroundColor: '#FFF0CF' }, voiceWaves: { position: 'absolute', right: 11, top: 18, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.3 }, waveSmall: { width: 3, height: 15, borderRadius: 2, backgroundColor: colors.teal }, waveMid: { width: 3, height: 28, borderRadius: 2, backgroundColor: colors.teal }, waveTall: { width: 3, height: 39, borderRadius: 2, backgroundColor: colors.teal }, paperLines: { position: 'absolute', color: 'rgba(201,135,34,0.15)', fontSize: 90, right: 12, top: 6, fontWeight: '900' }, storyIcon: { fontSize: 25 }, storyTitle: { color: colors.navyDeep, fontSize: 19, lineHeight: 20, fontWeight: '900', marginTop: 19 }, storyText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 7 }, tileArrow: { marginTop: 'auto', color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  questionCard: { minHeight: 245, borderRadius: radius.xl, padding: 20, overflow: 'hidden' }, quoteGlyph: { position: 'absolute', color: 'rgba(255,255,255,0.16)', fontSize: 130, right: 16, top: -2, fontWeight: '900' }, questionKicker: { color: '#E8E5F8', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, question: { color: colors.white, fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 28, maxWidth: '90%' }, questionActions: { flexDirection: 'row', gap: 8, marginTop: 'auto' }, questionSecondary: { flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }, questionSecondaryText: { color: colors.white, fontSize: 11, fontWeight: '900' }, questionPrimary: { flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, questionPrimaryText: { color: colors.purple, fontSize: 11, fontWeight: '900' },
  missionCard: { minHeight: 245, borderRadius: radius.xl, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, padding: 20, overflow: 'hidden' }, missionDecor: { position: 'absolute', width: 92, height: 92, borderRadius: 46, backgroundColor: colors.mint, right: -12, top: -14, alignItems: 'center', justifyContent: 'center' }, missionDecorText: { color: colors.green, fontSize: 38, opacity: 0.5 }, missionTeam: { color: colors.green, fontSize: 11, fontWeight: '900', marginTop: 5 }, missionTitle: { color: colors.navyDeep, fontSize: 21, lineHeight: 26, fontWeight: '900', marginTop: 22, maxWidth: '82%' }, missionDetail: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6, maxWidth: '90%' }, missionMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 }, reward: { backgroundColor: '#FFF0CF', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 }, rewardText: { color: '#8A5D12', fontSize: 11, fontWeight: '900' }, due: { color: colors.muted, fontSize: 10, fontWeight: '800' }, completeButton: { minHeight: 47, marginTop: 12, borderRadius: radius.md, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, completeText: { color: colors.white, fontSize: 12, fontWeight: '900' }, createMission: { minHeight: 47, alignSelf: 'stretch', marginTop: 16, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }, createMissionText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  recentCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: colors.lineWarm }, recentTitle: { color: colors.navyDeep, fontSize: 22, fontWeight: '900', marginTop: 2, marginBottom: 14 }, recentRow: { flexDirection: 'row', minHeight: 58 }, recentRail: { width: 25, alignItems: 'center' }, recentDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.amber, marginTop: 4 }, recentLine: { width: 1, flex: 1, backgroundColor: colors.lineWarm, marginVertical: 3 }, recentContent: { flex: 1, paddingLeft: 5, paddingBottom: 12 }, recentTime: { color: colors.mutedSoft, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }, recentText: { color: colors.text, fontSize: 11, lineHeight: 16, marginTop: 2 }, disabled: { opacity: 0.5 },
});
