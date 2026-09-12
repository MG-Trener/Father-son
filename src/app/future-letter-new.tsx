import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

const artwork = {
  book: require('../../assets/generated/feature-book.png'),
  path: require('../../assets/generated/feature-path.png'),
  family: require('../../assets/generated/feature-family.png'),
  goal: require('../../assets/generated/utility-goal.png'),
} as const;

type LetterRow = {
  id: string;
  author_user_id: string;
  recipient_user_id: string;
  title: string;
  unlock_at: string;
  status: 'draft' | 'sealed';
};

type RpcResult = { letter_id?: string; status?: string };

const toIsoDay = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const parseDay = (value: string) => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const nextBirthday = (birthDate: string | null) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let result = new Date(now.getFullYear(), birth.getMonth(), birth.getDate(), 12, 0, 0);
  if (result.getTime() <= now.getTime()) result = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate(), 12, 0, 0);
  return result;
};

const birthdayAtAge = (birthDate: string | null, age: number) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const result = new Date(birth);
  result.setFullYear(birth.getFullYear() + age);
  return result.getTime() > Date.now() ? result : null;
};

export default function FutureLetterComposer() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { family, members, me } = useFamily();
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const other = useMemo(() => members.find((member) => member.user_id !== me?.user_id) ?? null, [members, me]);
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const letterId = typeof params.id === 'string' ? params.id : null;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [unlockDay, setUnlockDay] = useState('');
  const [loading, setLoading] = useState(Boolean(letterId));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!recipientId && me) setRecipientId(me.role === 'child' ? me.user_id : (child?.user_id ?? other?.user_id ?? me.user_id));
  }, [recipientId, me, child, other]);

  useEffect(() => {
    if (!unlockDay) {
      const birthday = nextBirthday(child?.birth_date ?? null);
      const fallback = new Date();
      fallback.setFullYear(fallback.getFullYear() + 1);
      setUnlockDay(toIsoDay(birthday ?? fallback));
    }
  }, [unlockDay, child?.birth_date]);

  const loadDraft = useCallback(async () => {
    const client = supabase;
    if (!letterId || !client || !me) return;
    const [letterResult, contentResult] = await Promise.all([
      client.from('future_letters').select('id,author_user_id,recipient_user_id,title,unlock_at,status').eq('id', letterId).single(),
      client.from('future_letter_contents').select('body').eq('letter_id', letterId).maybeSingle(),
    ]);
    if (letterResult.error) {
      Alert.alert('Черновик не найден', letterResult.error.message);
      router.back();
      return;
    }
    const row = letterResult.data as LetterRow;
    if (row.author_user_id !== me.user_id || row.status !== 'draft') {
      Alert.alert('Письмо уже запечатано', 'После запечатывания редактировать его нельзя.');
      router.replace('/letters');
      return;
    }
    if (contentResult.error || !contentResult.data) {
      Alert.alert('Не удалось открыть черновик', contentResult.error?.message ?? 'Текст недоступен.');
      router.back();
      return;
    }
    setTitle(row.title);
    setBody(String(contentResult.data.body ?? ''));
    setRecipientId(row.recipient_user_id);
    setUnlockDay(toIsoDay(new Date(row.unlock_at)));
    setLoading(false);
  }, [letterId, me]);

  useEffect(() => { void loadDraft(); }, [loadDraft]);

  const presets = useMemo(() => {
    const result: { label: string; date: Date }[] = [];
    const next = nextBirthday(child?.birth_date ?? null);
    if (next) result.push({ label: 'Следующий день рождения', date: next });
    const fifteen = birthdayAtAge(child?.birth_date ?? null, 15);
    if (fifteen) result.push({ label: 'В 15 лет', date: fifteen });
    const eighteen = birthdayAtAge(child?.birth_date ?? null, 18);
    if (eighteen) result.push({ label: 'В 18 лет', date: eighteen });
    const year = new Date();
    year.setFullYear(year.getFullYear() + 1);
    result.push({ label: 'Через год', date: year });
    return result;
  }, [child?.birth_date]);

  const validate = () => {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const date = parseDay(unlockDay);
    if (!cleanTitle) { Alert.alert('Добавь заголовок', 'Например: «Артуру в 15 лет».'); return null; }
    if (!cleanBody) { Alert.alert('Письмо пустое', 'Напиши хотя бы несколько слов.'); return null; }
    if (!recipientId) { Alert.alert('Выбери адресата'); return null; }
    if (!date || date.getTime() <= Date.now()) { Alert.alert('Проверь дату', 'Нужна будущая дата в формате ГГГГ-ММ-ДД.'); return null; }
    return { cleanTitle, cleanBody, date };
  };

  const save = async () => {
    const client = supabase;
    if (!client || !family || busy) return null;
    const valid = validate();
    if (!valid) return null;
    setBusy(true);
    try {
      if (letterId) {
        const { data, error } = await client.rpc('update_future_letter_draft', {
          p_letter_id: letterId,
          p_title: valid.cleanTitle,
          p_body: valid.cleanBody,
          p_unlock_at: valid.date.toISOString(),
          p_recipient_user_id: recipientId,
        });
        if (error) throw error;
        return ((data ?? {}) as RpcResult).letter_id ?? letterId;
      }
      const { data, error } = await client.rpc('create_future_letter', {
        p_family_id: family.id,
        p_recipient_user_id: recipientId,
        p_title: valid.cleanTitle,
        p_body: valid.cleanBody,
        p_unlock_at: valid.date.toISOString(),
      });
      if (error) throw error;
      return ((data ?? {}) as RpcResult).letter_id ?? null;
    } catch (caught) {
      Alert.alert('Не удалось сохранить письмо', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    const id = await save();
    if (!id) return;
    Alert.alert('Черновик сохранён', 'Можно вернуться к нему и дописать позже.', [{ text: 'Хорошо', onPress: () => router.replace('/letters') }]);
  };

  const seal = () => {
    const valid = validate();
    if (!valid) return;
    Alert.alert(
      'Запечатать письмо?',
      `После этого текст нельзя будет открыть или изменить до ${valid.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      [
        { text: 'Пока нет', style: 'cancel' },
        {
          text: 'Запечатать',
          onPress: () => void (async () => {
            const id = await save();
            const client = supabase;
            if (!id || !client) return;
            setBusy(true);
            try {
              const { error } = await client.rpc('seal_future_letter', { p_letter_id: id });
              if (error) throw error;
              Alert.alert('Письмо запечатано', 'Теперь содержание будет ждать своей даты.', [{ text: 'Готово', onPress: () => router.replace('/letters') }]);
            } catch (caught) {
              Alert.alert('Не удалось запечатать', caught instanceof Error ? caught.message : 'Черновик сохранён, попробуй запечатать позже.');
            } finally {
              setBusy(false);
            }
          })(),
        },
      ],
    );
  };

  const removeDraft = () => {
    const client = supabase;
    if (!letterId || !client) return;
    Alert.alert('Удалить черновик?', 'Текст будет удалён без возможности восстановления.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => void (async () => {
          setBusy(true);
          try {
            const { error } = await client.rpc('delete_future_letter_draft', { p_letter_id: letterId });
            if (error) throw error;
            router.replace('/letters');
          } catch (caught) {
            Alert.alert('Не удалось удалить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
          } finally {
            setBusy(false);
          }
        })(),
      },
    ]);
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View><Text style={styles.kicker}>ПИСЬМО В БУДУЩЕЕ</Text><Text style={styles.topTitle}>{letterId ? 'Черновик' : 'Новый конверт'}</Text></View>
        </View>

        <LinearGradient colors={['#173C54', '#355F70', '#D49B4B']} style={[styles.intro, shadows.lift]}>
          <View style={styles.introArtworkShell}><Image source={artwork.path} style={styles.introArtwork} resizeMode="contain" /></View>
          <Text style={styles.introTitle}>Пиши так, как будто время действительно пройдёт</Text>
          <Text style={styles.introText}>Не обязательно давать советы. Можно рассказать, каким был сегодняшний день, чего боишься, чем гордишься или что очень не хочется забыть.</Text>
        </LinearGradient>

        <View style={[styles.formCard, shadows.soft]}>
          <Text style={styles.label}>КОМУ</Text>
          <View style={styles.recipientRow}>
            {members.map((member) => {
              const active = recipientId === member.user_id;
              return (
                <Pressable key={member.user_id} onPress={() => setRecipientId(member.user_id)} style={[styles.recipient, active && styles.recipientActive]}>
                  <View style={[styles.avatar, active && styles.avatarActive]}><Text style={[styles.avatarText, active && styles.avatarTextActive]}>{member.display_name.slice(0, 1).toUpperCase()}</Text></View>
                  <Text style={[styles.recipientName, active && styles.recipientNameActive]}>{member.display_name}</Text>
                  <Text style={[styles.recipientRole, active && styles.recipientRoleActive]}>{member.user_id === me?.user_id ? 'себе' : member.role === 'parent' ? 'папе' : 'сыну'}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>ЗАГОЛОВОК</Text>
          <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder={`Например: «${names.get(recipientId) ?? 'Тебе'} в важный день»`} placeholderTextColor="#A1AAA9" style={styles.input} />

          <Text style={styles.label}>ТЕКСТ ПИСЬМА</Text>
          <TextInput value={body} onChangeText={setBody} maxLength={8000} placeholder="Что ты хочешь сказать человеку, который откроет это позже?" placeholderTextColor="#A1AAA9" multiline style={styles.bodyInput} />
          <Text style={styles.counter}>{body.length}/8000</Text>

          <Text style={styles.label}>КОГДА ОТКРЫТЬ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
            {presets.map((preset) => {
              const day = toIsoDay(preset.date);
              const active = unlockDay === day;
              return <Pressable key={`${preset.label}-${day}`} onPress={() => setUnlockDay(day)} style={[styles.preset, active && styles.presetActive]}><Text style={[styles.presetText, active && styles.presetTextActive]}>{preset.label}</Text></Pressable>;
            })}
          </ScrollView>
          <TextInput value={unlockDay} onChangeText={setUnlockDay} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="ГГГГ-ММ-ДД" placeholderTextColor="#A1AAA9" style={styles.dateInput} />
          <Text style={styles.dateHint}>Можно выбрать готовую дату выше или ввести свою.</Text>
        </View>

        <View style={[styles.sealInfo, shadows.soft]}>
          <View style={styles.lockCircle}><Image source={artwork.goal} style={styles.lockImage} resizeMode="contain" /></View>
          <View style={styles.sealCopy}><Text style={styles.sealTitle}>Что значит «запечатать»</Text><Text style={styles.sealText}>После запечатывания нельзя исправить дату, адресата или текст. Содержание снова станет доступно только после выбранной даты.</Text></View>
        </View>

        <Pressable disabled={busy} onPress={seal} style={[styles.sealButton, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color={colors.white} /> : <><Image source={artwork.book} style={styles.sealButtonImage} resizeMode="contain" /><Text style={styles.sealButtonText}>Сохранить и запечатать</Text></>}
        </Pressable>
        <Pressable disabled={busy} onPress={() => void saveDraft()} style={[styles.draftButton, busy && styles.disabled]}><Text style={styles.draftButtonText}>Сохранить как черновик</Text></Pressable>
        {letterId ? <Pressable disabled={busy} onPress={removeDraft} style={styles.deleteButton}><Text style={styles.deleteText}>Удалить черновик</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 34, gap: 14 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  back: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E8DFD1', alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 28, lineHeight: 28, fontWeight: '700', marginTop: -3 },
  kicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  topTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 2 },
  intro: { minHeight: 185, borderRadius: radius.xl, padding: 19, justifyContent: 'flex-end', overflow: 'hidden' },
  introArtworkShell: { position: 'absolute', right: 15, top: 13, width: 72, height: 72, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  introArtwork: { width: 63, height: 63 },
  introTitle: { color: colors.white, fontSize: 22, lineHeight: 25, fontWeight: '900', maxWidth: '86%' },
  introText: { color: '#DFE9E9', fontSize: 9, lineHeight: 14, marginTop: 7, maxWidth: '91%' },
  formCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 17, borderWidth: 1, borderColor: '#E8DFD1' },
  label: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 14, marginBottom: 7 },
  recipientRow: { flexDirection: 'row', gap: 8 },
  recipient: { flex: 1, minHeight: 95, borderRadius: 20, backgroundColor: '#F5F0E7', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  recipientActive: { backgroundColor: '#E6F0F1', borderColor: colors.teal },
  avatar: { width: 37, height: 37, borderRadius: 14, backgroundColor: '#D9D4CB', alignItems: 'center', justifyContent: 'center' },
  avatarActive: { backgroundColor: colors.teal },
  avatarText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  avatarTextActive: { color: colors.white },
  recipientName: { color: colors.navyDeep, fontSize: 11, fontWeight: '900', marginTop: 6 },
  recipientNameActive: { color: colors.teal },
  recipientRole: { color: colors.muted, fontSize: 7, fontWeight: '800', marginTop: 1 },
  recipientRoleActive: { color: colors.teal },
  input: { minHeight: 48, borderRadius: 16, backgroundColor: '#F5F0E7', paddingHorizontal: 13, color: colors.navyDeep, fontSize: 12, fontWeight: '700' },
  bodyInput: { minHeight: 190, borderRadius: 18, backgroundColor: '#F5F0E7', padding: 13, color: colors.navyDeep, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 7, marginTop: 4 },
  presets: { gap: 7, paddingBottom: 7 },
  preset: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: '#F1ECE4' },
  presetActive: { backgroundColor: colors.navyDeep },
  presetText: { color: colors.muted, fontSize: 8, fontWeight: '900' },
  presetTextActive: { color: colors.white },
  dateInput: { minHeight: 46, borderRadius: 15, backgroundColor: '#F5F0E7', paddingHorizontal: 13, color: colors.navyDeep, fontSize: 12, fontWeight: '800' },
  dateHint: { color: colors.muted, fontSize: 8, marginTop: 5 },
  sealInfo: { borderRadius: radius.lg, backgroundColor: '#FFF8E7', borderWidth: 1, borderColor: '#F0DEB6', padding: 15, flexDirection: 'row', gap: 11, alignItems: 'center' },
  lockCircle: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F7E4B8', alignItems: 'center', justifyContent: 'center' },
  lockImage: { width: 41, height: 41 },
  sealCopy: { flex: 1 },
  sealTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' },
  sealText: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 3 },
  sealButton: { minHeight: 56, borderRadius: 17, backgroundColor: colors.navyDeep, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  sealButtonImage: { width: 36, height: 36 },
  sealButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  draftButton: { minHeight: 46, borderRadius: 16, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E1D8CB', alignItems: 'center', justifyContent: 'center' },
  draftButtonText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' },
  deleteButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#B0645E', fontSize: 9, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
