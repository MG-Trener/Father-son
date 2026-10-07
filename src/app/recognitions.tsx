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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StoryHero } from '../components/StoryHero';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { notifyFamilyEvent } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type Category = 'school' | 'football' | 'chess' | 'english' | 'leadership' | 'together';

type RecognitionRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  category: Category;
  quality: string;
  title: string;
  note: string;
  created_at: string;
};

type CategoryItem = { value: Category; image: ImageSourcePropType; label: string };

const categories: CategoryItem[] = [
  { value: 'together', image: require('../../assets/generated/nav-together.png'), label: 'Мы' },
  { value: 'school', image: require('../../assets/generated/direction-school.png'), label: 'Школа' },
  { value: 'football', image: require('../../assets/generated/direction-football.png'), label: 'Футбол' },
  { value: 'chess', image: require('../../assets/generated/direction-chess.png'), label: 'Шахматы' },
  { value: 'english', image: require('../../assets/generated/direction-english.png'), label: 'English' },
  { value: 'leadership', image: require('../../assets/generated/direction-leadership.png'), label: 'Характер' },
];

const recognitionImage = require('../../assets/generated/utility-recognition.png');
const qualities = ['Настойчивость', 'Доброта', 'Смелость', 'Самостоятельность', 'Внимательность', 'Юмор', 'Честность', 'Поддержка'];
const starters = ['Я заметил…', 'Спасибо за…', 'Горжусь тем, как ты…', 'Мне понравилось, что ты…'];

const categoryMeta = (value: Category) => categories.find((item) => item.value === value) ?? categories[0]!;

