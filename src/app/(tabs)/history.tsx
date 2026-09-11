import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../lib/supabase';
import { colors, gradients, moduleColors, radius, shadows } from '../../theme';

type TimelineEvent = {
  id: string;
  actor_user_id: string | null;
  event_type: string;
  category: string | null;
  occurred_at: string;
  payload: unknown;
};

const growthMeta: Record<string, { icon: string; title: string; color: string; base: string }> = {
  school: { icon: '📚', title: 'Школа', color: moduleColors.school.strong, base: moduleColors.school.base },
  football: { icon: '⚽', title: 'Футбол', color: moduleColors.football.strong, base: moduleColors.football.base },
  chess: { icon: '♟', title: 'Шахматы', color: moduleColors.chess.strong, base: moduleColors.chess.base },
  english: { icon: 'EN', title: 'English', color: moduleColors.english.strong, base: moduleColors.english.base },
  leadership: { icon: '🧭', title: 'Лидерство', color: moduleColors.leadership.strong, base: moduleColors.leadership.base },
};

const moodLabels: Record<string, string> = {
  great: 'Отлично', good: 'Хорошо', ok: 'Нормально', tired: 'Устал', sad: 'Грустно', angry: 'Злюсь',
};

const payloadRecord = (payload: unknown): Record<string, unknown> => payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
const payloadText = (payload: unknown, key: string) => typeof payloadRecord(payload)[key] === 'string' ? payloadRecord(payload)[key] as string : null;
const payloadNumber = (payload: unknown, key: string) => typeof payloadRecord(payload)[key] === 'number' ? payloadRecord(payload)[key] as number : null;

const durationLabel = (millis: number | null) => {
  if (millis === null) return null;
  const totalSeconds = Math.max(0, Math.round(millis / 1000));
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
};

type EventView = { icon: string; title: string; text: string; color: string; base: string };

