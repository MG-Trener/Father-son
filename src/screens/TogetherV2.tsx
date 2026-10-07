import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { ActionRow, Button, Card, Chip, Heading, LoadError, Page, Section, ui } from '../components/Everyday';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { useFamilyPresentation } from '../hooks/useFamilyPresentation';
import { notifyFamilyEvent } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { brandAssets } from '../brandAssets';

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

const artwork = {
  together: require('../../assets/generated/nav-together.png'),
  recognition: require('../../assets/generated/utility-recognition.png'),
  calendar: require('../../assets/generated/utility-calendar.png'),
  voice: require('../../assets/generated/utility-voice.png'),
  goal: require('../../assets/generated/utility-goal.png'),
  team: require('../../assets/generated/badge-team.png'),
  book: require('../../assets/generated/nav-book.png'),
} as const;

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
  const { other, isChild, otherName } = useFamilyPresentation();
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const [mission, setMission] = useState<TogetherMission | null>(null);
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [question, setQuestion] = useState(questions[0] ?? 'О чём хочется поговорить сегодня?');
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [adviceTopic, setAdviceTopic] = useState('Просто поговорить');
  const [adviceNote, setAdviceNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    try {
      const [missionResult, eventsResult] = await Promise.all([
        supabase.from('missions').select('id,title,description,xp_reward,due_at,created_by,assigned_to').eq('family_id', family.id).eq('category', 'together').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('activity_events').select('id,actor_user_id,event_type,occurred_at,payload').eq('family_id', family.id).in('event_type', ['five_minutes_ping', 'advice_requested', 'reflection_added', 'connection_response', 'voice_story_added']).order('occurred_at', { ascending: false }).limit(24),
      ]);
      if (missionResult.error || eventsResult.error) throw missionResult.error ?? eventsResult.error;
      setMission((missionResult.data as TogetherMission | null) ?? null);
      setEvents((eventsResult.data ?? []) as RecentEvent[]);
    } catch { setLoadError('Не удалось обновить ответы и общие дела. Проверьте интернет.'); }
    finally { setLoading(false); }
  }, [family]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

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
      Alert.alert(type === 'five_minutes' ? 'Сигнал отправлен ✦' : 'Запрос отправлен', `${otherName} увидит приглашение в разделе «Вместе», когда откроет приложение.`);
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
      Alert.alert(response === 'here' ? 'Я рядом' : 'Ответ отправлен', response === 'here' ? 'Можно созвониться или написать прямо сейчас.' : 'Второй участник увидит, что ты ответишь чуть позже.');
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
      Alert.alert('Общая миссия выполнена ✦', achievement ? `Открыта веха «${achievement}».` : 'Ваше общее дело сохранено в истории.');
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

  const pendingActor = pendingSignal?.actor_user_id ? names.get(pendingSignal.actor_user_id) ?? otherName : otherName;
  const pendingMessage = pendingSignal?.event_type === 'advice_requested' ? payloadText(pendingSignal.payload, 'message') : null;

  return <Page refreshing={refreshing || loading} onRefresh={onRefresh}>
    <Heading title="Вместе" subtitle={isChild ? 'Поговорить с папой, договориться о встрече, сделать что-то вместе.' : 'Быть рядом с сыном: слушать, поддерживать и находить время друг для друга.'} />
    {loadError ? <LoadError message={loadError} retry={() => void load()} /> : null}
    {pendingSignal ? <Card tone="warm">
      <Text style={ui.sectionTitle}>{pendingActor} хочет поговорить</Text>
      <Text style={ui.body}>{pendingMessage || 'Есть пять минут друг для друга?'}</Text>
      <Text style={ui.caption}>{timeLabel(pendingSignal.occurred_at)}</Text>
      <Button label="Я рядом, можем поговорить" busy={busy} onPress={() => void respond('here')} />
      <Button label="Смогу чуть позже" secondary disabled={busy} onPress={() => void respond('later')} />
    </Card> : null}
    <Card tone="warm">
      <Text style={ui.sectionTitle}>{isChild ? 'Папа, есть минутка?' : 'Найдём время поговорить?'}</Text>
      <Text style={ui.body}>Отправь приглашение. Когда второй участник откроет приложение, он сможет ответить: «Я рядом» или «Чуть позже».</Text>
      {!other ? <Text style={ui.caption}>Разговоры станут доступны после подключения второго участника в настройках.</Text> : null}
      <Button label={isChild ? 'Позвать папу на разговор' : 'Позвать сына на разговор'} disabled={!other} busy={busy} onPress={() => void sendSignal('five_minutes')} />
      <Button label={adviceOpen ? 'Закрыть тему разговора' : 'Хочу обсудить кое-что'} secondary onPress={() => setAdviceOpen(!adviceOpen)} />
      {adviceOpen ? <View style={ui.stack}>
        <Text style={ui.rowTitle}>О чём поговорим?</Text>
        <View style={ui.wrap}>{adviceTopics.map(topic => <Chip key={topic} label={topic} selected={adviceTopic === topic} onPress={() => setAdviceTopic(topic)} />)}</View>
        <TextInput accessibilityLabel="Тема разговора — подробности" style={[ui.input, ui.textArea]} multiline value={adviceNote} onChangeText={setAdviceNote} placeholder="Можно добавить пару слов" placeholderTextColor="#697A80" maxLength={1000} />
        <Button label="Отправить тему" busy={busy} disabled={!other} onPress={() => void sendSignal('advice', [adviceTopic, adviceNote.trim()].filter(Boolean).join(': '))} />
      </View> : null}
    </Card>
    <Section title="Наше время">
      <ActionRow title="Встречи и планы" description="Выбрать день и придумать, что сделаем" image={artwork.calendar} to="/meeting-plan" />
      <ActionRow title="Общие привычки" description="Маленькие дела, которые нас сближают" image={brandAssets.actions.rituals} to="/rituals" />
      <ActionRow title="Наши договорённости" description="Обсудить правила, удобные обоим" image={brandAssets.utility.agreements} to="/agreements" />
      <ActionRow title="Сказать спасибо" description="Замечать заботу, смелость и старание" image={artwork.recognition} to="/recognitions" />
      <ActionRow title="Идеи для разговоров" description="Выбрать тему и узнать друг друга лучше" to="/conversation-cards" />
      <ActionRow title="Наш месяц" description="Встречи и общие дела за месяц" to="/month-together" />
    </Section>
    {mission ? <Card tone="mint">
      <Text style={ui.caption}>Наше общее дело</Text><Text style={ui.sectionTitle}>{mission.title}</Text>
      {mission.description ? <Text style={ui.body}>{mission.description}</Text> : null}
      <Button label="Мы это сделали" busy={busy} onPress={() => void completeMission()} />
    </Card> : null}
    <ActionRow title="Придумать общее дело" description="Одна цель для вас двоих" to={{ pathname: '/mission-new', params: { category: 'together' } }} />
    <Card><Text style={ui.sectionTitle}>Если не знаем, с чего начать</Text><Text style={ui.body}>{question}</Text><Button secondary label="Другой вопрос" onPress={drawQuestion} /></Card>
    {events.length ? <Section title="Последние отклики">{events.slice(0, 3).map(event => <Card key={event.id}><Text style={ui.rowTitle}>{eventSummary(event)}</Text><Text style={ui.caption}>{timeLabel(event.occurred_at)}</Text></Card>)}</Section> : null}
  </Page>;
}
