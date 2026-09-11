import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

type Slide = {
  eyebrow: string;
  icon: string;
  title: string;
  text: string;
  points: Array<{ icon: string; title: string; text: string }>;
};

const parentSlides = (childName: string): Slide[] => [
  {
    eyebrow: 'ДЛЯ ПАПЫ',
    icon: '♥',
    title: 'Это не приложение контроля.',
    text: `«Папа & Я» помогает быть рядом с ${childName}, даже когда вы не рядом физически. Здесь важнее внимание, чем показатели.`,
    points: [
      { icon: '👂', title: 'Слушать', text: 'Сигналы, настроение и разговоры — без допроса.' },
      { icon: '✦', title: 'Замечать', text: 'Конкретные поступки и рост, а не только результат.' },
      { icon: '🤝', title: 'Быть рядом', text: 'Встречи, ритуалы и маленькие общие вещи.' },
    ],
  },
  {
    eyebrow: 'ТРИ ГЛАВНЫХ МЕСТА',
    icon: '⌁',
    title: 'Не нужно использовать всё сразу.',
    text: 'Начните с трёх вещей. Остальные функции можно открывать тогда, когда они действительно понадобятся.',
    points: [
      { icon: '♥', title: 'Вместе', text: 'Связь, встречи, разговоры и ваши ритуалы.' },
      { icon: '🧭', title: 'Развитие', text: `Путь ${childName} без сравнения с другими.` },
      { icon: '📖', title: 'Книга', text: 'То, что через несколько лет захочется перечитать.' },
    ],
  },
  {
    eyebrow: 'ГЛАВНОЕ ПРАВИЛО',
    icon: '🌱',
    title: 'Отношения не должны превращаться в таблицу.',
    text: 'Здесь можно пропускать дни, менять планы и возвращаться после пауз. Ничего ценного не обнуляется.',
    points: [
      { icon: '○', title: 'Без наказаний за паузы', text: 'Нет серии, которую страшно потерять.' },
      { icon: '◎', title: 'Один фокус за раз', text: 'Меньше задач, больше смысла.' },
      { icon: '♥', title: 'Главное — связь', text: `Если ${childName} знает, что папа рядом — приложение работает.` },
    ],
  },
];

const childSlides = (parentName: string): Slide[] => [
  {
    eyebrow: 'ЭТО ТВОЁ МЕСТО',
    icon: '🚀',
    title: 'Здесь тебя не оценивают.',
    text: `«Папа & Я» — место для тебя и ${parentName}. Тут можно рассказывать о хорошем, сложном, смешном и вообще ничего не объяснять, если не хочется.`,
    points: [
      { icon: '🙂', title: 'Как ты?', text: 'Можно просто выбрать настроение.' },
      { icon: '💬', title: 'Поговорить', text: 'Позвать папу или вытянуть карточку разговора.' },
      { icon: '🎙', title: 'Сохранить', text: 'Оставить текст или голос для будущего себя.' },
    ],
  },
  {
    eyebrow: 'ТВОЙ ПУТЬ',
    icon: '🧭',
    title: 'Школа — только одна часть жизни.',
    text: 'Здесь есть несколько направлений. Не нужно быть лучшим во всех — можно выбирать то, что сейчас тебе интересно.',
    points: [
      { icon: '⚽', title: 'Футбол', text: 'Команда, движение и характер.' },
      { icon: '♟', title: 'Шахматы', text: 'Спокойствие и стратегия.' },
      { icon: 'EN', title: 'English и другое', text: 'Навыки, которые открывают новые возможности.' },
    ],
  },
  {
    eyebrow: 'ВАЖНО ПОМНИТЬ',
    icon: '✦',
    title: 'Ты не обязан делать всё каждый день.',
    text: 'Можно забыть про приложение на неделю, а потом вернуться. Твой путь останется на месте и продолжится дальше.',
    points: [
      { icon: '○', title: 'Пауза — нормально', text: 'Ничего не сгорит и не станет хуже.' },
      { icon: '◎', title: 'Фокус выбираешь ты', text: 'Можно менять то, на чём хочется сосредоточиться.' },
      { icon: '♥', title: 'Вы одна команда', text: `${parentName} здесь не судья. Он твой напарник.` },
    ],
  },
];

