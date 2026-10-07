import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  type ImageSourcePropType,
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
import { StoryHero } from '../components/StoryHero';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

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

type GrowthEntry = { id: string; category: string; activity_date: string };
type Award = { id: string; awarded_at: string };

type Direction = {
  id: 'school' | 'football' | 'chess' | 'english' | 'leadership';
  image: ImageSourcePropType;
  title: string;
  childLine: string;
  parentLine: string;
  colors: readonly [string, string];
  ink: string;
};

type BadgeSlot = {
  id: string;
  title: string;
  source: ImageSourcePropType;
  unlockAt: number;
};

const directions: Direction[] = [
  { id: 'school', image: require('../../assets/generated/direction-school.png'), title: 'Школа', childLine: 'Становлюсь увереннее', parentLine: 'Интерес важнее оценок', colors: ['#EAF4FA', '#D5E9F3'], ink: '#2E6286' },
  { id: 'football', image: require('../../assets/generated/direction-football.png'), title: 'Футбол', childLine: 'Движение и команда', parentLine: 'Характер через игру', colors: ['#EAF4EC', '#D7E9DB'], ink: '#356B50' },
  { id: 'chess', image: require('../../assets/generated/direction-chess.png'), title: 'Шахматы', childLine: 'Думаю на ход вперёд', parentLine: 'Спокойствие и стратегия', colors: ['#F1EEF8', '#E0D9EF'], ink: '#5B5091' },
  { id: 'english', image: require('../../assets/generated/direction-english.png'), title: 'English', childLine: 'Открываю новый мир', parentLine: 'Смелость говорить', colors: ['#FFF7DF', '#F9E7B7'], ink: '#98661A' },
  { id: 'leadership', image: require('../../assets/generated/direction-leadership.png'), title: 'Лидерство', childLine: 'Учусь выбирать сам', parentLine: 'Ответственность без давления', colors: ['#FFF0E7', '#F7D7C8'], ink: '#945345' },
];

const badgeSlots: BadgeSlot[] = [
  { id: 'school', title: 'Знания', source: require('../../assets/generated/badge-school.png'), unlockAt: 1 },
  { id: 'football', title: 'Команда', source: require('../../assets/generated/badge-football.png'), unlockAt: 2 },
  { id: 'chess', title: 'Стратег', source: require('../../assets/generated/badge-chess.png'), unlockAt: 3 },
  { id: 'english', title: 'Мир', source: require('../../assets/generated/badge-english.png'), unlockAt: 5 },
  { id: 'adventure', title: 'Путь', source: require('../../assets/generated/badge-adventure.png'), unlockAt: 8 },
  { id: 'team', title: 'Вместе', source: require('../../assets/generated/badge-team.png'), unlockAt: 12 },
  { id: 'courage', title: 'Смелость', source: require('../../assets/generated/badge-courage.png'), unlockAt: 20 },
  { id: 'planner', title: 'Ритм', source: require('../../assets/generated/badge-planner.png'), unlockAt: 30 },
];

const ages = [11, 12, 13, 14, 15, 16, 17, 18];

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return 11;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 11;
  const now = new Date();
  let result = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) result -= 1;
  return Math.max(11, Math.min(18, result));
};

const stageName = (age: number) => {
  if (age <= 12) return 'Исследователь';
  if (age === 13) return 'Следопыт';
  if (age === 14) return 'Стратег';
  if (age === 15) return 'Капитан';
  if (age === 16) return 'Первопроходец';
  if (age === 17) return 'Наставник';
  return 'Свой путь';
};

