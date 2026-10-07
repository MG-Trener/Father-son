import { AppScrollView as ScrollView } from '../components/AppScrollView';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { brandAssets } from '../brandAssets';
import {
  createMission,
  getSkillNode,
  type MissionCategory,
  type SkillNode,
} from '../data/growthRepository';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, moduleColors, radius, shadows } from '../theme';

type CategoryMeta = { image: ImageSourcePropType; title: string };

const fallbackMeta: CategoryMeta = { image: brandAssets.features.together, title: 'Папа & Я' };

const categoryMeta: Record<MissionCategory, CategoryMeta> = {
  school: { image: brandAssets.directions.school, title: 'Школа' },
  football: { image: brandAssets.directions.football, title: 'Футбол' },
  chess: { image: brandAssets.directions.chess, title: 'Шахматы' },
  english: { image: brandAssets.directions.english, title: 'English' },
  leadership: { image: brandAssets.directions.leadership, title: 'Лидерство' },
  together: fallbackMeta,
};

const isMissionCategory = (value: unknown): value is MissionCategory => (
  value === 'school'
  || value === 'football'
  || value === 'chess'
  || value === 'english'
  || value === 'leadership'
  || value === 'together'
);

const categoryGradient = (category: MissionCategory) => {
  if (category === 'school') return gradients.school;
  if (category === 'football') return gradients.football;
  if (category === 'chess') return gradients.chess;
  if (category === 'english') return gradients.english;
  if (category === 'leadership') return gradients.leadership;
  return gradients.connection;
};

const categorySoft = (category: MissionCategory) => {
  if (category === 'school') return moduleColors.school.base;
  if (category === 'football') return moduleColors.football.base;
  if (category === 'chess') return moduleColors.chess.base;
  if (category === 'english') return moduleColors.english.base;
  if (category === 'leadership') return moduleColors.leadership.base;
  return colors.sandWarm;
};

const rewardForNode = (nodeType?: string) => {
  if (nodeType === 'mentor') return 25;
  if (nodeType === 'milestone') return 20;
  return 10;
};