export default function OnboardingScreen() {
  const { family, me, members, refresh } = useFamily();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const parentName = parent?.display_name ?? 'Папа';
  const childName = child?.display_name ?? 'Артур';
  const isChild = me?.role === 'child';
  const slides = useMemo(() => isChild ? childSlides(parentName) : parentSlides(childName), [childName, isChild, parentName]);
  const slide = slides[step];
  const last = step === slides.length - 1;

  const complete = async () => {
    const client = supabase;
    if (!client || !family || !me || busy) return;
    setBusy(true);
    try {
      const { error } = await client
        .from('family_members')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('family_id', family.id)
        .eq('user_id', me.user_id);
      if (error) throw error;
      await refresh();
      router.replace('/(tabs)');
    } catch (caught) {
      Alert.alert('Не удалось завершить знакомство', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  if (!me || !slide) {
    return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>Папа <Text style={styles.amp}>&</Text> Я</Text>
            <Text style={styles.caption}>{isChild ? 'Твой путь. Ваша история.' : 'Быть рядом по-настоящему.'}</Text>
          </View>
          <Pressable disabled={busy} onPress={() => void complete()} style={styles.skip}><Text style={styles.skipText}>Пропустить</Text></Pressable>
        </View>

        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
          <View style={styles.icon}><Text style={styles.iconText}>{slide.icon}</Text></View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.text}>{slide.text}</Text>
        </LinearGradient>

        <View style={[styles.pointsCard, shadows.soft]}>
          {slide.points.map((point, index) => (
            <View key={point.title} style={[styles.pointRow, index > 0 && styles.pointBorder]}>
              <View style={styles.pointIcon}><Text style={styles.pointIconText}>{point.icon}</Text></View>
              <View style={styles.pointCopy}>
                <Text style={styles.pointTitle}>{point.title}</Text>
                <Text style={styles.pointText}>{point.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.bottom}>
          <View style={styles.dots}>
            {slides.map((_, index) => <View key={index} style={[styles.dot, index === step && styles.dotActive]} />)}
          </View>
          <Pressable
            disabled={busy}
            style={[styles.next, busy && styles.disabled]}
            onPress={() => last ? void complete() : setStep((value) => Math.min(value + 1, slides.length - 1))}
          >
            {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.nextText}>{last ? (isChild ? 'Погнали 🚀' : 'Начать вместе ♥') : 'Дальше →'}</Text>}
          </Pressable>
          {step > 0 ? <Pressable onPress={() => setStep((value) => Math.max(0, value - 1))}><Text style={styles.backText}>← Назад</Text></Pressable> : <View style={styles.backPlaceholder} />}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { flex: 1, padding: 16, gap: 15 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.navyDeep, fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  amp: { color: colors.amber },
  caption: { color: colors.muted, fontSize: 8, fontWeight: '800', marginTop: 1 },
  skip: { paddingHorizontal: 11, paddingVertical: 8 },
  skipText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  hero: { flex: 1.05, minHeight: 265, borderRadius: radius.xl, padding: 21, overflow: 'hidden', justifyContent: 'flex-end' },
  heroGlow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(255,215,106,0.10)', right: -70, top: -80 },
  eyebrow: { position: 'absolute', left: 21, top: 20, color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.25 },
  icon: { width: 62, height: 62, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconText: { color: colors.sun, fontSize: 28, fontWeight: '900' },
  title: { color: colors.white, fontSize: 27, lineHeight: 32, fontWeight: '900', maxWidth: '95%' },
  text: { color: '#D7E5E7', fontSize: 11, lineHeight: 17, marginTop: 9, maxWidth: '94%' },
  pointsCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, paddingHorizontal: 15 },
  pointRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11 },
  pointBorder: { borderTopWidth: 1, borderTopColor: colors.lineWarm },
  pointIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' },
  pointIconText: { color: colors.navyDeep, fontSize: 16, fontWeight: '900' },
  pointCopy: { flex: 1 },
  pointTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' },
  pointText: { color: colors.muted, fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  bottom: { alignItems: 'center', gap: 9 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D6D0C5' },
  dotActive: { width: 23, backgroundColor: colors.amber },
  next: { width: '100%', minHeight: 52, borderRadius: 17, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  backText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  backPlaceholder: { height: 11 },
  disabled: { opacity: 0.55 },
});
