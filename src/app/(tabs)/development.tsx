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
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../lib/supabase';
import { colors, gradients, radius, shadows } from '../../theme';

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

type GrowthRow = {
  id: string;
  category: string;
};

type CategoryMeta = {
  icon: string;
  fallbackTitle: string;
  accent: string;
  strong: string;
  text: string;
  detail: string;
};

const meta: Record<string, CategoryMeta> & { school: CategoryMeta } = {
  school: { icon: '✎', fallbackTitle: 'Школа', accent: '#DCE7F6', strong: colors.blue, text: '#27465F', detail: 'Цели · помощь · победы' },
  football: { icon: '⚽', fallbackTitle: 'Футбол', accent: '#DCEFE4', strong: colors.green, text: '#2C5942', detail: 'Техника · команда · характер' },
  chess: { icon: '♞', fallbackTitle: 'Шахматы', accent: '#E7E2F6', strong: colors.purple, text: '#4C456B', detail: 'Партии · анализ · стратегия' },
  english: { icon: 'EN', fallbackTitle: 'English', accent: '#FFF0CF', strong: colors.amber, text: '#74511B', detail: 'Голос · речь · смелость' },
  leadership: { icon: '⌁', fallbackTitle: 'Лидерство', accent: '#F7DDD5', strong: colors.coral, text: '#70443A', detail: 'Выбор · инициатива · уважение' },
  together: { icon: '♥', fallbackTitle: 'Папа & Я', accent: '#F3E2DF', strong: colors.coral, text: '#70443A', detail: 'Связь · доверие · история' },
};

const growthCategoryIds = ['school', 'football', 'chess', 'english', 'leadership'] as const;
const growthCategories = new Set<string>(growthCategoryIds);
const ageYears = [11, 12, 13, 14, 15, 16, 17, 18];

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