export default function MissionNewScreen() {
  const params = useLocalSearchParams<{ category?: string; node?: string }>();
  const { session } = useAuth();
  const { family, me, members } = useFamily();
  const [node, setNode] = useState<SkillNode | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(Boolean(params.node));
  const [busy, setBusy] = useState(false);

  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const category: MissionCategory = isMissionCategory(node?.path_id)
    ? node.path_id
    : isMissionCategory(params.category)
      ? params.category
      : 'together';
  const assignee = category === 'together'
    ? (me?.role === 'child' ? parent ?? me : child ?? me)
    : child ?? me;
  const meta = categoryMeta[category];
  const xpReward = rewardForNode(node?.node_type);
  const isTogether = category === 'together';

  useEffect(() => {
    const client = supabase;
    const nodeId = typeof params.node === 'string' ? params.node : '';
    if (!client || !nodeId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void getSkillNode(client, nodeId)
      .then((nextNode) => {
        if (!mounted || !nextNode) return;
        setNode(nextNode);
        setTitle(nextNode.title);
        setDescription(nextNode.description);
      })
      .catch((caught) => {
        if (!mounted) return;
        Alert.alert('Не удалось открыть ступень', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [params.node]);

  const createMissionAction = async () => {
    const client = supabase;
    if (!client || !family || !session || !assignee || busy) return;
    if (!title.trim()) {
      Alert.alert('Добавь название', 'Коротко сформулируй, что нужно сделать.');
      return;
    }

    setBusy(true);
    try {
      const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      await createMission(client, {
        familyId: family.id,
        category,
        title: title.trim(),
        description: description.trim() || null,
        assignedTo: assignee.user_id,
        dueAt,
        xpReward,
        skillNodeId: node?.id ?? null,
      });

      Alert.alert(
        'Миссия создана',
        isTogether
          ? `${me?.display_name ?? 'Ты'} и ${assignee.display_name} сможете отметить её выполненной.`
          : `${assignee.display_name} увидит её в разделе «Развитие».`,
      );
      router.back();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Попробуй ещё раз.';
      if (message.includes('PREVIOUS_SKILL_STEP_REQUIRED') || message.includes('PREVIOUS_SKILL_NODE_REQUIRED')) {
        Alert.alert('Сначала предыдущий шаг', 'Эта ступень откроется после завершения предыдущей.');
      } else if (message.includes('ACTIVE_MISSION_ALREADY_EXISTS') || message.includes('ACTIVE_MISSION_EXISTS')) {
        Alert.alert('Миссия уже есть', 'Для этой ступени уже запущена активная миссия.');
      } else if (message.includes('SKILL_STEP_ALREADY_COMPLETED')) {
        Alert.alert('Ступень уже пройдена', 'Эта ступень уже отмечена выполненной. Выбери следующий шаг развития.');
      } else if (message.includes('INVALID_DUE_AT')) {
        Alert.alert('Проверь срок', 'Дата завершения миссии должна быть в будущем.');
      } else {
        Alert.alert('Не удалось создать миссию', message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <Text style={styles.topTitle}>{isTogether ? 'Совместная миссия' : 'Новая миссия'}</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
          ) : (
            <>
              <LinearGradient colors={categoryGradient(category)} style={[styles.hero, shadows.lift]}>
                <View style={styles.heroOrb} />
                <View style={styles.heroRing} />
                <View style={styles.heroTopRow}>
                  <View style={styles.iconBadge}><Image source={meta.image} style={styles.iconImage} resizeMode="contain" /></View>
                  <View style={styles.xpBadge}><Text style={styles.xpText}>+{xpReward} XP</Text></View>
                </View>
                <Text style={styles.heroKicker}>{meta.title.toUpperCase()}</Text>
                <Text style={styles.heroTitle}>{node ? node.title : isTogether ? 'Сделать что-то вместе' : 'Новый конкретный шаг'}</Text>
                <Text style={styles.heroCopy}>
                  {isTogether
                    ? `Напарник: ${assignee?.display_name ?? 'второй участник'}. Небольшое общее дело, где важен вклад обоих.`
                    : `Для ${assignee?.display_name ?? 'участника команды'}. Не оценка и не контроль — понятная задача с ясным финишем.`}
                </Text>
              </LinearGradient>

              <View style={[styles.formCard, shadows.soft]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: categorySoft(category) }]}>
                    <Image source={meta.image} style={styles.sectionIconImage} resizeMode="contain" />
                  </View>
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Соберём миссию</Text>
                    <Text style={styles.sectionCopy}>Коротко, понятно и так, чтобы хотелось отметить «готово».</Text>
                  </View>
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Название</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={isTogether ? 'Например: сыграть партию и выбрать лучший ход' : 'Например: сам выберу цель недели'}
                    placeholderTextColor={colors.mutedSoft}
                    style={styles.input}
                    maxLength={120}
                  />
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Что считается выполнением</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder={isTogether ? 'Что вы оба должны сделать?' : 'Один конкретный результат без двусмысленности'}
                    placeholderTextColor={colors.mutedSoft}
                    style={[styles.input, styles.descriptionInput]}
                    multiline
                    textAlignVertical="top"
                    maxLength={1000}
                  />
                </View>

                <View style={styles.fieldWrap}>
                  <View style={styles.deadlineRow}>
                    <Text style={styles.label}>Срок</Text>
                    <Text style={styles.deadlineHint}>{days === 3 ? 'быстрый рывок' : days === 7 ? 'на неделю' : days === 14 ? 'две недели' : 'на месяц'}</Text>
                  </View>
                  <View style={styles.daysRow}>
                    {[3, 7, 14, 30].map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setDays(value)}
                        style={[styles.dayChip, days === value && styles.dayChipActive]}
                      >
                        <Text style={[styles.dayNumber, days === value && styles.dayTextActive]}>{value}</Text>
                        <Text style={[styles.daySuffix, days === value && styles.dayTextActive]}>дн.</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.routePreview}>
                  <View style={styles.routeDot} />
                  <View style={styles.routeLine} />
                  <View style={styles.routeFlag}><Image source={brandAssets.utility.goal} style={styles.routeFlagImage} resizeMode="contain" /></View>
                  <View style={styles.routeLine} />
                  <View style={styles.routeReward}><Text style={styles.routeRewardText}>+{xpReward}</Text></View>
                </View>

                <Pressable
                  style={[styles.primary, (!assignee || busy) && styles.disabled]}
                  onPress={() => void createMissionAction()}
                  disabled={!assignee || busy}
                >
                  <LinearGradient colors={categoryGradient(category)} style={styles.primaryGradient}>
                    <Text style={styles.primaryText}>{busy ? 'Создаём…' : isTogether ? 'Запустить нашу миссию' : 'Запустить миссию'}</Text>
                    {!busy ? <Text style={styles.primaryArrow}>→</Text> : null}
                  </LinearGradient>
                </Pressable>
              </View>

              <View style={styles.noteCard}>
                <Image source={brandAssets.features.path} style={styles.noteImage} resizeMode="contain" />
                <Text style={styles.note}>
                  {isTogether
                    ? 'Автор и второй участник смогут завершить миссию. Результат и XP попадут в общую Историю.'
                    : 'После выполнения миссия попадёт в вашу Историю. Если она связана со ступенью развития, ступень закроется автоматически.'}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  content: { padding: 18, paddingBottom: 34, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 31, lineHeight: 33, marginTop: -2 },
  topTitle: { color: colors.navyDeep, fontSize: 19, fontWeight: '900' },
  loader: { marginTop: 50 },
  hero: { minHeight: 280, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  heroOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)', top: -56, right: -45 },
  heroRing: { position: 'absolute', width: 95, height: 95, borderRadius: 48, borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', top: 34, right: 38 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  iconBadge: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconImage: { width: 58, height: 58 },
  xpBadge: { backgroundColor: colors.sun, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  xpText: { color: colors.navyDeep, fontWeight: '900', fontSize: 14 },
  heroKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '900', letterSpacing: 1.6 },
  heroTitle: { color: colors.white, fontSize: 27, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6, marginTop: 5, maxWidth: '88%' },
  heroCopy: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: '94%' },
  formCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18, gap: 16, borderWidth: 1, borderColor: colors.lineWarm },
  sectionHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sectionIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sectionIconImage: { width: 46, height: 46 },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 19, fontWeight: '900' },
  sectionCopy: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
  fieldWrap: { gap: 6 },
  label: { color: colors.text, fontSize: 14, fontWeight: '900' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.white, color: colors.text, fontSize: 15 },
  descriptionInput: { minHeight: 108, paddingTop: 13, paddingBottom: 13 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deadlineHint: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  daysRow: { flexDirection: 'row', gap: 8 },
  dayChip: { flex: 1, minHeight: 58, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  dayChipActive: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep },
  dayNumber: { color: colors.navyDeep, fontWeight: '900', fontSize: 16 },
  daySuffix: { color: colors.muted, fontWeight: '800', fontSize: 14, marginTop: 1 },
  dayTextActive: { color: colors.white },
  routePreview: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  routeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.tealBright },
  routeLine: { flex: 1, height: 2, backgroundColor: colors.lineWarm },
  routeFlag: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  routeFlagImage: { width: 38, height: 38 },
  routeReward: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  routeRewardText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  primary: { borderRadius: radius.md, overflow: 'hidden' },
  primaryGradient: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18 },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 14 },
  primaryArrow: { color: colors.white, fontWeight: '900', fontSize: 20 },
  disabled: { opacity: 0.5 },
  noteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EEF5F2', borderRadius: radius.lg, padding: 14 },
  noteImage: { width: 42, height: 42 },
  note: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 20 },
});