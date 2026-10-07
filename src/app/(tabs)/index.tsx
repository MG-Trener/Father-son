import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { brandAssets } from '../../brandAssets';
import { ActionRow, Button, Card, Heading, LoadError, Page, Section, ui } from '../../components/Everyday';
import { useFamily } from '../../context/FamilyContext';
import { localDay, moodIsToday } from '../../domain/presentation';
import { useFamilyPresentation } from '../../hooks/useFamilyPresentation';
import { supabase } from '../../lib/supabase';

type Mood = { user_id: string; mood: string; created_at: string };
type Meeting = { title: string; meeting_date: string };
type Focus = { title: string; target_user_id: string | null };
const moodLabels: Record<string, string> = { great: 'отлично', good: 'хорошо', ok: 'нормально', tired: 'усталость', sad: 'грустно', angry: 'злость' };

export default function TodayScreen() {
  const { family, me } = useFamily();
  const { isChild, myName, other, child } = useFamilyPresentation();
  const [moods, setMoods] = useState<Mood[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    if (!supabase || !family) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const monday = new Date(); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    try {
      const [moodResult, meetingResult, focusResult] = await Promise.all([
        supabase.from('moods').select('user_id,mood,created_at').eq('family_id', family.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('meetings').select('title,meeting_date').eq('family_id', family.id).eq('status', 'planned').gte('meeting_date', localDay()).order('meeting_date').limit(1).maybeSingle(),
        supabase.from('weekly_focuses').select('title,target_user_id').eq('family_id', family.id).eq('week_start', localDay(monday)).order('created_at', { ascending: false }).limit(10),
      ]);
      if (current !== request.current) return;
      if (moodResult.error || meetingResult.error || focusResult.error) throw new Error('Не удалось обновить сегодняшний день. Проверьте интернет и попробуйте ещё раз.');
      setMoods(moodResult.data ?? []);
      setMeeting(meetingResult.data);
      setFocus(focusResult.data?.find(item => item.target_user_id === child?.user_id) ?? null);
    } catch (caught) {
      if (current === request.current) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить данные.');
    } finally { if (current === request.current) setLoading(false); }
  }, [family?.id, child?.user_id]);

  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; }; }, [load]));
  const otherMood = moods.find(item => item.user_id === other?.user_id && moodIsToday(item.created_at));
  const myMood = moods.find(item => item.user_id === me?.user_id && moodIsToday(item.created_at));
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return <Page refreshing={loading} onRefresh={() => void load()}>
    <Heading title={`Привет, ${myName}`} subtitle={date} />
    {error ? <LoadError message={error} retry={() => void load()} /> : null}
    <Section title="Что хочется сегодня?">
      <Card tone="warm">
        <View style={ui.row}><Image source={brandAssets.features.together} style={ui.icon} accessible={false} /><View style={ui.flex}><Text style={ui.rowTitle}>{isChild ? 'Мы с папой' : 'Мы с сыном'}</Text><Text style={ui.description}>{otherMood ? `${other?.display_name}: сегодня ${moodLabels[otherMood.mood] ?? 'поделился настроением'}` : 'Поговорить, спросить совет или просто побыть рядом.'}</Text></View></View>
        <Button label={isChild ? 'Связаться с папой' : 'Связаться с сыном'} onPress={() => router.navigate('/(tabs)/together')} />
      </Card>
      <Card tone="mint">
        <View style={ui.row}><Image source={brandAssets.features.path} style={ui.icon} accessible={false} /><View style={ui.flex}><Text style={ui.rowTitle}>{isChild ? 'Мой следующий шаг' : 'Развитие сына'}</Text><Text style={ui.description}>{focus?.title ?? (isChild ? 'Выбери занятие и сохрани то, что получилось.' : 'Посмотрите занятия и выберите посильную цель вместе.')}</Text></View></View>
        <Button label={isChild ? 'Открыть мои занятия' : 'Открыть занятия сына'} onPress={() => router.navigate('/(tabs)/development')} />
      </Card>
    </Section>
    <Section title="Ближайшая встреча">
      <ActionRow image={brandAssets.utility.calendar} title={meeting?.title ?? 'Запланировать время вместе'} description={meeting ? new Date(`${meeting.meeting_date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'Выберите день и придумайте, чем заняться'} to="/meeting-plan" />
    </Section>
    <Section title="Как ты сегодня?">
      <ActionRow image={brandAssets.actions.mood} title={myMood ? `Сегодня ${moodLabels[myMood.mood] ?? 'есть отметка'}` : 'Поделиться настроением'} description={myMood ? 'Можно изменить отметку или добавить пару слов' : 'Одним нажатием или парой слов — как захочется'} to="/mood-check-in" />
    </Section>
    <ActionRow title="Что нового у нас" description="События, ответы и новые записи" image={brandAssets.actions.news} to="/notifications" />
  </Page>;
}
