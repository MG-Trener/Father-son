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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type Cadence = 'weekly' | 'monthly' | 'flexible';

type Ritual = {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  symbol: string;
  cadence: Cadence;
  cadence_value: number | null;
  active: boolean;
  created_at: string;
};

type RitualMoment = {
  id: string;
  ritual_id: string;
  created_by: string;
  happened_on: string;
  note: string | null;
  created_at: string;
};

const symbols = ['♥', '♟', '⚽', '☕', '☎', '✦', 'EN', '🎬'];
const symbolImages: Record<string, ImageSourcePropType> = {
  '♥': require('../../assets/generated/feature-together.png'),
  '♟': require('../../assets/generated/direction-chess.png'),
  '⚽': require('../../assets/generated/direction-football.png'),
  '☕': require('../../assets/generated/feature-together.png'),
  '☎': require('../../assets/generated/utility-voice.png'),
  '✦': require('../../assets/generated/utility-recognition.png'),
  EN: require('../../assets/generated/direction-english.png'),
  '🎬': require('../../assets/generated/feature-book.png'),
};
const fallbackImage = require('../../assets/generated/feature-together.png');
const weekDays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const localDay = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const cadenceLabel = (ritual: Ritual) => {
  if (ritual.cadence === 'weekly' && ritual.cadence_value !== null) return `каждую неделю · ${weekDays[ritual.cadence_value]}`;
  if (ritual.cadence === 'monthly' && ritual.cadence_value !== null) return `каждый месяц · ${ritual.cadence_value} число`;
  return 'когда хочется';
};

const momentDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export default function RitualsScreen() {
  const { session } = useAuth();
  const { family, members } = useFamily();
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [moments, setMoments] = useState<RitualMoment[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [symbol, setSymbol] = useState('♥');
  const [cadence, setCadence] = useState<Cadence>('flexible');
  const [weekDay, setWeekDay] = useState(new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !family) {
      setLoading(false);
      return;
    }

    const [ritualResult, momentResult] = await Promise.all([
      client
        .from('family_rituals')
        .select('id,created_by,title,description,symbol,cadence,cadence_value,active,created_at')
        .eq('family_id', family.id)
        .eq('active', true)
        .order('created_at', { ascending: true }),
      client
        .from('ritual_moments')
        .select('id,ritual_id,created_by,happened_on,note,created_at')
        .eq('family_id', family.id)
        .order('happened_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(80),
    ]);

    if (ritualResult.error) Alert.alert('Не удалось загрузить ритуалы', ritualResult.error.message);
    else setRituals((ritualResult.data ?? []) as Ritual[]);
    if (!momentResult.error) setMoments((momentResult.data ?? []) as RitualMoment[]);
    setLoading(false);
  }, [family]);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const createRitual = async () => {
    const client = supabase;
    if (!client || !family || !session || busyId) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Дай ритуалу имя', 'Например: «Воскресный звонок» или «Партия в шахматы».');
      return;
    }

    setBusyId('create');
    try {
      const { error } = await client.from('family_rituals').insert({
        family_id: family.id,
        created_by: session.user.id,
        title: cleanTitle.slice(0, 100),
        description: description.trim().slice(0, 500) || null,
        symbol,
        cadence,
        cadence_value: cadence === 'weekly' ? weekDay : null,
      });
      if (error) throw error;
      setTitle('');
      setDescription('');
      setSymbol('♥');
      setCadence('flexible');
      setShowCreate(false);
      await load();
    } catch (caught) {
      Alert.alert('Не удалось создать ритуал', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusyId(null);
    }
  };

  const markToday = async (ritual: Ritual) => {
    const client = supabase;
    if (!client || !family || !session || busyId) return;
    const today = localDay();
    if (moments.some((item) => item.ritual_id === ritual.id && item.happened_on === today)) {
      Alert.alert('Уже сохранено', 'Этот ритуал уже отмечен сегодня.');
      return;
    }

    setBusyId(ritual.id);
    try {
      const { error } = await client.from('ritual_moments').insert({
        ritual_id: ritual.id,
        family_id: family.id,
        created_by: session.user.id,
        happened_on: today,
      });
      if (error) throw error;
      await client.from('activity_events').insert({
        family_id: family.id,
        actor_user_id: session.user.id,
        event_type: 'ritual_moment_added',
        category: 'together',
        payload: { ritual_id: ritual.id, title: ritual.title, symbol: ritual.symbol },
      });
      await load();
    } catch (caught) {
      Alert.alert('Не удалось сохранить момент', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusyId(null);
    }
  };

  const archiveRitual = (ritual: Ritual) => {
    const client = supabase;
    if (!client || !family || !session || ritual.created_by !== session.user.id || busyId) return;
    Alert.alert('Убрать ритуал?', 'История уже случившихся моментов останется.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Убрать',
        style: 'destructive',
        onPress: () => void (async () => {
          setBusyId(ritual.id);
          try {
            const { error } = await client
              .from('family_rituals')
              .update({ active: false, updated_at: new Date().toISOString() })
              .eq('id', ritual.id)
              .eq('family_id', family.id)
              .eq('created_by', session.user.id);
            if (error) throw error;
            await load();
          } catch (caught) {
            Alert.alert('Не удалось убрать ритуал', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
          } finally {
            setBusyId(null);
          }
        })(),
      },
    ]);
  };

  const momentsFor = (ritualId: string) => moments.filter((item) => item.ritual_id === ritualId);
  const today = localDay();

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.navy} />}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topCopy}><Text style={styles.topKicker}>ПОВТОРЯТЬ, ПОТОМУ ЧТО ХОЧЕТСЯ</Text><Text style={styles.topTitle}>Наши ритуалы</Text></View>
          <Pressable style={styles.addTop} onPress={() => setShowCreate((value) => !value)}><Text style={styles.addTopText}>{showCreate ? '×' : '+'}</Text></Pressable>
        </View>

        <LinearGradient colors={['#183D4D', '#276A6E', '#D2964A']} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroGlow} />
          <View style={styles.heroSymbols}>
            <View style={styles.heroSymbol}><Image source={require('../../assets/generated/utility-voice.png')} style={styles.heroSymbolImage} resizeMode="contain" /></View>
            <View style={styles.heroLine} />
            <View style={styles.heroSymbol}><Image source={require('../../assets/generated/direction-chess.png')} style={styles.heroSymbolImage} resizeMode="contain" /></View>
            <View style={styles.heroLine} />
            <View style={styles.heroSymbol}><Image source={require('../../assets/generated/direction-football.png')} style={styles.heroSymbolImage} resizeMode="contain" /></View>
          </View>
          <Text style={styles.heroTitle}>Связь держится не на серии дней, а на вещах, к которым хочется возвращаться.</Text>
          <Text style={styles.heroText}>Пропустили неделю — ничего не сломалось. Просто продолжайте, когда получится.</Text>
        </LinearGradient>

        {showCreate ? (
          <View style={[styles.createCard, shadows.soft]}>
            <Text style={styles.sectionKicker}>НОВЫЙ РИТУАЛ</Text>
            <Text style={styles.sectionTitle}>Что хочется повторять?</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.symbolRail}>
              {symbols.map((item) => (
                <Pressable key={item} onPress={() => setSymbol(item)} style={[styles.symbolChoice, symbol === item && styles.symbolChoiceActive]}>
                  <Image source={symbolImages[item] ?? fallbackImage} style={[styles.symbolChoiceImage, symbol === item && styles.symbolChoiceImageActive]} resizeMode="contain" />
                </Pressable>
              ))}
            </ScrollView>

            <TextInput value={title} onChangeText={setTitle} maxLength={100} placeholder="Например: Воскресный звонок" placeholderTextColor={colors.mutedSoft} style={styles.input} />
            <TextInput value={description} onChangeText={setDescription} maxLength={500} multiline textAlignVertical="top" placeholder="Что делает этот ритуал вашим?" placeholderTextColor={colors.mutedSoft} style={[styles.input, styles.descriptionInput]} />

            <View style={styles.cadenceRow}>
              <Pressable onPress={() => setCadence('flexible')} style={[styles.cadenceChip, cadence === 'flexible' && styles.cadenceChipActive]}><Text style={[styles.cadenceText, cadence === 'flexible' && styles.cadenceTextActive]}>Когда хочется</Text></Pressable>
              <Pressable onPress={() => setCadence('weekly')} style={[styles.cadenceChip, cadence === 'weekly' && styles.cadenceChipActive]}><Text style={[styles.cadenceText, cadence === 'weekly' && styles.cadenceTextActive]}>Раз в неделю</Text></Pressable>
            </View>

            {cadence === 'weekly' ? (
              <View style={styles.weekRow}>
                {weekDays.map((day, index) => <Pressable key={day} onPress={() => setWeekDay(index)} style={[styles.dayChip, weekDay === index && styles.dayChipActive]}><Text style={[styles.dayText, weekDay === index && styles.dayTextActive]}>{day}</Text></Pressable>)}
              </View>
            ) : null}

            <Pressable disabled={busyId === 'create'} onPress={() => void createRitual()} style={[styles.createButton, busyId === 'create' && styles.disabled]}><Text style={styles.createButtonText}>{busyId === 'create' ? 'Сохраняем…' : 'Добавить наш ритуал'}</Text></Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHead}><View><Text style={styles.sectionKicker}>ЖИВЫЕ РИТУАЛЫ</Text><Text style={styles.sectionTitle}>То, к чему возвращаемся</Text></View><Text style={styles.count}>{rituals.length}</Text></View>

        {rituals.length ? (
          <View style={styles.ritualList}>
            {rituals.map((ritual, index) => {
              const ritualMoments = momentsFor(ritual.id);
              const doneToday = ritualMoments.some((item) => item.happened_on === today);
              const last = ritualMoments[0] ?? null;
              return (
                <View key={ritual.id} style={[styles.ritualCard, index % 2 === 0 ? styles.ritualWarm : styles.ritualCool, shadows.soft]}>
                  <View style={styles.ritualTop}>
                    <View style={styles.ritualSymbol}><Image source={symbolImages[ritual.symbol] ?? fallbackImage} style={styles.ritualSymbolImage} resizeMode="contain" /></View>
                    <View style={styles.ritualCopy}>
                      <Text style={styles.ritualCadence}>{cadenceLabel(ritual)}</Text>
                      <Text style={styles.ritualTitle}>{ritual.title}</Text>
                    </View>
                    <View style={styles.totalBubble}><Text style={styles.totalValue}>{ritualMoments.length}</Text><Text style={styles.totalLabel}>раз</Text></View>
                  </View>
                  {ritual.description ? <Text style={styles.ritualDescription}>{ritual.description}</Text> : null}
                  <View style={styles.ritualFoot}>
                    <Text style={styles.lastMoment}>{last ? `Последний раз · ${momentDate(last.happened_on)}` : 'Первый момент ещё впереди'}</Text>
                    {ritual.created_by === session?.user.id ? <Pressable onPress={() => archiveRitual(ritual)}><Text style={styles.archiveText}>убрать</Text></Pressable> : null}
                  </View>
                  <Pressable disabled={Boolean(busyId) || doneToday} onPress={() => void markToday(ritual)} style={[styles.doneButton, doneToday && styles.doneButtonDone, Boolean(busyId) && !doneToday && styles.disabled]}>
                    <Text style={[styles.doneButtonText, doneToday && styles.doneButtonTextDone]}>{doneToday ? '✓ Было сегодня' : busyId === ritual.id ? 'Сохраняем…' : 'Было сегодня'}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <Pressable style={[styles.empty, shadows.soft]} onPress={() => setShowCreate(true)}>
            <Image source={require('../../assets/generated/feature-together.png')} style={styles.emptyImage} resizeMode="contain" />
            <Text style={styles.emptyTitle}>Создайте первый ритуал</Text>
            <Text style={styles.emptyText}>Это может быть что угодно маленькое, но ваше: звонок, игра, вопрос, совместный матч или традиционная шутка.</Text>
          </Pressable>
        )}

        <View style={styles.sectionHead}><View><Text style={styles.sectionKicker}>МЫ ЭТО ДЕЛАЛИ</Text><Text style={styles.sectionTitle}>Недавние моменты</Text></View></View>
        <View style={styles.momentList}>
          {moments.slice(0, 14).map((moment) => {
            const ritual = rituals.find((item) => item.id === moment.ritual_id);
            return (
              <View key={moment.id} style={styles.momentRow}>
                <View style={styles.momentDot}><Image source={symbolImages[ritual?.symbol ?? ''] ?? fallbackImage} style={styles.momentImage} resizeMode="contain" /></View>
                <View style={styles.momentCopy}><Text style={styles.momentTitle}>{ritual?.title ?? 'Наш ритуал'}</Text><Text style={styles.momentMeta}>{momentDate(moment.happened_on)} · отметил {names.get(moment.created_by) ?? 'участник'}</Text></View>
              </View>
            );
          })}
          {!moments.length ? <View style={styles.momentEmpty}><Text style={styles.momentEmptyText}>Здесь появятся только реальные моменты — без штрафов за паузы и без потерянных серий.</Text></View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 32, lineHeight: 34, marginTop: -3 },
  topCopy: { flex: 1 },
  topKicker: { color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 2 },
  addTop: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  addTopText: { color: colors.white, fontSize: 24, lineHeight: 26, fontWeight: '800' },
  hero: { minHeight: 270, borderRadius: radius.xl, padding: 22, justifyContent: 'flex-end', overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -70, top: -80, backgroundColor: 'rgba(255,215,106,0.14)' },
  heroSymbols: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  heroSymbol: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroSymbolImage: { width: 44, height: 44 },
  heroLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.34)', marginHorizontal: 8 },
  heroTitle: { color: colors.white, fontSize: 23, lineHeight: 28, fontWeight: '900', maxWidth: '95%' },
  heroText: { color: '#D9E8E7', fontSize: 11, lineHeight: 17, marginTop: 9, maxWidth: '92%' },
  createCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18 },
  sectionKicker: { color: colors.teal, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  sectionTitle: { color: colors.text, fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 3 },
  symbolRail: { gap: 7, paddingVertical: 14 },
  symbolChoice: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F1EEE7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.lineWarm },
  symbolChoiceActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  symbolChoiceImage: { width: 42, height: 42, opacity: 0.88 },
  symbolChoiceImageActive: { opacity: 1 },
  input: { minHeight: 48, borderRadius: radius.md, backgroundColor: '#F5F2EB', borderWidth: 1, borderColor: colors.lineWarm, paddingHorizontal: 13, color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 8 },
  descriptionInput: { minHeight: 86, paddingTop: 13 },
  cadenceRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  cadenceChip: { flex: 1, minHeight: 40, borderRadius: 20, backgroundColor: '#EEF0EB', alignItems: 'center', justifyContent: 'center' },
  cadenceChipActive: { backgroundColor: colors.navy },
  cadenceText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  cadenceTextActive: { color: colors.white },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  dayChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1EEE7', alignItems: 'center', justifyContent: 'center' },
  dayChipActive: { backgroundColor: colors.amber },
  dayText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  dayTextActive: { color: colors.navyDeep },
  createButton: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  createButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  count: { minWidth: 36, height: 36, borderRadius: 18, backgroundColor: colors.sandWarm, textAlign: 'center', textAlignVertical: 'center', color: colors.navy, fontSize: 12, fontWeight: '900' },
  ritualList: { gap: 10 },
  ritualCard: { borderRadius: radius.lg, padding: 16 },
  ritualWarm: { backgroundColor: '#FFF0D2' },
  ritualCool: { backgroundColor: '#DDEDEF' },
  ritualTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ritualSymbol: { width: 50, height: 50, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ritualSymbolImage: { width: 46, height: 46 },
  ritualCopy: { flex: 1 },
  ritualCadence: { color: colors.teal, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  ritualTitle: { color: colors.text, fontSize: 17, lineHeight: 20, fontWeight: '900', marginTop: 3 },
  totalBubble: { minWidth: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center' },
  totalValue: { color: colors.navy, fontSize: 14, fontWeight: '900' },
  totalLabel: { color: colors.muted, fontSize: 7, fontWeight: '800' },
  ritualDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 12 },
  ritualFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 13 },
  lastMoment: { flex: 1, color: colors.mutedSoft, fontSize: 8, fontWeight: '800' },
  archiveText: { color: colors.mutedSoft, fontSize: 8, fontWeight: '900', textDecorationLine: 'underline' },
  doneButton: { minHeight: 45, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 11 },
  doneButtonDone: { backgroundColor: colors.green },
  doneButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  doneButtonTextDone: { color: colors.white },
  empty: { minHeight: 180, borderRadius: radius.xl, backgroundColor: colors.paper, padding: 20, alignItems: 'center', justifyContent: 'center' },
  emptyImage: { width: 72, height: 72 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 8 },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 5, maxWidth: '90%' },
  momentList: { gap: 7 },
  momentRow: { minHeight: 66, borderRadius: radius.md, backgroundColor: colors.paper, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  momentDot: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  momentImage: { width: 38, height: 38 },
  momentCopy: { flex: 1 },
  momentTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  momentMeta: { color: colors.mutedSoft, fontSize: 8, fontWeight: '700', marginTop: 3 },
  momentEmpty: { borderRadius: radius.md, backgroundColor: '#EEEAE2', padding: 15 },
  momentEmptyText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});