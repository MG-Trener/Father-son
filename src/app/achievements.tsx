import { AppScrollView as ScrollView } from '../components/AppScrollView';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  type ImageSourcePropType,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StoryHero } from '../components/StoryHero';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type Award = { id: string; definition_id: string; awarded_at: string };
type Definition = { id: string; title: string; category: string };
type PathId = 'school' | 'football' | 'chess' | 'english' | 'leadership' | 'together';

type Path = {
  id: PathId;
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
  colors: readonly [string, string];
  ink: string;
};

const paths: Path[] = [
  { id: 'school', title: 'Школа', subtitle: 'Самостоятельность и интерес', image: require('../../assets/generated/badge-school.png'), colors: ['#EEF6FA', '#DCECF4'], ink: '#35698D' },
  { id: 'football', title: 'Футбол', subtitle: 'Команда, характер, движение', image: require('../../assets/generated/badge-football.png'), colors: ['#EDF6EF', '#DCEBDD'], ink: '#397058' },
  { id: 'chess', title: 'Шахматы', subtitle: 'Спокойствие и стратегия', image: require('../../assets/generated/badge-chess.png'), colors: ['#F3EFF8', '#E2DAEF'], ink: '#5E5495' },
  { id: 'english', title: 'English', subtitle: 'Язык в реальной жизни', image: require('../../assets/generated/badge-english.png'), colors: ['#FFF8E4', '#F8E8BB'], ink: '#96651B' },
  { id: 'leadership', title: 'Лидерство', subtitle: 'Ответственность и выбор', image: require('../../assets/generated/badge-courage.png'), colors: ['#FFF0E7', '#F6D9CA'], ink: '#8D5246' },
  { id: 'together', title: 'Папа & Я', subtitle: 'Связь, память и доверие', image: require('../../assets/generated/badge-team.png'), colors: ['#E9F2F3', '#D4E6E8'], ink: '#2D6D73' },
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

const normalizeCategory = (value: string | null | undefined): PathId => {
  const key = (value ?? '').toLowerCase();
  if (key.includes('school') || key.includes('школ')) return 'school';
  if (key.includes('football') || key.includes('фут')) return 'football';
  if (key.includes('chess') || key.includes('шах')) return 'chess';
  if (key.includes('english') || key.includes('англ')) return 'english';
  if (key.includes('lead') || key.includes('лидер')) return 'leadership';
  return 'together';
};

const prettyDate = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AchievementsScreen() {
  const { family, members, me } = useFamily();
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? members[0] ?? null, [members]);
  const isChild = me?.role === 'child';
  const childName = child?.display_name ?? 'Артур';
  const age = ageFromBirthDate(child?.birth_date ?? null);
  const [awards, setAwards] = useState<Award[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !family || !child) {
      setLoading(false);
      return;
    }

    const [awardsResult, definitionsResult] = await Promise.all([
      supabase.from('achievement_awards').select('id,definition_id,awarded_at').eq('family_id', family.id).eq('recipient_user_id', child.user_id).order('awarded_at', { ascending: false }).limit(300),
      supabase.from('achievement_definitions').select('id,title,category'),
    ]);

    const error = awardsResult.error ?? definitionsResult.error;
    if (error) Alert.alert('Не удалось загрузить гербы', error.message);
    else {
      setAwards((awardsResult.data ?? []) as Award[]);
      setDefinitions((definitionsResult.data ?? []) as Definition[]);
    }
    setLoading(false);
  }, [family, child]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const definitionsById = useMemo(() => new Map(definitions.map((item) => [item.id, item])), [definitions]);
  const pathCounts = useMemo(() => {
    const counts = new Map<PathId, number>();
    for (const award of awards) {
      const definition = definitionsById.get(award.definition_id);
      const path = normalizeCategory(definition?.category);
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    return counts;
  }, [awards, definitionsById]);

  const opened = useMemo(() => awards.map((award) => {
    const definition = definitionsById.get(award.definition_id);
    const pathId = normalizeCategory(definition?.category);
    const path: Path = paths.find((item) => item.id === pathId) ?? paths[5]!;
    return {
      id: award.id,
      title: definition?.title ?? 'Веха пути',
      date: award.awarded_at,
      path,
    };
  }), [awards, definitionsById]);

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
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View>
            <Text style={styles.topKicker}>РАЗВИТИЕ · 11–18</Text>
            <Text style={styles.topTitle}>Гербы пути</Text>
          </View>
        </View>

        <StoryHero
          kicker={isChild ? 'МОИ ДОКАЗАТЕЛЬСТВА РОСТА' : `ВЕХИ ${childName.toUpperCase()}`}
          title={`${awards.length} ${awards.length === 1 ? 'веха' : 'вех в истории'}`}
          subtitle={isChild
            ? 'Это не рейтинг и не гонка. Здесь остаются вещи, которые действительно случились и стали частью твоей истории.'
            : `Гербы не оценивают ${childName}. Они помогают не потерять реальные поступки, усилия и моменты взросления.`}
          emblemImage={require('../../assets/generated/badge-adventure.png')}
          variant="adventure"
          footer={(
            <View style={styles.heroFooter}>
              <Text style={styles.heroAge}>{age} лет · {stageName(age)}</Text>
              <Text style={styles.heroNote}>Ничего не сгорает после паузы</Text>
            </View>
          )}
        />

        <View style={[styles.ageCard, shadows.soft]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>ПУТЬ 11 → 18</Text>
              <Text style={styles.sectionTitle}>Главы взросления</Text>
            </View>
            <Image source={require('../../assets/generated/utility-goal.png')} style={styles.routeImage} resizeMode="contain" />
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
          <Text style={styles.ageNote}>Возраст — контекст, а не дедлайн. Герб можно открыть раньше или позже, когда для него появился настоящий смысл.</Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.kicker}>ШЕСТЬ ПУТЕЙ</Text>
            <Text style={styles.sectionTitle}>Что уже стало частью истории</Text>
          </View>
        </View>

        <View style={styles.pathGrid}>
          {paths.map((path) => (
            <LinearGradient key={path.id} colors={path.colors} style={[styles.pathCard, shadows.soft]}>
              <Image source={path.image} style={styles.pathImage} resizeMode="contain" />
              <Text style={[styles.pathCount, { color: path.ink }]}>{pathCounts.get(path.id) ?? 0}</Text>
              <Text style={[styles.pathTitle, { color: path.ink }]}>{path.title}</Text>
              <Text style={[styles.pathSubtitle, { color: path.ink }]}>{path.subtitle}</Text>
            </LinearGradient>
          ))}
        </View>

        <View style={[styles.collectionCard, shadows.soft]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>ОТКРЫТО</Text>
              <Text style={styles.sectionTitle}>Коллекция гербов</Text>
            </View>
            <Text style={styles.totalBadge}>{opened.length}</Text>
          </View>

          {opened.length ? (
            <View style={styles.awardGrid}>
              {opened.map((award) => (
                <View key={award.id} style={styles.awardCard}>
                  <Image source={award.path.image} style={styles.awardImage} resizeMode="contain" />
                  <Text style={styles.awardTitle} numberOfLines={2}>{award.title}</Text>
                  <Text style={[styles.awardCategory, { color: award.path.ink }]}>{award.path.title}</Text>
                  <Text style={styles.awardDate}>{prettyDate(award.date)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Image source={require('../../assets/generated/utility-recognition.png')} style={styles.emptyImage} resizeMode="contain" />
              <Text style={styles.emptyTitle}>Первый герб ещё впереди</Text>
              <Text style={styles.emptyText}>Мы не показываем скрытые достижения как чеклист. Когда появится настоящая веха, она откроется здесь.</Text>
            </View>
          )}
        </View>

        <Pressable style={[styles.yearBookLink, shadows.soft]} onPress={() => router.push('/(tabs)/yearbook')}>
          <Image source={require('../../assets/generated/nav-book.png')} style={styles.yearBookImage} resizeMode="contain" />
          <View style={styles.yearBookCopy}>
            <Text style={styles.yearBookKicker}>КНИГА ГОДА</Text>
            <Text style={styles.yearBookTitle}>Посмотреть, где эти вехи появились в вашей общей истории</Text>
          </View>
          <Text style={styles.yearBookArrow}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { padding: 16, paddingBottom: 38, gap: 16 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E6DED1', alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topKicker: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 1 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heroAge: { color: colors.white, fontSize: 14, fontWeight: '900' },
  heroNote: { color: '#D8E6E7', fontSize: 14, fontWeight: '800', flex: 1, textAlign: 'right' },
  ageCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: '#E9DFD0' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  kicker: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 3, letterSpacing: -0.35 },
  routeImage: { width: 68, height: 68 },
  ageRail: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  agePart: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  ageNode: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#E8E3DA', alignItems: 'center', justifyContent: 'center' },
  agePassed: { backgroundColor: '#75A78D' },
  ageActive: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, borderWidth: 3, borderColor: '#FFF4D8' },
  ageNodeText: { color: '#8A9694', fontSize: 14, fontWeight: '900' },
  ageNodeTextBright: { color: colors.white },
  ageLine: { flex: 1, height: 2, backgroundColor: '#E8E3DA' },
  ageLinePassed: { backgroundColor: '#A8C8B6' },
  ageNote: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 14 },
  pathGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pathCard: { width: '48.5%', minHeight: 178, borderRadius: radius.xl, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)' },
  pathImage: { width: 70, height: 70 },
  pathCount: { position: 'absolute', right: 14, top: 15, fontSize: 26, fontWeight: '900', opacity: 0.78 },
  pathTitle: { fontSize: 17, fontWeight: '900', marginTop: 8 },
  pathSubtitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', opacity: 0.78, marginTop: 3 },
  collectionCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: '#E9DFD0' },
  totalBadge: { minWidth: 38, height: 38, borderRadius: 19, paddingHorizontal: 10, backgroundColor: colors.navyDeep, color: colors.white, textAlign: 'center', textAlignVertical: 'center', fontWeight: '900' },
  awardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 15 },
  awardCard: { width: '48.5%', minHeight: 178, borderRadius: 18, backgroundColor: '#F8F2E7', borderWidth: 1, borderColor: '#E7D7BA', alignItems: 'center', padding: 10 },
  awardImage: { width: 88, height: 88 },
  awardTitle: { color: colors.navyDeep, fontSize: 14, lineHeight: 20, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  awardCategory: { fontSize: 14, fontWeight: '900', marginTop: 4 },
  awardDate: { color: colors.muted, fontSize: 14, fontWeight: '700', marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16 },
  emptyImage: { width: 104, height: 104 },
  emptyTitle: { color: colors.navyDeep, fontSize: 15, fontWeight: '900', marginTop: 4 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  yearBookLink: { minHeight: 92, borderRadius: radius.xl, backgroundColor: colors.navyDeep, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearBookImage: { width: 62, height: 62 },
  yearBookCopy: { flex: 1 },
  yearBookKicker: { color: '#F4D493', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  yearBookTitle: { color: colors.white, fontSize: 14, lineHeight: 20, fontWeight: '900', marginTop: 4 },
  yearBookArrow: { color: colors.sun, fontSize: 28, fontWeight: '900' },
});