const dueText = (value: string | null) => {
  if (!value) return 'без срока';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'без срока' : `до ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
};

export default function DevelopmentV2() {
  const { family, members, me } = useFamily();
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? members[0] ?? null, [members]);
  const isChild = me?.role === 'child';
  const childName = child?.display_name ?? 'Артур';
  const age = ageFromBirthDate(child?.birth_date ?? null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [growthEntries, setGrowthEntries] = useState<GrowthEntry[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyMission, setBusyMission] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !family || !child) {
      setLoading(false);
      return;
    }
    const [missionsResult, growthResult, awardsResult] = await Promise.all([
      supabase.from('missions').select('id,category,title,description,status,xp_reward,assigned_to,due_at').eq('family_id', family.id).order('created_at', { ascending: false }).limit(120),
      supabase.from('growth_entries').select('id,category,activity_date').eq('family_id', family.id).eq('user_id', child.user_id).order('activity_date', { ascending: false }).limit(500),
      supabase.from('achievement_awards').select('id,awarded_at').eq('family_id', family.id).eq('recipient_user_id', child.user_id).order('awarded_at', { ascending: false }).limit(100),
    ]);
    const error = missionsResult.error ?? growthResult.error ?? awardsResult.error;
    if (error) Alert.alert('Не удалось загрузить путь', error.message);
    else {
      setMissions((missionsResult.data ?? []) as Mission[]);
      setGrowthEntries((growthResult.data ?? []) as GrowthEntry[]);
      setAwards((awardsResult.data ?? []) as Award[]);
    }
    setLoading(false);
  }, [family, child]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const activeMissions = useMemo(
    () => missions.filter((mission) => mission.status === 'active' && (!mission.assigned_to || mission.assigned_to === child?.user_id)).slice(0, 5),
    [missions, child],
  );
  const completedMissions = useMemo(() => missions.filter((mission) => mission.status === 'completed'), [missions]);
  const xp = useMemo(() => completedMissions.reduce((sum, mission) => sum + mission.xp_reward, 0), [completedMissions]);
  const counts = useMemo(() => {
    const next = new Map<string, number>();
    for (const entry of growthEntries) next.set(entry.category, (next.get(entry.category) ?? 0) + 1);
    return next;
  }, [growthEntries]);
  const openedBadges = badgeSlots.filter((badge) => awards.length >= badge.unlockAt).length;

  const completeMission = async (mission: Mission) => {
    if (!supabase || busyMission) return;
    setBusyMission(mission.id);
    try {
      const { data, error } = await supabase.rpc('complete_mission', { p_mission_id: mission.id });
      if (error) throw error;
      const result = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
      await load();
      const achievement = typeof result.achievement_title === 'string' ? result.achievement_title : null;
      Alert.alert('Шаг сохранён ✦', achievement ? `Открыта новая веха: «${achievement}».` : `+${mission.xp_reward} XP. Главное — этот шаг теперь есть в истории.`);
    } catch (caught) {
      Alert.alert('Не удалось завершить миссию', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusyMission(null);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <StoryHero
          kicker={isChild ? 'МОЙ МАРШРУТ · 11–18' : `ПУТЬ ${childName.toUpperCase()} · 11–18`}
          title={isChild ? 'Куда идём дальше?' : 'Расти рядом, не давя'}
          subtitle={isChild
            ? `Сейчас ты — ${stageName(age)}. Здесь не нужно быть идеальным: пробуй, ошибайся, возвращайся и замечай, как становишься сильнее.`
            : `Здесь видны не оценки, а реальные шаги ${childName}: усилия, интерес, характер и то, что хочется запомнить.`}
          emblemImage={require('../../assets/generated/feature-path.png')}
          variant={isChild ? 'adventure' : 'team'}
          footer={(
            <View style={styles.heroStats}>
              <View style={styles.heroStat}><Text style={styles.heroValue}>{activeMissions.length}</Text><Text style={styles.heroLabel}>сейчас</Text></View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}><Text style={styles.heroValue}>{growthEntries.length}</Text><Text style={styles.heroLabel}>моментов</Text></View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}><Text style={styles.heroValue}>{awards.length}</Text><Text style={styles.heroLabel}>вех</Text></View>
            </View>
          )}
        />

        <View style={[styles.routeCard, shadows.soft]}>
          <View style={styles.sectionTop}>
            <View>
              <Text style={styles.kicker}>{isChild ? 'МОЯ ГЛАВА' : 'ТЕКУЩАЯ ГЛАВА'}</Text>
              <Text style={styles.sectionTitle}>{age} лет · {stageName(age)}</Text>
            </View>
            <View style={styles.xpBadge}><Text style={styles.xpText}>{xp} XP</Text></View>
          </View>
          <View style={styles.ageRail}>
            {ages.map((year, index) => {
              const active = year === age;
              const passed = year < age;
              return (
                <View key={year} style={styles.agePart}>
                  <View style={[styles.ageNode, passed && styles.agePassed, active && styles.ageActive]}>
                    <Text style={[styles.ageNodeText, (passed || active) && styles.ageNodeTextBright]}>{year}</Text>
                  </View>
                  {index < ages.length - 1 ? <View style={[styles.ageLine, passed && styles.ageLinePassed]} /> : null}
                </View>
              );
            })}
          </View>
          <Text style={styles.routeNote}>{isChild ? 'Это не гонка. После паузы путь продолжается с того же места.' : 'Ни один период не «провален». Паузы — часть взросления, а не потеря прогресса.'}</Text>
        </View>

        <View style={styles.sectionTop}>
          <View>
            <Text style={styles.kicker}>{isChild ? 'МОИ МИРЫ' : 'НАПРАВЛЕНИЯ РОСТА'}</Text>
            <Text style={styles.sectionTitle}>{isChild ? 'Что мне интересно' : 'Где Артур растёт'}</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/yearbook')}><Text style={styles.link}>Книга года →</Text></Pressable>
        </View>

        <View style={styles.directionGrid}>
          {directions.map((item, index) => (
            <Pressable
              key={item.id}
              style={[styles.directionPressable, index === 4 && styles.directionWide]}
              onPress={() => router.push({ pathname: '/growth-journal', params: { category: item.id } })}
            >
              <LinearGradient colors={item.colors} style={[styles.directionCard, shadows.soft]}>
                <View style={styles.directionTop}>
                  <View style={styles.directionIcon}>
                    <Image source={item.image} style={styles.directionIconImage} resizeMode="contain" />
                  </View>
                  <Text style={[styles.directionCount, { color: item.ink }]}>{counts.get(item.id) ?? 0}</Text>
                </View>
                <Text style={[styles.directionTitle, { color: item.ink }]}>{item.title}</Text>
                <Text style={[styles.directionLine, { color: item.ink }]}>{isChild ? item.childLine : item.parentLine}</Text>
                <Text style={[styles.directionOpen, { color: item.ink }]}>Открыть журнал ↗</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        <View style={[styles.badgesCard, shadows.soft]}>
          <View style={styles.sectionTop}>
            <View>
              <Text style={styles.kicker}>КОЛЛЕКЦИЯ НА ГОДЫ</Text>
              <Text style={styles.sectionTitle}>Гербы пути</Text>
            </View>
            <Text style={styles.badgesProgress}>{openedBadges}/{badgeSlots.length}</Text>
          </View>
          <Text style={styles.badgesIntro}>Гербы остаются в истории и открываются постепенно по мере настоящих вех. Здесь нет сезонного обнуления.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
            {badgeSlots.map((badge) => {
              const unlocked = awards.length >= badge.unlockAt;
              return (
                <View key={badge.id} style={[styles.badgeSlot, !unlocked && styles.badgeSlotLocked]}>
                  <Image source={badge.source} style={[styles.badgeImage, !unlocked && styles.badgeImageLocked]} resizeMode="contain" />
                  <Text style={styles.badgeTitle}>{badge.title}</Text>
                  <Text style={styles.badgeMeta}>{unlocked ? 'открыт' : `после ${badge.unlockAt} вех`}</Text>
                </View>
              );
            })}
          </ScrollView>
          <Pressable style={styles.badgesLink} onPress={() => router.push('/(tabs)/yearbook')}>
            <Text style={styles.badgesLinkText}>Смотреть историю вех в Книге года →</Text>
          </Pressable>
        </View>

        <View style={[styles.missionsCard, shadows.soft]}>
          <View style={styles.sectionTop}>
            <View>
              <Text style={styles.kicker}>СЕЙЧАС</Text>
              <Text style={styles.sectionTitle}>{isChild ? 'Мои маленькие шаги' : 'Ближайшие миссии'}</Text>
            </View>
            <View style={styles.countBadge}><Text style={styles.countBadgeText}>{activeMissions.length}</Text></View>
          </View>
          {activeMissions.length ? activeMissions.map((mission) => {
            const direction = directions.find((item) => item.id === mission.category);
            return (
              <View key={mission.id} style={styles.missionRow}>
                <View style={[styles.missionDot, { backgroundColor: direction?.ink ?? colors.teal }]} />
                <View style={styles.missionCopy}>
                  <Text style={styles.missionTitle}>{mission.title}</Text>
                  <Text style={styles.missionMeta}>{direction?.title ?? 'Папа & Я'} · {dueText(mission.due_at)} · +{mission.xp_reward} XP</Text>
                  {mission.description ? <Text style={styles.missionDescription}>{mission.description}</Text> : null}
                </View>
                <Pressable
                  disabled={busyMission === mission.id}
                  onPress={() => void completeMission(mission)}
                  style={[styles.checkButton, busyMission === mission.id && styles.disabled]}
                >
                  {busyMission === mission.id ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.checkButtonText}>✓</Text>}
                </Pressable>
              </View>
            );
          }) : (
            <View style={styles.emptyMission}>
              <Image source={require('../../assets/generated/utility-goal.png')} style={styles.emptyMissionImage} resizeMode="contain" />
              <Text style={styles.emptyMissionTitle}>Сейчас свободный участок пути</Text>
              <Text style={styles.emptyMissionText}>Можно просто жить, играть, учиться и сохранить важный момент в одном из журналов.</Text>
            </View>
          )}
        </View>

        <Pressable onPress={() => router.push('/(tabs)/yearbook')}>
          <LinearGradient colors={['#173F57', '#315E73', '#D39444']} style={[styles.bookCta, shadows.lift]}>
            <View style={styles.bookGlow} />
            <Image source={require('../../assets/generated/nav-book.png')} style={styles.bookIconImage} resizeMode="contain" />
            <View style={styles.bookCopy}>
              <Text style={styles.bookKicker}>КНИГА ГОДА</Text>
              <Text style={styles.bookTitle}>Из маленьких шагов складывается большая история</Text>
              <Text style={styles.bookText}>Открыть главу {age} лет →</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 34, gap: 16 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1 },
  heroValue: { color: colors.white, fontSize: 20, fontWeight: '900' },
  heroLabel: { color: '#D3E2E3', fontSize: 9, fontWeight: '800', marginTop: 1 },
  heroDivider: { width: 1, height: 29, backgroundColor: 'rgba(255,255,255,0.18)' },
  routeCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: '#E9DFD0' },
  sectionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 },
  kicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 },
  xpBadge: { backgroundColor: '#FFF0C7', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill },
  xpText: { color: '#A56E16', fontSize: 10, fontWeight: '900' },
  ageRail: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  agePart: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  ageNode: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#E8E3DA', alignItems: 'center', justifyContent: 'center' },
  agePassed: { backgroundColor: '#75A78D' },
  ageActive: { width: 33, height: 33, borderRadius: 17, backgroundColor: colors.amber, borderWidth: 3, borderColor: '#FFF4D8' },
  ageNodeText: { color: '#8A9694', fontSize: 9, fontWeight: '900' },
  ageNodeTextBright: { color: colors.white },
  ageLine: { flex: 1, height: 2, backgroundColor: '#E8E3DA' },
  ageLinePassed: { backgroundColor: '#A8C8B6' },
  routeNote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 14 },
  link: { color: colors.teal, fontSize: 10, fontWeight: '900' },
  directionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  directionPressable: { width: '48.5%' },
  directionWide: { width: '100%' },
  directionCard: { minHeight: 176, borderRadius: radius.lg, padding: 15, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  directionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  directionIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.58)', overflow: 'hidden' },
  directionIconImage: { width: 56, height: 56 },
  directionCount: { fontSize: 23, fontWeight: '900', opacity: 0.75 },
  directionTitle: { fontSize: 18, fontWeight: '900', marginTop: 9 },
  directionLine: { fontSize: 10, fontWeight: '700', marginTop: 3, opacity: 0.78 },
  directionOpen: { fontSize: 9, fontWeight: '900', marginTop: 13 },
  badgesCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, paddingVertical: 18, borderWidth: 1, borderColor: '#E9DFD0', overflow: 'hidden' },
  badgesIntro: { color: colors.muted, fontSize: 10, lineHeight: 15, paddingHorizontal: 18, marginTop: 8 },
  badgesProgress: { color: '#A56E16', fontSize: 12, fontWeight: '900', backgroundColor: '#FFF0C7', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, marginRight: 18 },
  badgesRow: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6, gap: 8 },
  badgeSlot: { width: 106, minHeight: 132, borderRadius: 18, backgroundColor: '#F8F2E7', borderWidth: 1, borderColor: '#E7D7BA', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 9 },
  badgeSlotLocked: { backgroundColor: '#F3F0EA', borderColor: '#E3DED5' },
  badgeImage: { width: 76, height: 76 },
  badgeImageLocked: { opacity: 0.28 },
  badgeTitle: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 4, textAlign: 'center' },
  badgeMeta: { color: colors.muted, fontSize: 7, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  badgesLink: { marginHorizontal: 18, marginTop: 10, minHeight: 42, borderRadius: 14, backgroundColor: '#EDF4F4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  badgesLinkText: { color: colors.teal, fontSize: 9, fontWeight: '900' },
  missionsCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: '#E9DFD0' },
  countBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: colors.white, fontWeight: '900' },
  missionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 78, borderTopWidth: 1, borderTopColor: '#EEE7DC', paddingVertical: 12, gap: 10 },
  missionDot: { width: 9, height: 9, borderRadius: 5 },
  missionCopy: { flex: 1 },
  missionTitle: { color: colors.navyDeep, fontSize: 13, fontWeight: '900' },
  missionMeta: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 3 },
  missionDescription: { color: '#66787C', fontSize: 9, lineHeight: 13, marginTop: 4 },
  checkButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  checkButtonText: { color: colors.white, fontSize: 19, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  emptyMission: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 14 },
  emptyMissionImage: { width: 94, height: 94 },
  emptyMissionTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', marginTop: 3 },
  emptyMissionText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 5 },
  bookCta: { minHeight: 155, borderRadius: radius.xl, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  bookGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,216,113,0.13)', right: -40, top: -55 },
  bookIconImage: { width: 68, height: 68, marginRight: 12 },
  bookCopy: { flex: 1 },
  bookKicker: { color: '#F5D89C', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  bookTitle: { color: colors.white, fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 5 },
  bookText: { color: '#E4EDEF', fontSize: 10, fontWeight: '800', marginTop: 8 },
});
