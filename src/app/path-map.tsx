import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useFamily } from '../context/FamilyContext';
import { colors, radius, shadows } from '../theme';

type Chapter = {
  age: number;
  title: string;
  focus: string;
  together: string;
  image: number;
  tint: string;
  ink: string;
};

const chapters: Chapter[] = [
  { age: 11, title: 'Исследователь', focus: 'Пробовать новое и замечать, что по-настоящему интересно.', together: 'Собрать первые семейные ритуалы и сохранить старт пути.', image: require('../../assets/generated/badge-adventure.png'), tint: '#EAF3F4', ink: '#2D6D73' },
  { age: 12, title: 'Свой ритм', focus: 'Учиться распределять силы между школой, спортом и отдыхом.', together: 'Выбрать одну традицию, которую хочется сохранить надолго.', image: require('../../assets/generated/badge-planner.png'), tint: '#FFF3D6', ink: '#956719' },
  { age: 13, title: 'Следопыт', focus: 'Становиться самостоятельнее и смелее говорить о своём мнении.', together: 'Оставить первую большую голосовую историю о взрослении.', image: require('../../assets/generated/badge-courage.png'), tint: '#FFF0E7', ink: '#8D5246' },
  { age: 14, title: 'Стратег', focus: 'Понимать последствия решений и учиться спокойно исправлять ошибки.', together: 'Придумать совместный проект или поездку и довести её до конца.', image: require('../../assets/generated/badge-chess.png'), tint: '#F1EDF7', ink: '#5E5495' },
  { age: 15, title: 'Капитан', focus: 'Брать ответственность не потому, что заставили, а потому что это важно.', together: 'Открыть или написать письмо в будущее на следующий этап.', image: require('../../assets/generated/badge-football.png'), tint: '#EDF6EF', ink: '#397058' },
  { age: 16, title: 'Первопроходец', focus: 'Пробовать взрослые задачи: деньги, выбор, ответственность, новые навыки.', together: 'Сделать общий проект, которым вы оба сможете гордиться.', image: require('../../assets/generated/badge-school.png'), tint: '#EEF6FA', ink: '#35698D' },
  { age: 17, title: 'Наставник', focus: 'Уметь помогать другим и видеть собственные сильные стороны.', together: 'Подвести итоги нескольких лет и выбрать то, что хочется передать дальше.', image: require('../../assets/generated/badge-english.png'), tint: '#FFF8E4', ink: '#96651B' },
  { age: 18, title: 'Свой путь', focus: 'Собрать собственные принципы и идти дальше уже как взрослый человек.', together: 'Открыть семейную книгу 11→18 и сохранить финальное письмо главы.', image: require('../../assets/generated/badge-team.png'), tint: '#E9F2F3', ink: '#2D6D73' },
];

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return 11;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 11;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return Math.max(11, Math.min(18, age));
};

