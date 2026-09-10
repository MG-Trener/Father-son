import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppCard } from '../../components/AppCard';
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../lib/supabase';
import { colors, radius } from '../../theme';

type SkillPath = {
  id: string;
  title: string;
  description: string;
  sort_order: number;
};

type SkillNode = {
  id: string;
  path_id: string;
  title: string;
  description: string;
  stage_order: number;
  node_type: string;
};

type SkillProgress = {
  node_id: string;
  status: string;
};

type Mission = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_at: string | null;
  status: string;
  xp_reward: number;
  skill_node_id: string | null;
  completed_at: string | null;
  created_at: string;
};

type Award = {
  id: string;
  definition_id: string;
  recipient_user_id: string | null;
  awarded_at: string;
};

type AwardDefinition = {
  id: string;
  title: string;
  description: string;
  category: string;
  tier: number;
};

const meta: Record<string, { icon: string; fallbackTitle: string }> = {
  school: { icon: '📚', fallbackTitle: 'Школа' },
  football: { icon: '⚽', fallbackTitle: 'Футбол' },
  chess: { icon: '♟', fallbackTitle: 'Шахматы' },
  english: { icon: 'EN', fallbackTitle: 'English' },
  leadership: { icon: '🧭', fallbackTitle: 'Лидерство' },
  together: { icon: '❤️', fallbackTitle: 'Папа & Я' },
};

const prettyDate = (value: string | null) => {
  if (!value) return 'без срока';
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth()
    || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
};