const phaseForAge = (age: number | null) => {
  if (age === null || age <= 12) return 'Исследователь';
  if (age === 13) return 'Следопыт';
  if (age === 14) return 'Стратег';
  if (age === 15) return 'Капитан';
  if (age === 16) return 'Первопроходец';
  if (age === 17) return 'Наставник';
  return 'Свой путь';
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
  const [growthRows, setGrowthRows] = useState<GrowthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyMissionId, setBusyMissionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !family || !target) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [
      pathsResult,
      nodesResult,
      progressResult,
      missionsResult,
      awardsResult,
      definitionsResult,
      growthResult,
    ] = await Promise.all([
      supabase.from('skill_paths').select('id,title,description,sort_order').order('sort_order'),
      supabase.from('skill_nodes').select('id,path_id,title,description,stage_order,node_type').eq('hidden', false).order('stage_order'),
      supabase.from('skill_progress').select('node_id,status').eq('family_id', family.id).eq('user_id', target.user_id),
      supabase.from('missions').select('id,category,title,description,assigned_to,due_at,status,xp_reward,skill_node_id,completed_at,created_at').eq('family_id', family.id).order('created_at', { ascending: false }).limit(80),
      supabase.from('achievement_awards').select('id,definition_id,recipient_user_id,awarded_at').eq('family_id', family.id).eq('recipient_user_id', target.user_id).order('awarded_at', { ascending: false }).limit(30),
      supabase.from('achievement_definitions').select('id,title,description,category,tier').eq('hidden', false),
      supabase.from('growth_entries').select('id,category').eq('family_id', family.id).eq('user_id', target.user_id).limit(500),
    ]);

    const firstError = pathsResult.error
      ?? nodesResult.error
      ?? progressResult.error
      ?? missionsResult.error
      ?? awardsResult.error
      ?? definitionsResult.error
      ?? growthResult.error;

    if (firstError) {
      Alert.alert('Не удалось загрузить развитие', firstError.message);
    } else {
      setPaths((pathsResult.data ?? []) as SkillPath[]);
      setNodes((nodesResult.data ?? []) as SkillNode[]);
      setProgress((progressResult.data ?? []) as SkillProgress[]);
      setMissions((missionsResult.data ?? []) as Mission[]);
      setAwards((awardsResult.data ?? []) as Award[]);
      setDefinitions((definitionsResult.data ?? []) as AwardDefinition[]);
      setGrowthRows((growthResult.data ?? []) as GrowthRow[]);
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
    () => targetMissions
      .filter((mission) => mission.status === 'completed')
      .reduce((sum, mission) => sum + mission.xp_reward, 0),
    [targetMissions],
  );

  const growthCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of growthRows) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    return counts;
  }, [growthRows]);

  const pathViews = useMemo(() => paths.map((path) => {
    const pathNodes = nodes
      .filter((node) => node.path_id === path.id)
      .sort((a, b) => a.stage_order - b.stage_order);
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
  const currentPhase = phaseForAge(age);

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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
        ) : (
          <>
            <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
              <View style={styles.heroSun} />
              <View style={styles.heroOrbit} />
              <Text style={styles.heroKicker}>КАРТА РОСТА · 11–18</Text>
              <Text style={styles.heroTitle}>{target?.display_name ?? 'Артур'}</Text>
              <Text style={styles.heroPhase}>{age !== null ? `${age} лет · ` : ''}{currentPhase}</Text>
              <Text style={styles.heroText}>Не оценки и не гонка. Здесь остаются реальные шаги, попытки, открытия и моменты взросления.</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}><Text style={styles.heroStatValue}>{completedMissionCount}</Text><Text style={styles.heroStatLabel}>миссий</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={styles.heroStatValue}>{xpTotal}</Text><Text style={styles.heroStatLabel}>XP команды</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={styles.heroStatValue}>{awards.length}</Text><Text style={styles.heroStatLabel}>вех</Text></View>
              </View>
              <View style={styles.ageRail}>
                {ageYears.map((year, index) => {
                  const active = age === year || (age === null && index === 0);
                  const passed = age !== null && year < age;
                  return (
                    <View key={year} style={styles.agePart}>
                      <View style={[styles.ageNode, passed && styles.ageNodePassed, active && styles.ageNodeActive]}>
                        <Text style={[styles.ageText, (passed || active) && styles.ageTextBright]}>{year}</Text>
                      </View>
                      {index < ageYears.length - 1 ? <View style={[styles.ageLine, passed && styles.ageLinePassed]} /> : null}
                    </View>
                  );
                })}
              </View>
            </LinearGradient>

            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionKicker}>ПЯТЬ НАПРАВЛЕНИЙ</Text>
                <Text style={styles.sectionTitle}>Миры Артура</Text>
              </View>
              <Text style={styles.sectionNote}>{growthRows.length} записей</Text>
            </View>

            <View style={styles.moduleGrid}>
              {growthCategoryIds.map((categoryId, index) => {
                const category = meta[categoryId] ?? meta.school;
                const count = growthCounts.get(categoryId) ?? 0;
                const wide = index === 0 || index === 3;
                return (
                  <Pressable
                    key={categoryId}
                    style={[styles.moduleCard, wide && styles.moduleCardWide, { backgroundColor: category.accent }, shadows.soft]}
                    onPress={() => router.push({ pathname: '/growth-journal', params: { category: categoryId } })}
                  >
                    <View style={[styles.moduleIconBox, { backgroundColor: category.strong }]}>
                      <Text style={styles.moduleIcon}>{category.icon}</Text>
                    </View>
                    <View style={styles.moduleDecor} />
                    <Text style={[styles.moduleTitle, { color: category.text }]}>{category.fallbackTitle}</Text>
                    <Text style={[styles.moduleDetail, { color: category.text }]}>{category.detail}</Text>
                    <View style={styles.moduleFooter}>
                      <Text style={[styles.moduleCount, { color: category.text }]}>{count ? `${count} записей` : 'Начать журнал'}</Text>
                      <Text style={[styles.moduleArrow, { color: category.strong }]}>↗</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.missionPanel, shadows.soft]}>
              <View style={styles.missionPanelHead}>
                <View>
                  <Text style={styles.sectionKicker}>СЕЙЧАС В РАБОТЕ</Text>
                  <Text style={styles.sectionTitle}>Активные миссии</Text>
                </View>
                <View style={styles.missionCountBubble}><Text style={styles.missionCountText}>{activeMissions.length}</Text></View>
              </View>
              {activeMissions.length ? activeMissions.slice(0, 5).map((mission) => {
                const category = meta[mission.category] ?? meta.school;
                return (
                  <View key={mission.id} style={styles.missionRow}>
                    <View style={[styles.missionIcon, { backgroundColor: category.accent }]}><Text style={[styles.missionIconText, { color: category.text }]}>{category.icon}</Text></View>
                    <View style={styles.missionText}>
                      <Text style={styles.missionTitle}>{mission.title}</Text>
                      <Text style={styles.missionMeta}>{category.fallbackTitle} · {prettyDate(mission.due_at)} · +{mission.xp_reward} XP</Text>
                    </View>
                    <Pressable
                      style={[styles.doneButton, { backgroundColor: category.strong }, busyMissionId === mission.id && styles.disabled]}
                      disabled={busyMissionId !== null}
                      onPress={() => void completeMission(mission)}
                    >
                      <Text style={styles.doneButtonText}>{busyMissionId === mission.id ? '…' : '✓'}</Text>
                    </Pressable>
                  </View>
                );
              }) : (
                <View style={styles.emptyMission}>
                  <Text style={styles.emptyMissionIcon}>◎</Text>
                  <View style={styles.emptyMissionText}><Text style={styles.emptyMissionTitle}>Можно выбрать следующий шаг</Text><Text style={styles.emptyMissionDetail}>Открой любой путь ниже и преврати ближайшую ступень в небольшую реальную миссию.</Text></View>
                </View>
              )}
            </View>

            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionKicker}>ДОЛГИЙ МАРШРУТ</Text>
                <Text style={styles.sectionTitle}>Многолетние пути</Text>
              </View>
            </View>

            {pathViews.map((path) => {
              const category = meta[path.id] ?? meta.school;
              const ratio = path.nodes.length ? Math.round((path.completed / path.nodes.length) * 100) : 0;
              return (
                <View key={path.id} style={[styles.pathCard, { backgroundColor: category.accent }, shadows.soft]}>
                  <View style={styles.pathTop}>
                    <View style={[styles.pathIcon, { backgroundColor: category.strong }]}><Text style={styles.pathIconText}>{category.icon}</Text></View>
                    <View style={styles.pathHeading}>
                      <Text style={[styles.pathTitle, { color: category.text }]}>{path.title}</Text>
                      <Text style={[styles.pathStage, { color: category.text }]}>{path.completed} из {path.nodes.length} ступеней</Text>
                    </View>
                    <Text style={[styles.pathRatio, { color: category.text }]}>{ratio}%</Text>
                  </View>

                  <View style={styles.pathTrack}><View style={[styles.pathFill, { width: `${ratio}%`, backgroundColor: category.strong }]} /></View>

                  <View style={styles.pathDots}>
                    {path.nodes.map((node, index) => {
                      const done = completedNodes.has(node.id);
                      const next = path.nextNode?.id === node.id;
                      return (
                        <View key={node.id} style={styles.pathDotPart}>
                          <View style={[styles.pathDot, done && { backgroundColor: category.strong }, next && { borderColor: category.strong, borderWidth: 2 }]} />
                          {index < path.nodes.length - 1 ? <View style={styles.pathDotLine} /> : null}
                        </View>
                      );
                    })}
                  </View>

                  {growthCategories.has(path.id) ? (
                    <Pressable style={styles.journalButton} onPress={() => router.push({ pathname: '/growth-journal', params: { category: path.id } })}>
                      <Text style={[styles.journalButtonText, { color: category.text }]}>Журнал · {growthCounts.get(path.id) ?? 0}</Text>
                      <Text style={[styles.journalArrow, { color: category.strong }]}>↗</Text>
                    </Pressable>
                  ) : null}

                  {path.nextNode ? (
                    <View style={styles.nextBox}>
                      <Text style={styles.nextLabel}>СЛЕДУЮЩАЯ СТУПЕНЬ</Text>
                      <Text style={[styles.nextTitle, { color: category.text }]}>{path.nextNode.title}</Text>
                      <Text style={styles.next}>{path.nextNode.description}</Text>
                      <Pressable
                        style={[styles.missionButton, { backgroundColor: category.strong }, path.hasMissionForNext && styles.missionButtonMuted]}
                        disabled={path.hasMissionForNext}
                        onPress={() => router.push({ pathname: '/mission-new', params: { category: path.id, node: path.nextNode?.id ?? '' } })}
                      >
                        <Text style={[styles.missionButtonText, path.hasMissionForNext && styles.missionButtonTextMuted]}>
                          {path.hasMissionForNext ? 'Уже в работе' : 'Сделать миссией →'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.completePath}><Text style={styles.completePathText}>✓ Все открытые ступени этого пути пройдены</Text></View>
                  )}
                </View>
              );
            })}

            <LinearGradient colors={['#2C405B', '#162A3A']} style={[styles.awardsPanel, shadows.lift]}>
              <View style={styles.awardGlow} />
              <Text style={styles.awardsKicker}>АРТЕФАКТЫ РОСТА</Text>
              <Text style={styles.awardsTitle}>Достижения, которые остаются</Text>
              <Text style={styles.awardsSubtitle}>Не значки за клики, а следы реальных действий и важных моментов.</Text>
              {awards.length ? awards.slice(0, 6).map((award, index) => {
                const definition = awardDefinitions.get(award.definition_id);
                if (!definition) return null;
                return (
                  <View key={award.id} style={styles.awardRow}>
                    <View style={styles.awardMedal}><Text style={styles.awardMedalText}>{index + 1}</Text></View>
                    <View style={styles.awardText}>
                      <Text style={styles.awardTitle}>{definition.title}</Text>
                      <Text style={styles.awardDescription}>{definition.description}</Text>
                    </View>
                  </View>
                );
              }) : (
                <View style={styles.awardEmpty}><Text style={styles.awardEmptyIcon}>✦</Text><Text style={styles.awardEmptyText}>Первый артефакт появится после первой значимой вехи.</Text></View>
              )}
            </LinearGradient>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 38, gap: 18 },
  loader: { marginTop: 80 },
  hero: { minHeight: 390, borderRadius: radius.xl, padding: 22, overflow: 'hidden' },
  heroSun: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,210,94,0.10)', right: -72, top: -70 },
  heroOrbit: { position: 'absolute', width: 250, height: 110, borderRadius: 130, borderWidth: 2, borderColor: 'rgba(255,255,255,0.09)', right: -55, top: 52, transform: [{ rotate: '-19deg' }] },
  heroKicker: { color: '#BBD1D2', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle: { color: colors.white, fontSize: 36, fontWeight: '900', letterSpacing: -1.1, marginTop: 7 },
  heroPhase: { color: colors.sun, fontSize: 12, fontWeight: '900', marginTop: 3 },
  heroText: { color: '#D5E3E3', maxWidth: '78%', fontSize: 11, lineHeight: 17, marginTop: 13 },
  heroStats: { minHeight: 72, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.lg, marginTop: 22, paddingHorizontal: 10 },
  heroStat: { flex: 1, alignItems: 'center' }, heroStatValue: { color: colors.white, fontSize: 20, fontWeight: '900' }, heroStatLabel: { color: '#BFD0D1', fontSize: 8, fontWeight: '800', marginTop: 2 }, heroStatDivider: { width: 1, height: 31, backgroundColor: 'rgba(255,255,255,0.12)' },
  ageRail: { flexDirection: 'row', alignItems: 'center', marginTop: 26 }, agePart: { flex: 1, flexDirection: 'row', alignItems: 'center' }, ageNode: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }, ageNodePassed: { backgroundColor: colors.teal }, ageNodeActive: { backgroundColor: colors.amber, borderColor: colors.sun }, ageText: { color: '#94A8AA', fontSize: 8, fontWeight: '900' }, ageTextBright: { color: colors.white }, ageLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }, ageLinePassed: { backgroundColor: colors.teal },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 3, marginTop: 3 }, sectionKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.12 }, sectionTitle: { color: colors.navyDeep, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 }, sectionNote: { color: colors.muted, fontSize: 9, fontWeight: '800', paddingBottom: 4 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, moduleCard: { width: '48.4%', minHeight: 170, borderRadius: radius.xl, padding: 16, overflow: 'hidden' }, moduleCardWide: { width: '100%', minHeight: 150 }, moduleIconBox: { width: 45, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, moduleIcon: { color: colors.white, fontSize: 17, fontWeight: '900' }, moduleDecor: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 14, borderColor: 'rgba(255,255,255,0.22)', right: -25, top: -20 }, moduleTitle: { fontSize: 18, fontWeight: '900', marginTop: 16 }, moduleDetail: { fontSize: 9, fontWeight: '700', opacity: 0.68, marginTop: 3 }, moduleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 16 }, moduleCount: { fontSize: 9, fontWeight: '900', opacity: 0.78 }, moduleArrow: { fontSize: 19, fontWeight: '900' },
  missionPanel: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 18 }, missionPanelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }, missionCountBubble: { minWidth: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center' }, missionCountText: { color: '#76511C', fontSize: 14, fontWeight: '900' }, missionRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineWarm }, missionIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, missionIconText: { fontSize: 15, fontWeight: '900' }, missionText: { flex: 1 }, missionTitle: { color: colors.navyDeep, fontSize: 13, fontWeight: '900' }, missionMeta: { color: colors.muted, fontSize: 9, marginTop: 3 }, doneButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, doneButtonText: { color: colors.white, fontSize: 16, fontWeight: '900' }, disabled: { opacity: 0.45 }, emptyMission: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.sandWarm, borderRadius: radius.lg, padding: 15, marginTop: 5 }, emptyMissionIcon: { color: colors.teal, fontSize: 25, fontWeight: '900' }, emptyMissionText: { flex: 1 }, emptyMissionTitle: { color: colors.navyDeep, fontSize: 12, fontWeight: '900' }, emptyMissionDetail: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  pathCard: { borderRadius: radius.xl, padding: 18, overflow: 'hidden' }, pathTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, pathIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, pathIconText: { color: colors.white, fontSize: 18, fontWeight: '900' }, pathHeading: { flex: 1 }, pathTitle: { fontSize: 19, fontWeight: '900' }, pathStage: { fontSize: 9, fontWeight: '800', opacity: 0.68, marginTop: 2 }, pathRatio: { fontSize: 19, fontWeight: '900' }, pathTrack: { height: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.56)', overflow: 'hidden', marginTop: 17 }, pathFill: { height: '100%', borderRadius: radius.pill }, pathDots: { flexDirection: 'row', alignItems: 'center', marginTop: 11, marginBottom: 4 }, pathDotPart: { flex: 1, flexDirection: 'row', alignItems: 'center' }, pathDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.78)' }, pathDotLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.65)' }, journalButton: { minHeight: 43, borderRadius: radius.md, marginTop: 11, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.60)' }, journalButtonText: { fontSize: 10, fontWeight: '900' }, journalArrow: { fontSize: 17, fontWeight: '900' }, nextBox: { backgroundColor: 'rgba(255,255,255,0.62)', borderRadius: radius.lg, padding: 14, marginTop: 10 }, nextLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 }, nextTitle: { fontSize: 14, fontWeight: '900', marginTop: 4 }, next: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, missionButton: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, marginTop: 11 }, missionButtonMuted: { backgroundColor: colors.line }, missionButtonText: { color: colors.white, fontSize: 9, fontWeight: '900' }, missionButtonTextMuted: { color: colors.muted }, completePath: { backgroundColor: 'rgba(255,255,255,0.64)', borderRadius: radius.lg, padding: 13, marginTop: 10 }, completePathText: { color: colors.green, fontSize: 10, fontWeight: '900' },
  awardsPanel: { borderRadius: radius.xl, padding: 20, overflow: 'hidden' }, awardGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,211,95,0.08)', right: -45, top: -65 }, awardsKicker: { color: '#9FB5C2', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, awardsTitle: { color: colors.white, fontSize: 23, lineHeight: 27, fontWeight: '900', marginTop: 5, maxWidth: '78%' }, awardsSubtitle: { color: '#B8C8CF', fontSize: 9, lineHeight: 14, marginTop: 6, marginBottom: 10, maxWidth: '82%' }, awardRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' }, awardMedal: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }, awardMedalText: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' }, awardText: { flex: 1 }, awardTitle: { color: colors.white, fontSize: 12, fontWeight: '900' }, awardDescription: { color: '#AFC1C9', fontSize: 9, lineHeight: 13, marginTop: 2 }, awardEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.lg, padding: 14 }, awardEmptyIcon: { color: colors.sun, fontSize: 22 }, awardEmptyText: { flex: 1, color: '#C0D0D5', fontSize: 10, lineHeight: 15, fontWeight: '700' },
});