export default function PathMapScreen() {
  const { members, me } = useFamily();
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const childName = child?.display_name ?? 'Артур';
  const parentName = parent?.display_name ?? 'Папа';
  const currentAge = ageFromBirthDate(child?.birth_date ?? null);
  const currentChapter = chapters.find((chapter) => chapter.age === currentAge) ?? chapters[0]!;
  const isChild = me?.role === 'child';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Назад" style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={styles.kicker}>ПУТЬ 11 → 18</Text>
            <Text style={styles.topTitle}>Карта взросления</Text>
          </View>
        </View>

        <View style={[styles.hero, shadows.lift]}>
          <ImageBackground source={require('../../assets/generated/family-hero.png')} resizeMode="cover" imageStyle={styles.heroImage} style={styles.heroBackground}>
            <LinearGradient colors={['rgba(5,25,34,0.18)', 'rgba(5,25,34,0.72)', 'rgba(5,25,34,0.96)']} locations={[0, 0.55, 1]} style={styles.heroOverlay}>
              <View style={styles.heroBadge}>
                <Image source={currentChapter.image} style={styles.heroBadgeImage} resizeMode="contain" />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroKicker}>СЕЙЧАС · {currentAge} ЛЕТ</Text>
                <Text style={styles.heroTitle}>{currentChapter.title}</Text>
                <Text style={styles.heroText}>{isChild
                  ? 'Это не расписание жизни и не список обязательств. Карта нужна, чтобы видеть большую историю и не терять важное.'
                  : `${parentName} и ${childName} идут эту дорогу вместе. Здесь нет дедлайнов — только ориентиры, память и реальные шаги.`}</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

        <View style={[styles.nowCard, shadows.soft]}>
          <View style={styles.nowTop}>
            <Image source={require('../../assets/generated/feature-path.png')} style={styles.nowImage} resizeMode="contain" />
            <View style={styles.nowCopy}>
              <Text style={styles.sectionKicker}>ТЕКУЩАЯ ГЛАВА</Text>
              <Text style={styles.nowTitle}>{currentAge} · {currentChapter.title}</Text>
            </View>
          </View>
          <View style={styles.nowLine} />
          <Text style={styles.nowLabel}>ЛИЧНЫЙ ОРИЕНТИР</Text>
          <Text style={styles.nowText}>{currentChapter.focus}</Text>
          <Text style={styles.nowLabel}>ВМЕСТЕ</Text>
          <Text style={styles.nowText}>{currentChapter.together}</Text>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionKicker}>ВОСЕМЬ ГЛАВ</Text>
          <Text style={styles.sectionTitle}>Не план, а ориентиры на несколько лет</Text>
          <Text style={styles.sectionText}>Можно пройти что-то раньше, позже или вообще по-своему. Важные вещи не обнуляются после дня рождения.</Text>
        </View>

        <View style={styles.timeline}>
          {chapters.map((chapter, index) => {
            const passed = chapter.age < currentAge;
            const active = chapter.age === currentAge;
            return (
              <View key={chapter.age} style={styles.timelineRow}>
                <View style={styles.rail}>
                  <View style={[styles.node, passed && styles.nodePassed, active && styles.nodeActive]}>
                    <Text style={[styles.nodeText, (passed || active) && styles.nodeTextBright]}>{chapter.age}</Text>
                  </View>
                  {index < chapters.length - 1 ? <View style={[styles.railLine, passed && styles.railLinePassed]} /> : null}
                </View>
                <View style={[styles.chapterCard, { backgroundColor: chapter.tint, borderColor: `${chapter.ink}22` }, active && styles.chapterActive, shadows.soft]}>
                  <View style={styles.chapterTop}>
                    <Image source={chapter.image} style={styles.chapterImage} resizeMode="contain" />
                    <View style={styles.chapterCopy}>
                      <Text style={[styles.chapterEyebrow, { color: chapter.ink }]}>{passed ? 'ГЛАВА ПРОЙДЕНА' : active ? 'ТЕКУЩАЯ ГЛАВА' : 'ВПЕРЕДИ'}</Text>
                      <Text style={styles.chapterTitle}>{chapter.title}</Text>
                    </View>
                  </View>
                  <Text style={styles.chapterLabel}>Личный ориентир</Text>
                  <Text style={styles.chapterText}>{chapter.focus}</Text>
                  <Text style={styles.chapterLabel}>Папа & Я</Text>
                  <Text style={styles.chapterText}>{chapter.together}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.actionsCard, shadows.soft]}>
          <Text style={styles.actionsKicker}>СОХРАНЯТЬ, А НЕ СЧИТАТЬ</Text>
          <Text style={styles.actionsTitle}>Что наполняет эту карту смыслом</Text>
          <Text style={styles.actionsText}>Гербы, встречи, голосовые истории, письма и записи роста становятся доказательствами реальной жизни — без процентов и рейтинга.</Text>
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionPrimary} onPress={() => router.push('/achievements')}>
              <Image source={require('../../assets/generated/badge-courage.png')} style={styles.actionImage} resizeMode="contain" />
              <View style={styles.actionCopy}><Text style={styles.actionTitle}>Гербы пути</Text><Text style={styles.actionSub}>Что уже произошло</Text></View>
            </Pressable>
            <Pressable style={styles.actionSecondary} onPress={() => router.push('/(tabs)/yearbook')}>
              <Image source={require('../../assets/generated/feature-book.png')} style={styles.actionImage} resizeMode="contain" />
              <View style={styles.actionCopy}><Text style={styles.actionTitle}>Книга года</Text><Text style={styles.actionSub}>Собрать историю</Text></View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 16, paddingBottom: 38, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topCopy: { flex: 1 },
  kicker: { color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navyDeep, fontSize: 22, fontWeight: '900', marginTop: 2 },
  hero: { minHeight: 330, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.night },
  heroBackground: { flex: 1, minHeight: 330 },
  heroImage: { borderRadius: radius.xl },
  heroOverlay: { flex: 1, minHeight: 330, padding: 20, justifyContent: 'space-between' },
  heroBadge: { alignSelf: 'flex-end', width: 74, height: 74, borderRadius: 24, backgroundColor: 'rgba(255,248,233,0.92)', alignItems: 'center', justifyContent: 'center' },
  heroBadgeImage: { width: 68, height: 68 },
  heroCopy: { maxWidth: '94%' },
  heroKicker: { color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: colors.white, fontSize: 31, lineHeight: 34, fontWeight: '900', marginTop: 5 },
  heroText: { color: '#E2EBEC', fontSize: 11, lineHeight: 17, marginTop: 9, fontWeight: '700' },
  nowCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 17, borderWidth: 1, borderColor: colors.lineWarm },
  nowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowImage: { width: 58, height: 58 },
  nowCopy: { flex: 1 },
  sectionKicker: { color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  nowTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 2 },
  nowLine: { height: 1, backgroundColor: colors.lineWarm, marginVertical: 14 },
  nowLabel: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.1, marginTop: 5 },
  nowText: { color: colors.text, fontSize: 11, lineHeight: 17, fontWeight: '700', marginTop: 4 },
  sectionHead: { marginTop: 2 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, lineHeight: 25, fontWeight: '900', marginTop: 3 },
  sectionText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 6 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 42, alignItems: 'center' },
  node: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#DED9D0', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  nodePassed: { backgroundColor: colors.teal },
  nodeActive: { backgroundColor: colors.amber, borderWidth: 3, borderColor: '#FFF1C6' },
  nodeText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  nodeTextBright: { color: colors.white },
  railLine: { flex: 1, width: 2, minHeight: 165, backgroundColor: '#DED9D0' },
  railLinePassed: { backgroundColor: '#8EC0C1' },
  chapterCard: { flex: 1, borderRadius: radius.xl, padding: 15, borderWidth: 1, marginBottom: 12 },
  chapterActive: { borderWidth: 2, borderColor: colors.amber },
  chapterTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chapterImage: { width: 50, height: 50 },
  chapterCopy: { flex: 1 },
  chapterEyebrow: { fontSize: 7, fontWeight: '900', letterSpacing: 0.9 },
  chapterTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 2 },
  chapterLabel: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.9, marginTop: 12 },
  chapterText: { color: colors.text, fontSize: 10, lineHeight: 15, marginTop: 3 },
  actionsCard: { backgroundColor: '#173C4A', borderRadius: radius.xl, padding: 18 },
  actionsKicker: { color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  actionsTitle: { color: colors.white, fontSize: 21, lineHeight: 24, fontWeight: '900', marginTop: 4 },
  actionsText: { color: '#D6E5E6', fontSize: 10, lineHeight: 15, marginTop: 7 },
  actionsRow: { flexDirection: 'row', gap: 9, marginTop: 15 },
  actionPrimary: { flex: 1, minHeight: 90, borderRadius: radius.lg, backgroundColor: '#FFF0E7', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionSecondary: { flex: 1, minHeight: 90, borderRadius: radius.lg, backgroundColor: '#FFF3D6', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionImage: { width: 45, height: 45 },
  actionCopy: { flex: 1 },
  actionTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' },
  actionSub: { color: colors.muted, fontSize: 8, lineHeight: 11, marginTop: 2 },
});