const eventView = (event: TimelineEvent, actorName: string): EventView => {
  const title = payloadText(event.payload, 'title');
  const xp = payloadNumber(event.payload, 'xp_reward');
  const defaultVisual = { color: colors.teal, base: '#DCECEF' };
  switch (event.event_type) {
    case 'family_created': return { icon: '❤️', title: 'Команда создана', text: `${actorName} открыл вашу общую историю.`, color: colors.coral, base: colors.rose };
    case 'family_joined': return { icon: '🤝', title: 'Команда в сборе', text: `${actorName} присоединился к «Папа & Я».`, color: colors.green, base: colors.mint };
    case 'five_minutes_ping': return { icon: '💬', title: 'Есть 5 минут?', text: `${actorName} предложил немного побыть вместе.`, color: colors.orange, base: '#FFF0CF' };
    case 'advice_requested': {
      const message = payloadText(event.payload, 'message');
      return { icon: '🧭', title: 'Нужен совет', text: message ? `${actorName}: ${message}` : `${actorName} попросил помочь советом.`, color: colors.coral, base: colors.rose };
    }
    case 'connection_response': {
      const response = payloadText(event.payload, 'response');
      return { icon: response === 'here' ? '🤝' : '🕒', title: response === 'here' ? 'Я рядом' : 'Чуть позже', text: response === 'here' ? `${actorName} ответил, что сейчас на связи.` : `${actorName} увидел сигнал и ответит позже.`, color: colors.green, base: colors.mint };
    }
    case 'reflection_added': {
      const preview = payloadText(event.payload, 'preview');
      const prompt = payloadText(event.payload, 'prompt');
      return { icon: '✍️', title: prompt ? 'Ответ друг другу' : 'История дня', text: preview ? `${actorName}: ${preview}` : `${actorName} сохранил новый момент.`, color: colors.purple, base: colors.lavender };
    }
    case 'voice_story_added': {
      const duration = durationLabel(payloadNumber(event.payload, 'duration_ms'));
      return { icon: '🎙', title: title || 'Голосовая история', text: `${actorName} сохранил голосовой момент${duration ? ` · ${duration}` : ''}.`, color: colors.teal, base: '#DCEEF1' };
    }
    case 'growth_entry_added': {
      const category = event.category ? growthMeta[event.category] : null;
      const label = category?.title ?? 'Развитие';
      return { icon: category?.icon ?? '🌱', title: title || label, text: `${actorName} добавил новый момент в «${label}».`, color: category?.color ?? defaultVisual.color, base: category?.base ?? defaultVisual.base };
    }
    case 'meeting_created': return { icon: '📅', title: 'Запланирована встреча', text: title ? `${actorName} запланировал «${title}».` : `${actorName} добавил следующую встречу.`, color: colors.blue, base: colors.sky };
    case 'meeting_completed': return { icon: '🤝', title: title ? `Встреча: ${title}` : 'Встреча состоялась', text: `${actorName} сохранил эту встречу в вашей общей истории.`, color: colors.green, base: colors.mint };
    case 'mood_shared': {
      const mood = payloadText(event.payload, 'mood');
      const label = mood ? moodLabels[mood] : null;
      return { icon: '♥', title: 'Как мы?', text: label ? `${actorName} поделился состоянием: «${label}».` : `${actorName} оставил короткий сигнал о своём состоянии.`, color: colors.teal, base: '#DDEDEF' };
    }
    case 'ritual_moment_added': {
      const symbol = payloadText(event.payload, 'symbol') || '✦';
      return { icon: symbol, title: title || 'Наш ритуал', text: title ? `${actorName} отметил: «${title}» снова случилось сегодня.` : `${actorName} сохранил ещё один момент вашей традиции.`, color: colors.orange, base: '#FFF0CF' };
    }
    case 'weekly_focus_added': {
      const scope = payloadText(event.payload, 'scope');
      const category = event.category ? growthMeta[event.category] : null;
      return { icon: scope === 'together' ? '◎' : category?.icon ?? '◎', title: scope === 'together' ? 'Наш фокус недели' : 'Фокус недели', text: title ? `${actorName} выбрал ориентир: «${title}».` : `${actorName} выбрал спокойный ориентир на эту неделю.`, color: category?.color ?? colors.teal, base: category?.base ?? '#DCECEF' };
    }
    case 'agreement_proposed': return { icon: '🤝', title: 'Предложена договорённость', text: title ? `${actorName} предложил: «${title}».` : `${actorName} предложил новую взаимную договорённость.`, color: '#A56E16', base: '#FFF0CF' };
    case 'agreement_activated': return { icon: '✓', title: 'Мы договорились', text: title ? `Оба подтвердили: «${title}».` : 'Договорённость подтверждена обоими участниками.', color: colors.green, base: colors.mint };
    case 'agreement_archived': return { icon: '○', title: 'Договорённость завершена', text: title ? `${actorName} убрал «${title}» из действующих договорённостей.` : `${actorName} завершил одну из прежних договорённостей.`, color: colors.muted, base: colors.sandWarm };
    case 'mission_created': return { icon: '🎯', title: 'Новая миссия', text: title ? `${actorName} запустил миссию «${title}».` : `${actorName} добавил новую миссию.`, color: colors.orange, base: '#FFF0CF' };
    case 'mission_completed': return { icon: '✓', title: title ? `Миссия: ${title}` : 'Миссия выполнена', text: `${actorName} завершил шаг${xp !== null ? ` · +${xp} XP` : ''}.`, color: colors.green, base: colors.mint };
    case 'achievement_awarded': return { icon: '🏅', title: 'Новое достижение', text: title ? `Открыто достижение «${title}».` : 'Открыто новое достижение.', color: '#C98722', base: '#FFF0C2' };
    case 'recognition_added': {
      const quality = payloadText(event.payload, 'quality');
      return { icon: '✦', title: title || 'Я заметил', text: quality ? `${actorName} отметил качество «${quality}» и сохранил конкретный момент.` : `${actorName} заметил важный поступок другого участника команды.`, color: colors.purple, base: colors.lavender };
    }
    default: return { icon: '✦', title: 'Момент команды', text: `${actorName} добавил новое событие.`, ...defaultVisual };
  }
};

const formatDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return `Сегодня · ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return age;
};

export default function HistoryScreen() {
  const { family, members } = useFamily();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase && family));
  const [refreshing, setRefreshing] = useState(false);
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child'), [members]);
  const childAge = ageFromBirthDate(child?.birth_date ?? null);

  const loadEvents = useCallback(async () => {
    if (!supabase || !family) { setLoading(false); return; }
    const { data, error } = await supabase.from('activity_events').select('id,actor_user_id,event_type,category,occurred_at,payload').eq('family_id', family.id).order('occurred_at', { ascending: false }).limit(80);
    if (!error) setEvents((data ?? []) as TimelineEvent[]);
    setLoading(false);
  }, [family]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);
  const onRefresh = async () => { setRefreshing(true); await loadEvents(); setRefreshing(false); };
  const ages = [11, 12, 13, 14, 15, 16, 17, 18];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}>
        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroSun} /><View style={styles.heroRing} />
          <Text style={styles.heroKicker}>НАША ЛЕТОПИСЬ</Text>
          <Text style={styles.heroTitle}>{child?.display_name ?? 'Артур'}{childAge !== null ? ` · ${childAge}` : ''}</Text>
          <Text style={styles.heroSubtitle}>Первая глава · Исследователь</Text>
          <Text style={styles.heroText}>Не отчёт и не рейтинг. Здесь остаются голоса, встречи, игры, сложные моменты и то, как вы оба меняетесь.</Text>
          <View style={styles.agePath}>
            {ages.map((age, index) => {
              const active = childAge === age;
              const past = childAge !== null && age < childAge;
              return (
                <View key={age} style={styles.agePart}>
                  <View style={[styles.ageDot, (past || active) && styles.ageDotPast, active && styles.ageDotActive]}><Text style={[styles.ageText, (past || active) && styles.ageTextPast]}>{age}</Text></View>
                  {index < ages.length - 1 ? <View style={[styles.ageLine, past && styles.ageLinePast]} /> : null}
                </View>
              );
            })}
          </View>
        </LinearGradient>

        <View style={styles.sectionHead}><View><Text style={styles.eyebrow}>ХРОНОЛОГИЯ</Text><Text style={styles.sectionTitle}>Моменты пути</Text></View><View style={styles.countBadge}><Text style={styles.countText}>{events.length}</Text></View></View>
        {loading ? <ActivityIndicator size="large" color={colors.navy} style={styles.loader} /> : events.length ? (
          <View style={styles.timeline}>{events.map((event, index) => {
            const actorName = event.actor_user_id ? names.get(event.actor_user_id) ?? 'Кто-то из команды' : 'Команда';
            const view = eventView(event, actorName);
            return <View key={event.id} style={styles.event}><View style={styles.rail}><View style={[styles.iconBubble, { backgroundColor: view.base }]}><Text style={[styles.icon, { color: view.color }]}>{view.icon}</Text></View>{index < events.length - 1 ? <View style={styles.line} /> : null}</View><View style={[styles.eventCard, shadows.soft]}><View style={styles.eventHead}><Text style={styles.date}>{formatDate(event.occurred_at)}</Text><View style={[styles.categoryMark, { backgroundColor: view.color }]} /></View><Text style={styles.eventTitle}>{view.title}</Text><Text style={styles.eventText}>{view.text}</Text><View style={styles.eventFoot}><Text style={[styles.actor, { color: view.color }]}>{actorName}</Text><Text style={styles.footArrow}>↗</Text></View></View></View>;
          })}</View>
        ) : <View style={[styles.emptyCard, shadows.soft]}><View style={styles.emptyPlanet}><Text style={styles.emptyPlanetText}>✦</Text></View><Text style={styles.emptyTitle}>История начинается сейчас</Text><Text style={styles.emptyText}>Первый разговор, миссия, встреча или голосовая история автоматически станет первой точкой вашего маршрута.</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 38, gap: 19 },
  hero: { minHeight: 325, borderRadius: radius.xl, padding: 22, overflow: 'hidden' }, heroSun: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,215,106,0.10)', right: -48, top: -60 }, heroRing: { position: 'absolute', width: 125, height: 125, borderRadius: 63, borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)', right: 25, top: 25 }, heroKicker: { color: '#BDD2D4', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 7 }, heroTitle: { color: colors.white, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 5 }, heroSubtitle: { color: colors.sun, fontSize: 12, fontWeight: '900', marginTop: 3 }, heroText: { color: '#D8E5E6', fontSize: 11, lineHeight: 17, maxWidth: '76%', marginTop: 18 },
  agePath: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', paddingTop: 25 }, agePart: { flex: 1, flexDirection: 'row', alignItems: 'center' }, ageDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }, ageDotPast: { backgroundColor: 'rgba(255,255,255,0.16)' }, ageDotActive: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.amber, borderColor: colors.sun }, ageText: { color: '#91AEB2', fontSize: 8, fontWeight: '900' }, ageTextPast: { color: colors.white }, ageLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.14)' }, ageLinePast: { backgroundColor: 'rgba(255,255,255,0.40)' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, eyebrow: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.25 }, sectionTitle: { color: colors.navyDeep, fontSize: 25, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 }, countBadge: { minWidth: 38, height: 38, borderRadius: 19, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }, countText: { color: colors.navyDeep, fontSize: 13, fontWeight: '900' }, loader: { marginVertical: 36 },
  timeline: { gap: 0 }, event: { flexDirection: 'row', minHeight: 132 }, rail: { width: 55, alignItems: 'center' }, iconBubble: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 2, borderWidth: 3, borderColor: colors.sand }, icon: { fontSize: 18, fontWeight: '900' }, line: { width: 2, flex: 1, backgroundColor: colors.lineWarm, marginTop: -2 }, eventCard: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineWarm, padding: 15, marginBottom: 13 }, eventHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, date: { color: colors.mutedSoft, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }, categoryMark: { width: 24, height: 5, borderRadius: 3 }, eventTitle: { color: colors.navyDeep, fontSize: 16, fontWeight: '900', marginTop: 7 }, eventText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 }, eventFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, actor: { fontSize: 9, fontWeight: '900' }, footArrow: { color: colors.mutedSoft, fontSize: 16, fontWeight: '900' },
  emptyCard: { minHeight: 230, backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 22, justifyContent: 'center' }, emptyPlanet: { width: 65, height: 65, borderRadius: 23, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }, emptyPlanetText: { color: colors.orange, fontSize: 29, fontWeight: '900' }, emptyTitle: { color: colors.navyDeep, fontSize: 22, fontWeight: '900', marginTop: 20 }, emptyText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 7, maxWidth: '90%' },
});