export default function DevelopmentScreen() {
  const { family, members } = useFamily();
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const target = child ?? members[0] ?? null;
  const [paths, setPaths] = useState<SkillPath[]>([]);
  const [nodes, setNodes] = useState<SkillNode[]>([]);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [definitions, setDefinitions] = useState<AwardDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyMissionId, setBusyMissionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !family || !target) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [pathsResult, nodesResult, progressResult, missionsResult, awardsResult, definitionsResult] = await Promise.all([
      supabase.from('skill_paths').select('id,title,description,sort_order').order('sort_order'),
      supabase.from('skill_nodes').select('id,path_id,title,description,stage_order,node_type').eq('hidden', false).order('stage_order'),
      supabase.from('skill_progress').select('node_id,status').eq('family_id', family.id).eq('user_id', target.user_id),
      supabase.from('missions').select('id,category,title,description,assigned_to,due_at,status,xp_reward,skill_node_id,completed_at,created_at').eq('family_id', family.id).order('created_at', { ascending: false }).limit(80),
      supabase.from('achievement_awards').select('id,definition_id,recipient_user_id,awarded_at').eq('family_id', family.id).eq('recipient_user_id', target.user_id).order('awarded_at', { ascending: false }).limit(30),
      supabase.from('achievement_definitions').select('id,title,description,category,tier').eq('hidden', false),
    ]);

    const firstError = pathsResult.error
      ?? nodesResult.error
      ?? progressResult.error
      ?? missionsResult.error
      ?? awardsResult.error
      ?? definitionsResult.error;

    if (firstError) {
      Alert.alert('Не удалось загрузить развитие', firstError.message);
    } else {
      setPaths((pathsResult.data ?? []) as SkillPath[]);
      setNodes((nodesResult.data ?? []) as SkillNode[]);
      setProgress((progressResult.data ?? []) as SkillProgress[]);
      setMissions((missionsResult.data ?? []) as Mission[]);
      setAwards((awardsResult.data ?? []) as Award[]);
      setDefinitions((definitionsResult.data ?? []) as AwardDefinition[]);
    }
    setLoading(false);
  }, [family, target]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const completedNodes = useMemo(
    () => new Set(progress.filter((item) => item.status === 'completed').map((item) => item.node_id)),
    [progress],
  );

  const targetMissions = useMemo(
    () => missions.filter((mission) => !mission.assigned_to || mission.assigned_to === target?.user_id),
    [missions, target],
  );

  const activeMissions = useMemo(
    () => targetMissions.filter((mission) => mission.status === 'active'),
    [targetMissions],
  );

  const completedMissionCount = useMemo(
    () => targetMissions.filter((mission) => mission.status === 'completed').length,
    [targetMissions],
  );

  const xpTotal = useMemo(
    () => targetMissions.filter((mission) => mission.status === 'completed').reduce((sum, mission) => sum + mission.xp_reward, 0),
    [targetMissions],
  );

  const pathViews = useMemo(() => paths.map((path) => {
    const pathNodes = nodes.filter((node) => node.path_id === path.id).sort((a, b) => a.stage_order - b.stage_order);
    const completed = pathNodes.filter((node) => completedNodes.has(node.id)).length;
    const nextNode = pathNodes.find((node) => !completedNodes.has(node.id)) ?? null;
    const hasMissionForNext = nextNode
      ? activeMissions.some((mission) => mission.skill_node_id === nextNode.id)
      : false;
    return { ...path, nodes: pathNodes, completed, nextNode, hasMissionForNext };
  }), [paths, nodes, completedNodes, activeMissions]);

  const awardDefinitions = useMemo(
    () => new Map(definitions.map((definition) => [definition.id, definition])),
    [definitions],
  );

  const age = ageFromBirthDate(target?.birth_date ?? null);

  const completeMission = async (mission: Mission) => {
    if (!supabase || busyMissionId) return;
    setBusyMissionId(mission.id);
    try {
      const { data, error } = await supabase.rpc('complete_mission', { p_mission_id: mission.id });
      if (error) throw error;
      const result = data as { achievement_awarded?: boolean; achievement_title?: string } | null;
      await load();
      if (result?.achievement_awarded && result.achievement_title) {
        Alert.alert('Миссия выполнена 🎯', `Открыто достижение: «${result.achievement_title}».`);
      } else {
        Alert.alert('Миссия выполнена 🎯', `+${mission.xp_reward} XP. Этот шаг сохранён в вашей истории.`);
      }
    } catch (caught) {
      Alert.alert('Не удалось завершить миссию', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusyMissionId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <Text style={styles.title}>Развитие</Text>
        <Text style={styles.subtitle}>Не оценки, а путь. Прогресс не уменьшается из-за пауз.</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
        ) : (
          <>
            <View style={styles.hero}>
              <View>
                <Text style={styles.heroKicker}>ПУТЬ</Text>
                <Text style={styles.heroTitle}>{target?.display_name ?? 'Артур'}{age !== null ? ` · ${age}` : ''}</Text>
                <Text style={styles.heroText}>{completedMissionCount} миссий выполнено · {xpTotal} XP</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeValue}>{awards.length}</Text>
                <Text style={styles.heroBadgeLabel}>достиж.</Text>
              </View>
            </View>

            <AppCard title="Активные миссии" subtitle={activeMissions.length ? 'Небольшие шаги, которые сейчас в работе' : 'Пока активных миссий нет'}>
              {activeMissions.length ? activeMissions.map((mission) => {
                const category = meta[mission.category] ?? { icon: '✦', fallbackTitle: mission.category };
                return (
                  <View key={mission.id} style={styles.missionRow}>
                    <View style={styles.missionIcon}><Text style={styles.missionIconText}>{category.icon}</Text></View>
                    <View style={styles.missionText}>
                      <Text style={styles.missionTitle}>{mission.title}</Text>
                      <Text style={styles.missionMeta}>{category.fallbackTitle} · до {prettyDate(mission.due_at)} · +{mission.xp_reward} XP</Text>
                    </View>
                    <Pressable
                      style={[styles.doneButton, busyMissionId === mission.id && styles.disabled]}
                      disabled={busyMissionId !== null}
                      onPress={() => void completeMission(mission)}
                    >
                      <Text style={styles.doneButtonText}>{busyMissionId === mission.id ? '…' : '✓'}</Text>
                    </Pressable>
                  </View>
                );
              }) : (
                <Text style={styles.body}>Выбери следующий шаг в любом направлении и преврати его в конкретную миссию.</Text>
              )}
            </AppCard>

            <View>
              <Text style={styles.sectionTitle}>Направления</Text>
              <Text style={styles.sectionSubtitle}>Каждое рассчитано на несколько лет, а не на быстрый «процент выполнения».</Text>
            </View>

            {pathViews.map((path) => {
              const category = meta[path.id] ?? { icon: '✦', fallbackTitle: path.title };
              const ratio = path.nodes.length ? Math.round((path.completed / path.nodes.length) * 100) : 0;
              return (
                <View key={path.id} style={styles.pathCard}>
                  <View style={styles.pathHeader}>
                    <View style={styles.pathIcon}><Text style={styles.icon}>{category.icon}</Text></View>
                    <View style={styles.pathText}>
                      <Text style={styles.pathTitle}>{path.title}</Text>
                      <Text style={styles.stage}>{path.completed} из {path.nodes.length} ступеней · {ratio}%</Text>
                    </View>
                  </View>

                  <View style={styles.track}><View style={[styles.fill, { width: `${ratio}%` }]} /></View>

                  {path.nextNode ? (
                    <View style={styles.nextBox}>
                      <Text style={styles.nextLabel}>СЛЕДУЮЩИЙ ШАГ</Text>
                      <Text style={styles.nextTitle}>{path.nextNode.title}</Text>
                      <Text style={styles.next}>{path.nextNode.description}</Text>
                      <Pressable
                        style={[styles.missionButton, path.hasMissionForNext && styles.missionButtonMuted]}
                        disabled={path.hasMissionForNext}
                        onPress={() => router.push({ pathname: '/mission-new', params: { category: path.id, node: path.nextNode?.id ?? '' } })}
                      >
                        <Text style={[styles.missionButtonText, path.hasMissionForNext && styles.missionButtonTextMuted]}>
                          {path.hasMissionForNext ? 'Миссия уже запущена' : 'Создать миссию'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.completePath}><Text style={styles.completePathText}>✓ Все открытые ступени этого пути пройдены</Text></View>
                  )}
                </View>
              );
            })}

            <AppCard title="Достижения" subtitle="Они остаются навсегда и привязаны к реальным действиям">
              {awards.length ? awards.slice(0, 6).map((award) => {
                const definition = awardDefinitions.get(award.definition_id);
                if (!definition) return null;
                return (
                  <View key={award.id} style={styles.awardRow}>
                    <Text style={styles.awardIcon}>🏅</Text>
                    <View style={styles.awardText}>
                      <Text style={styles.awardTitle}>{definition.title}</Text>
                      <Text style={styles.awardDescription}>{definition.description}</Text>
                    </View>
                  </View>
                );
              }) : (
                <Text style={styles.body}>Первое достижение откроется после первой выполненной миссии.</Text>
              )}
            </AppCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 34, gap: 14 },
  title: { color: colors.navyDeep, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -7, marginBottom: 4 },
  loader: { marginTop: 60 },
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  heroKicker: { color: '#C9D7D7', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.white, fontSize: 25, fontWeight: '900', marginTop: 3 },
  heroText: { color: '#E7EEEE', fontSize: 12, marginTop: 4 },
  heroBadge: { minWidth: 68, height: 68, borderRadius: 34, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  heroBadgeValue: { color: colors.navyDeep, fontSize: 22, fontWeight: '900' },
  heroBadgeLabel: { color: colors.navyDeep, fontSize: 9, fontWeight: '900' },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  missionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  missionIconText: { fontSize: 17, fontWeight: '900', color: colors.navy },
  missionText: { flex: 1 },
  missionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  missionMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  doneButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  sectionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  pathCard: { backgroundColor: colors.paper, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line, gap: 12 },
  pathHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  pathIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 21, fontWeight: '900', color: colors.navy },
  pathText: { flex: 1 },
  pathTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  stage: { color: colors.green, marginTop: 2, fontSize: 12, fontWeight: '800' },
  track: { height: 7, borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.green, borderRadius: radius.pill },
  nextBox: { backgroundColor: colors.sand, borderRadius: radius.md, padding: 13 },
  nextLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  nextTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 4 },
  next: { color: colors.muted, marginTop: 4, fontSize: 12, lineHeight: 17 },
  missionButton: { alignSelf: 'flex-start', backgroundColor: colors.navy, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, marginTop: 10 },
  missionButtonMuted: { backgroundColor: colors.line },
  missionButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  missionButtonTextMuted: { color: colors.muted },
  completePath: { backgroundColor: '#DCECE3', borderRadius: radius.md, padding: 12 },
  completePathText: { color: colors.green, fontSize: 12, fontWeight: '900' },
  awardRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  awardIcon: { fontSize: 24 },
  awardText: { flex: 1 },
  awardTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  awardDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
