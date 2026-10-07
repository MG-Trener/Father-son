import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, type ImageSourcePropType, Text } from 'react-native';
import { ActionRow, Button, Card, Heading, LoadError, Page, Section, ui } from '../components/Everyday';
import { useFamily } from '../context/FamilyContext';
import { useFamilyPresentation } from '../hooks/useFamilyPresentation';
import { supabase } from '../lib/supabase';

type Mission = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  status: string;
  xp_reward: number;
  assigned_to: string | null;
  due_at: string | null;
};

type Direction = {
  id: 'school' | 'football' | 'chess' | 'english' | 'leadership';
  image: ImageSourcePropType;
  title: string;
  childLine: string;
  parentLine: string;
  colors: readonly [string, string];
  ink: string;
};

const directions: Direction[] = [
  { id: 'school', image: require('../../assets/generated/direction-school.png'), title: 'Школа', childLine: 'Становлюсь увереннее', parentLine: 'Интерес важнее оценок', colors: ['#EAF4FA', '#D5E9F3'], ink: '#2E6286' },
  { id: 'football', image: require('../../assets/generated/direction-football.png'), title: 'Футбол', childLine: 'Движение и команда', parentLine: 'Характер через игру', colors: ['#EAF4EC', '#D7E9DB'], ink: '#356B50' },
  { id: 'chess', image: require('../../assets/generated/direction-chess.png'), title: 'Шахматы', childLine: 'Думаю на ход вперёд', parentLine: 'Спокойствие и стратегия', colors: ['#F1EEF8', '#E0D9EF'], ink: '#5B5091' },
  { id: 'english', image: require('../../assets/generated/direction-english.png'), title: 'English', childLine: 'Открываю новый мир', parentLine: 'Смелость говорить', colors: ['#FFF7DF', '#F9E7B7'], ink: '#98661A' },
  { id: 'leadership', image: require('../../assets/generated/direction-leadership.png'), title: 'Лидерство', childLine: 'Учусь выбирать сам', parentLine: 'Ответственность без давления', colors: ['#FFF0E7', '#F7D7C8'], ink: '#945345' },
];

const dueText = (value: string | null) => {
  if (!value) return 'без срока';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'без срока' : `до ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
};

export default function DevelopmentV2() {
  const { family } = useFamily();
  const { child, isChild } = useFamilyPresentation();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyMission, setBusyMission] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !family || !child) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const result = await supabase.from('missions').select('id,category,title,description,status,xp_reward,assigned_to,due_at')
        .eq('family_id', family.id).eq('status', 'active').neq('category', 'together')
        .or('assigned_to.is.null,assigned_to.eq.' + child.user_id)
        .order('created_at', { ascending: false }).limit(20);
      if (result.error) throw result.error;
      setMissions(result.data ?? []);
    } catch { setLoadError('Не удалось обновить цели. Проверьте интернет.'); }
    finally { setLoading(false); }
  }, [family, child]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const activeMissions = useMemo(
    () => missions.filter((mission) => mission.status === 'active' && mission.category !== 'together' && (!mission.assigned_to || mission.assigned_to === child?.user_id)),
    [missions, child],
  );
  const completeMission = async (mission: Mission) => {
    if (!supabase || busyMission) return;
    setBusyMission(mission.id);
    try {
      const { data, error } = await supabase.rpc('complete_mission', { p_mission_id: mission.id });
      if (error) throw error;
      const result = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
      await load();
      const achievement = typeof result.achievement_title === 'string' ? result.achievement_title : null;
      Alert.alert('Шаг сохранён ✦', achievement ? `Открыта новая веха: «${achievement}».` : 'Этот шаг теперь есть в истории.');
    } catch (caught) {
      Alert.alert('Не удалось завершить миссию', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusyMission(null);
    }
  };


  return <Page refreshing={refreshing || loading} onRefresh={onRefresh}>
    <Heading title="Развитие" subtitle={isChild ? 'Выбери, что тебе интересно. Здесь можно пробовать, замечать успехи и просить поддержки.' : 'Помогайте сыну замечать свои успехи и выбирать следующий шаг.'} />
    {loadError ? <LoadError message={loadError} retry={() => void load()} /> : null}
    <Card tone="mint"><Text style={ui.sectionTitle}>{isChild ? 'Мой следующий шаг' : 'Один посильный шаг'}</Text><Text style={ui.body}>Договоритесь, чему посвятить эту неделю. Небольшая понятная цель помогает двигаться без спешки.</Text><Button label="Открыть цель недели" onPress={() => router.push('/weekly-focus')} /></Card>
    {activeMissions.length ? <Section title={isChild ? 'Мои текущие цели' : 'Текущие цели сына'}>{activeMissions.map(mission => <Card key={mission.id}><Text style={ui.rowTitle}>{mission.title}</Text>{mission.description ? <Text style={ui.body}>{mission.description}</Text> : null}<Text style={ui.caption}>{dueText(mission.due_at)}</Text><Button label="Отметить выполненным" secondary busy={busyMission === mission.id} disabled={busyMission !== null} onPress={() => void completeMission(mission)} /></Card>)}</Section> : null}
    <Section title={isChild ? 'Мои занятия' : 'Занятия сына'}>{directions.map(direction => <ActionRow key={direction.id} title={direction.id === 'english' ? 'Английский' : direction.title} description={isChild ? direction.childLine : direction.parentLine} image={direction.image} to={direction.id === 'chess' ? '/chess' : direction.id === 'school' ? '/school-schedule' : { pathname: '/growth-journal', params: { category: direction.id } }} />)}</Section>
    <Section title="Замечать прогресс">
      <ActionRow title="Добавить цель" description="Что хочется попробовать или научиться делать" to="/mission-new" />
      <ActionRow title="Итоги недели" description="Что получилось и какая поддержка нужна" to="/week-review" />
      <ActionRow title="Достижения" description="Успехи, которые важно отметить" to="/achievements" />
      <ActionRow title="Путь взросления" description="Интересы, навыки и новые возможности" to="/path-map" />
    </Section>
  </Page>;
}
