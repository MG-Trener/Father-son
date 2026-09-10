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
import { router } from 'expo-router';
import { AppCard } from '../../components/AppCard';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { notifyFamilyEvent } from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabase';
import { colors, radius } from '../../theme';

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
  payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}
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
  if (Number.isNaN(date.getTime())) return 'без срока';
  return `до ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
};

const timeLabel = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
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

  const names = useMemo(
    () => new Map(members.map((member) => [member.user_id, member.display_name])),
    [members],
  );
  const other = useMemo(
    () => members.find((member) => member.user_id !== me?.user_id) ?? null,
    [members, me],
  );
  const teamTitle = members.length >= 2
    ? `${members[0]?.display_name ?? 'Михаил'} + ${members[1]?.display_name ?? 'Артур'}`
    : family?.name ?? 'Папа & Я';

  const respondedSignalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of recentEvents) {
      if (event.event_type !== 'connection_response') continue;
      const signalId = payloadText(event.payload, 'signal_event_id');
      if (signalId) ids.add(signalId);
    }
    return ids;
  }, [recentEvents]);

  const pendingSignal = useMemo(
    () => recentEvents.find((event) => (
      (event.event_type === 'five_minutes_ping' || event.event_type === 'advice_requested')
      && event.actor_user_id !== me?.user_id
      && !respondedSignalIds.has(event.id)
    )) ?? null,
    [recentEvents, me, respondedSignalIds],
  );

  const load = useCallback(async () => {
    if (!supabase || !family) {
      setLoading(false);
      return;
    }

    const [missionResult, eventsResult] = await Promise.all([
      supabase
        .from('missions')
        .select('id,title,description,xp_reward,due_at,created_by,assigned_to')
        .eq('family_id', family.id)
        .eq('category', 'together')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('activity_events')
        .select('id,actor_user_id,event_type,occurred_at,payload')
        .eq('family_id', family.id)
        .in('event_type', ['five_minutes_ping', 'advice_requested', 'reflection_added', 'connection_response', 'voice_story_added'])
        .order('occurred_at', { ascending: false })
        .limit(20),
    ]);

    if (!missionResult.error) setMission((missionResult.data as TogetherMission | null) ?? null);
    if (!eventsResult.error) setRecentEvents((eventsResult.data ?? []) as RecentEvent[]);
    setLoading(false);
  }, [family]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
      if (signalType === 'five_minutes') {
        Alert.alert('Отправлено', `${other?.display_name ?? 'Второй участник'} увидит, что у тебя есть несколько минут на связь.`);
      } else {
        setAdviceOpen(false);
        setAdviceNote('');
        Alert.alert('Запрос сохранён', `${other?.display_name ?? 'Второй участник'} увидит, что тебе нужен совет.`);
      }
    } catch (caught) {
      Alert.alert('Не удалось отправить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const respondToSignal = async (response: 'here' | 'later') => {
    if (!supabase || !pendingSignal || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('respond_connection_signal', {
        p_signal_event_id: pendingSignal.id,
        p_response: response,
      });
      if (error) throw error;
      const eventId = rpcEventId(data);
      if (eventId) void notifyFamilyEvent(eventId);
      await load();
      Alert.alert(
        response === 'here' ? 'Ответ отправлен' : 'Хорошо',
        response === 'here' ? 'Второй участник увидит: «Я рядом».': 'Второй участник увидит, что ты ответишь чуть позже.',
      );
    } catch (caught) {
      Alert.alert('Не удалось ответить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const drawQuestion = () => {
    const alternatives = questionDeck.filter((item) => item !== question);
    const pool = alternatives.length ? alternatives : questionDeck;
    const next = pool[Math.floor(Math.random() * pool.length)];
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
      Alert.alert(
        'Миссия выполнена',
        achievement ? `+${mission.xp_reward} XP. Открыто достижение «${achievement}».` : `+${mission.xp_reward} XP вашей команде.`,
      );
    } catch (caught) {
      Alert.alert('Не удалось завершить миссию', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const canCompleteMission = Boolean(
    session && mission && (mission.created_by === session.user.id || mission.assigned_to === session.user.id),
  );

  const eventSummary = (event: RecentEvent) => {
    const actor = event.actor_user_id ? names.get(event.actor_user_id) ?? 'Участник команды' : 'Команда';
    if (event.event_type === 'five_minutes_ping') return `${actor}: есть 5 минут на связь`;
    if (event.event_type === 'advice_requested') {
      const message = payloadText(event.payload, 'message');
      return `${actor}: нужен совет${message ? ` · ${message}` : ''}`;
    }
    if (event.event_type === 'connection_response') {
      const response = payloadText(event.payload, 'response');
      return `${actor}: ${response === 'here' ? 'я рядом' : 'отвечу чуть позже'}`;
    }
    if (event.event_type === 'voice_story_added') {
      const title = payloadText(event.payload, 'title');
      return `${actor} оставил голосовую историю${title ? ` · ${title}` : ''}`;
    }
    const preview = payloadText(event.payload, 'preview');
    return `${actor} сохранил историю${preview ? ` · ${preview}` : ''}`;
  };

  const pendingActor = pendingSignal?.actor_user_id ? names.get(pendingSignal.actor_user_id) ?? 'Второй участник' : 'Второй участник';
  const pendingMessage = pendingSignal?.event_type === 'advice_requested'
    ? payloadText(pendingSignal.payload, 'message')
    : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.navy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <Text style={styles.title}>Вместе</Text>
        <Text style={styles.subtitle}>Поводы быть ближе, даже когда вы в разных местах.</Text>

        {pendingSignal ? (
          <View style={styles.incomingCard}>
            <Text style={styles.incomingEyebrow}>ВХОДЯЩИЙ СИГНАЛ</Text>
            <Text style={styles.incomingTitle}>
              {pendingSignal.event_type === 'five_minutes_ping' ? `${pendingActor}: есть 5 минут?` : `${pendingActor}: мне нужен совет`}
            </Text>
            {pendingMessage ? <Text style={styles.incomingMessage}>{pendingMessage}</Text> : null}
            <View style={styles.incomingActions}>
              <Pressable style={styles.hereButton} disabled={busy} onPress={() => void respondToSignal('here')}>
                <Text style={styles.hereText}>Я рядом</Text>
              </Pressable>
              <Pressable style={styles.laterButton} disabled={busy} onPress={() => void respondToSignal('later')}>
                <Text style={styles.laterText}>Чуть позже</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable style={styles.action} disabled={busy} onPress={() => void sendSignal('five_minutes')}>
          <Text style={styles.actionIcon}>⏱</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Есть 5 минут?</Text>
            <Text style={styles.actionDetail}>Мягко позвать друг друга поговорить или сыграть</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <Pressable style={styles.action} disabled={busy} onPress={() => setAdviceOpen((value) => !value)}>
          <Text style={styles.actionIcon}>🧭</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Мне нужен совет</Text>
            <Text style={styles.actionDetail}>Без объяснений на полстраницы — просто дать понять, что нужна связь</Text>
          </View>
          <Text style={styles.arrow}>{adviceOpen ? '⌄' : '›'}</Text>
        </Pressable>

        {adviceOpen ? (
          <View style={styles.inlinePanel}>
            <Text style={styles.panelLabel}>О чём?</Text>
            <View style={styles.chips}>
              {adviceTopics.map((topic) => (
                <Pressable
                  key={topic}
                  onPress={() => setAdviceTopic(topic)}
                  style={[styles.chip, adviceTopic === topic && styles.chipActive]}
                >
                  <Text style={[styles.chipText, adviceTopic === topic && styles.chipTextActive]}>{topic}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={adviceNote}
              onChangeText={setAdviceNote}
              placeholder="Можно добавить пару слов — необязательно"
              placeholderTextColor={colors.muted}
              style={styles.input}
              maxLength={420}
            />
            <Pressable
              disabled={busy}
              onPress={() => void sendSignal('advice', `${adviceTopic}${adviceNote.trim() ? `: ${adviceNote.trim()}` : ''}`)}
              style={[styles.primary, busy && styles.disabled]}
            >
              <Text style={styles.primaryText}>{busy ? 'Отправляем…' : 'Попросить совета'}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={styles.action}
          onPress={() => router.push({ pathname: '/reflection-new', params: { mode: 'story' } })}
        >
          <Text style={styles.actionIcon}>✍️</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>История дня</Text>
            <Text style={styles.actionDetail}>Сохранить момент, мысль или маленькую историю друг для друга</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => router.push('/voice-story-new')}>
          <Text style={styles.actionIcon}>🎙</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Голосовая история</Text>
            <Text style={styles.actionDetail}>Записать голосом момент, который останется в вашей общей летописи</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={drawQuestion}>
          <Text style={styles.actionIcon}>🎲</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Не знаем, о чём говорить</Text>
            <Text style={styles.actionDetail}>Получить новый вопрос, который не похож на «как дела?»</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <AppCard title="Вопрос для разговора" subtitle="Можно ответить сейчас или оставить на встречу">
          <Text style={styles.question}>{question}</Text>
          <View style={styles.questionActions}>
            <Pressable style={styles.secondary} onPress={drawQuestion}>
              <Text style={styles.secondaryText}>Другой вопрос</Text>
            </Pressable>
            <Pressable
              style={styles.primarySmall}
              onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: question } })}
            >
              <Text style={styles.primaryText}>Ответить</Text>
            </Pressable>
          </View>
        </AppCard>

        <AppCard title="Совместная миссия" subtitle={teamTitle}>
          {mission ? (
            <>
              <Text style={styles.mission}>{mission.title}</Text>
              {mission.description ? <Text style={styles.missionDetail}>{mission.description}</Text> : null}
              <View style={styles.missionMeta}>
                <View style={styles.reward}><Text style={styles.rewardText}>+{mission.xp_reward} XP</Text></View>
                <Text style={styles.due}>{prettyDue(mission.due_at)}</Text>
              </View>
              {canCompleteMission ? (
                <Pressable
                  style={[styles.completeButton, busy && styles.disabled]}
                  disabled={busy}
                  onPress={() => void completeMission()}
                >
                  <Text style={styles.completeText}>{busy ? 'Сохраняем…' : '✓ Мы это сделали'}</Text>
                </Pressable>
              ) : (
                <Text style={styles.note}>Завершить может автор миссии или тот, кому она назначена.</Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.mission}>Придумайте небольшое общее дело, которое можно закончить за несколько дней.</Text>
              <Text style={styles.missionDetail}>Например: сыграть партию и выбрать лучший ход соперника, приготовить одно блюдо одновременно или посмотреть один фильм и обменяться тремя мыслями.</Text>
              <Pressable
                style={styles.primary}
                onPress={() => router.push({ pathname: '/mission-new', params: { category: 'together' } })}
              >
                <Text style={styles.primaryText}>Создать совместную миссию</Text>
              </Pressable>
            </>
          )}
        </AppCard>

        {recentEvents.length ? (
          <AppCard title="Последние сигналы" subtitle="Коротко, без ощущения контроля">
            <View style={styles.recentList}>
              {recentEvents.slice(0, 6).map((event) => (
                <View key={event.id} style={styles.recentRow}>
                  <Text style={styles.recentTime}>{timeLabel(event.occurred_at)}</Text>
                  <Text style={styles.recentText}>{eventSummary(event)}</Text>
                </View>
              ))}
            </View>
          </AppCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 32, gap: 14 },
  title: { color: colors.navyDeep, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -7, marginBottom: 4 },
  incomingCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 18, gap: 8 },
  incomingEyebrow: { color: '#C9D7D7', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  incomingTitle: { color: colors.white, fontSize: 21, lineHeight: 27, fontWeight: '900' },
  incomingMessage: { color: '#E7EEEE', fontSize: 13, lineHeight: 19 },
  incomingActions: { flexDirection: 'row', gap: 9, marginTop: 4 },
  hereButton: { flex: 1, minHeight: 43, borderRadius: radius.md, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  hereText: { color: colors.navyDeep, fontWeight: '900', fontSize: 13 },
  laterButton: { flex: 1, minHeight: 43, borderRadius: radius.md, borderWidth: 1, borderColor: '#6E8587', alignItems: 'center', justifyContent: 'center' },
  laterText: { color: colors.white, fontWeight: '900', fontSize: 13 },
  action: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, flexDirection: 'row', alignItems: 'center' },
  actionIcon: { fontSize: 25, width: 43 },
  actionText: { flex: 1 },
  actionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  actionDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  arrow: { color: colors.muted, fontSize: 26 },
  inlinePanel: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 15, gap: 11, marginTop: -7 },
  panelLabel: { color: colors.text, fontWeight: '900', fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: '#FFF0CF', borderColor: colors.amber },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: colors.navyDeep },
  input: { minHeight: 47, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 13, backgroundColor: colors.white, color: colors.text, fontSize: 14 },
  primary: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primarySmall: { minHeight: 42, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, flex: 1 },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 13 },
  secondary: { minHeight: 42, borderRadius: radius.md, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, flex: 1 },
  secondaryText: { color: colors.navy, fontWeight: '900', fontSize: 13 },
  disabled: { opacity: 0.5 },
  question: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  questionActions: { flexDirection: 'row', gap: 9 },
  mission: { color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: '900' },
  missionDetail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  missionMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reward: { alignSelf: 'flex-start', backgroundColor: '#FFF0CF', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  rewardText: { color: '#8A5D12', fontSize: 12, fontWeight: '900' },
  due: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  completeButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: '#DCECE3', alignItems: 'center', justifyContent: 'center' },
  completeText: { color: colors.green, fontSize: 14, fontWeight: '900' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  recentList: { gap: 10 },
  recentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  recentTime: { width: 49, color: colors.muted, fontSize: 10, fontWeight: '800', paddingTop: 2 },
  recentText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18 },
});