export default function RecognitionsScreen() {
  const { session } = useAuth();
  const { family, members, me } = useFamily();
  const other = useMemo(() => members.find((member) => member.user_id !== me?.user_id) ?? null, [members, me]);
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const [rows, setRows] = useState<RecognitionRow[]>([]);
  const [category, setCategory] = useState<Category>('together');
  const [quality, setQuality] = useState('Поддержка');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !family) {
      setLoading(false);
      return;
    }
    const { data, error } = await client
      .from('recognitions')
      .select('id,from_user_id,to_user_id,category,quality,title,note,created_at')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) Alert.alert('Не удалось загрузить признания', error.message);
    else setRows((data ?? []) as RecognitionRow[]);
    setLoading(false);
  }, [family]);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const send = async () => {
    const client = supabase;
    if (!client || !family || !session || !other || busy) return;
    const cleanTitle = title.trim();
    const cleanNote = note.trim();
    if (!cleanTitle) {
      Alert.alert('Добавь короткий заголовок', 'Например: «Не сдался после ошибки».');
      return;
    }
    if (!cleanNote) {
      Alert.alert('Добавь пару слов', 'Лучше всего работает конкретный момент, который ты действительно заметил.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await client
        .from('recognitions')
        .insert({
          family_id: family.id,
          from_user_id: session.user.id,
          to_user_id: other.user_id,
          category,
          quality: quality.trim().slice(0, 80),
          title: cleanTitle.slice(0, 120),
          note: cleanNote.slice(0, 1500),
        })
        .select('id')
        .single();
      if (error) throw error;

      const eventResult = await client
        .from('activity_events')
        .insert({
          family_id: family.id,
          actor_user_id: session.user.id,
          event_type: 'recognition_added',
          category,
          payload: {
            recognition_id: data.id,
            to_user_id: other.user_id,
            quality,
            title: cleanTitle.slice(0, 120),
          },
        })
        .select('id')
        .single();
      if (eventResult.error) throw eventResult.error;
      if (eventResult.data?.id) void notifyFamilyEvent(eventResult.data.id);

      setTitle('');
      setNote('');
      setCategory('together');
      setQuality('Поддержка');
      await load();
      Alert.alert('Отправлено ✦', `${other.display_name} увидит, что именно ты заметил.`);
    } catch (caught) {
      Alert.alert('Не удалось отправить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.navy} />}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topCopy}><Text style={styles.topKicker}>БЕЗ БАЛЛОВ И РЕЙТИНГОВ</Text><Text style={styles.topTitle}>Я заметил</Text></View>
        </View>

        <StoryHero
          kicker="ПОДДЕРЖКА · ПАПА & Я"
          title="Хорошие вещи становятся важнее, когда их называют вслух."
          subtitle="Не «молодец вообще», а конкретно: что ты увидел, почувствовал или за что благодарен."
          variant="warm"
          emblemImage={recognitionImage}
        />

        {other ? (
          <View style={[styles.compose, shadows.soft]}>
            <View style={styles.toRow}>
              <View style={styles.toAvatar}><Text style={styles.toAvatarText}>{other.display_name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.toCopy}><Text style={styles.label}>ДЛЯ КОГО</Text><Text style={styles.toName}>{other.display_name}</Text></View>
              <View style={styles.toImageShell}><Image source={recognitionImage} style={styles.toImage} resizeMode="contain" /></View>
            </View>

            <Text style={styles.label}>ГДЕ ТЫ ЭТО ЗАМЕТИЛ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
              {categories.map((item) => {
                const active = category === item.value;
                return (
                  <Pressable key={item.value} onPress={() => setCategory(item.value)} style={[styles.categoryChip, active && styles.categoryChipActive]}>
                    <Image source={item.image} style={styles.categoryImage} resizeMode="contain" />
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>КАКОЕ КАЧЕСТВО</Text>
            <View style={styles.qualityWrap}>
              {qualities.map((item) => {
                const active = quality === item;
                return <Pressable key={item} onPress={() => setQuality(item)} style={[styles.qualityChip, active && styles.qualityChipActive]}><Text style={[styles.qualityText, active && styles.qualityTextActive]}>{item}</Text></Pressable>;
              })}
            </View>

            <Text style={styles.label}>МОЖНО НАЧАТЬ ТАК</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starterRail}>
              {starters.map((item) => <Pressable key={item} onPress={() => setTitle(item)} style={styles.starterChip}><Text style={styles.starterText}>{item}</Text></Pressable>)}
            </ScrollView>

            <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Короткий заголовок" placeholderTextColor={colors.mutedSoft} style={styles.titleInput} />
            <TextInput value={note} onChangeText={setNote} maxLength={1500} multiline textAlignVertical="top" placeholder="Например: «После пропущенного гола ты не спорил и сразу вернулся в игру. Я это заметил.»" placeholderTextColor={colors.mutedSoft} style={styles.noteInput} />
            <View style={styles.counterRow}><Text style={styles.counterHint}>Конкретный момент запоминается лучше общей похвалы.</Text><Text style={styles.counter}>{note.length}/1500</Text></View>

            <Pressable onPress={() => void send()} disabled={busy} style={[styles.sendButton, busy && styles.disabled]}>
              <Text style={styles.sendText}>{busy ? 'Отправляем…' : `Отправить ${other.display_name}`}</Text>
              {!busy ? <Text style={styles.sendArrow}>→</Text> : null}
            </Pressable>
          </View>
        ) : (
          <View style={styles.empty}><Image source={recognitionImage} style={styles.emptyImage} resizeMode="contain" /><Text style={styles.emptyText}>Когда второй участник подключится к семейной команде, здесь можно будет замечать хорошие моменты друг друга.</Text></View>
        )}

        <View style={styles.sectionHead}><Text style={styles.sectionKicker}>НАША КОЛЛЕКЦИЯ</Text><Text style={styles.sectionTitle}>То, что мы друг в друге замечаем</Text></View>
        <View style={styles.list}>
          {rows.map((row) => {
            const from = names.get(row.from_user_id) ?? 'Участник';
            const to = names.get(row.to_user_id) ?? 'Участник';
            const mine = row.from_user_id === me?.user_id;
            const meta = categoryMeta(row.category);
            return (
              <View key={row.id} style={[styles.card, shadows.soft]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardCategory}><Image source={meta.image} style={styles.cardCategoryImage} resizeMode="contain" /><Text style={styles.cardCategoryText}>{meta.label}</Text></View>
                  <Text style={styles.cardDate}>{new Date(row.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</Text>
                </View>
                <Text style={styles.cardQuality}>{row.quality}</Text>
                <Text style={styles.cardTitle}>{row.title}</Text>
                <Text style={styles.cardNote}>{row.note}</Text>
                <View style={styles.cardFooter}><Text style={styles.cardFrom}>{mine ? 'Ты' : from} → {row.to_user_id === me?.user_id ? 'тебе' : to}</Text><Image source={recognitionImage} style={styles.cardSparkImage} resizeMode="contain" /></View>
              </View>
            );
          })}
          {!rows.length ? <View style={styles.empty}><Image source={recognitionImage} style={styles.emptyImage} resizeMode="contain" /><Text style={styles.emptyText}>Пока здесь пусто. Первое настоящее «я заметил» часто ценнее длинного списка достижений.</Text></View> : null}
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
  topKicker: { color: colors.purple, fontSize: 14, fontWeight: '900', letterSpacing: 1.3 },
  topTitle: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 2 },
  compose: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18 },
  toRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  toAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  toAvatarText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  toCopy: { flex: 1, marginLeft: 10 },
  toName: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  toImageShell: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#FFF0D2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  toImage: { width: 48, height: 48 },
  label: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1.1, marginTop: 4 },
  categoryRail: { gap: 7, paddingVertical: 10 },
  categoryChip: { minHeight: 48, borderRadius: 24, backgroundColor: '#F1EEE7', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'transparent' },
  categoryChipActive: { backgroundColor: '#FFF6E8', borderColor: '#E9C778' },
  categoryImage: { width: 34, height: 34 },
  categoryText: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  categoryTextActive: { color: colors.navyDeep },
  qualityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9, marginBottom: 14 },
  qualityChip: { minHeight: 34, borderRadius: 17, backgroundColor: '#EEEAF4', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  qualityChipActive: { backgroundColor: colors.purple },
  qualityText: { color: colors.purple, fontSize: 14, fontWeight: '900' },
  qualityTextActive: { color: colors.white },
  starterRail: { gap: 6, paddingVertical: 9 },
  starterChip: { minHeight: 34, borderRadius: 17, backgroundColor: colors.sandWarm, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  starterText: { color: colors.navy, fontSize: 14, fontWeight: '800' },
  titleInput: { minHeight: 48, borderRadius: radius.md, backgroundColor: '#F5F2EB', borderWidth: 1, borderColor: colors.lineWarm, paddingHorizontal: 13, color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 3 },
  noteInput: { minHeight: 115, borderRadius: radius.md, backgroundColor: '#F5F2EB', borderWidth: 1, borderColor: colors.lineWarm, padding: 13, color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 9 },
  counterRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginTop: 5 },
  counterHint: { flex: 1, color: colors.mutedSoft, fontSize: 14, lineHeight: 20 },
  counter: { color: colors.mutedSoft, fontSize: 14 },
  sendButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.navy, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 },
  sendText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  sendArrow: { color: colors.sun, fontSize: 20 },
  disabled: { opacity: 0.5 },
  sectionHead: { marginTop: 2 },
  sectionKicker: { color: colors.purple, fontSize: 14, fontWeight: '900', letterSpacing: 1.3 },
  sectionTitle: { color: colors.text, fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 3 },
  list: { gap: 10 },
  card: { backgroundColor: colors.paper, borderRadius: radius.lg, padding: 15 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  cardCategoryImage: { width: 32, height: 32 },
  cardCategoryText: { color: colors.teal, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  cardDate: { color: colors.mutedSoft, fontSize: 14, fontWeight: '700' },
  cardQuality: { color: colors.purple, fontSize: 14, fontWeight: '900', marginTop: 9, textTransform: 'uppercase' },
  cardTitle: { color: colors.text, fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 4 },
  cardNote: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.lineWarm },
  cardFrom: { color: colors.mutedSoft, fontSize: 14, fontWeight: '800' },
  cardSparkImage: { width: 32, height: 32 },
  empty: { borderRadius: radius.md, backgroundColor: '#EEEAE2', padding: 16, alignItems: 'center' },
  emptyImage: { width: 72, height: 72 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 5 },
});
