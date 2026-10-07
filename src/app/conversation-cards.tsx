import { useMemo, useState } from 'react';
import { Image, type ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StoryHero } from '../components/StoryHero';
import { useFamily } from '../context/FamilyContext';
import { colors, radius, shadows } from '../theme';

type DeckKey = 'school' | 'football' | 'future' | 'character' | 'fun' | 'us';

type Deck = {
  key: DeckKey;
  image: ImageSourcePropType;
  title: string;
  subtitle: string;
  colors: readonly [string, string];
  questions: readonly string[];
};

const decks: readonly Deck[] = [
  {
    key: 'school', image: require('../../assets/generated/direction-school.png'), title: 'Школа', subtitle: 'Не только про оценки', colors: ['#4F78A5', '#78A3C3'],
    questions: [
      'Что в школе сейчас даётся легче, чем год назад?',
      'Какой урок ты бы полностью переделал, если бы мог?',
      'Кто из учителей умеет объяснять так, что реально хочется слушать?',
      'Какую школьную ошибку ты теперь считаешь полезной?',
      'Что родители обычно не замечают в школьной жизни?',
      'Какой навык из школы точно пригодится тебе взрослому?',
      'Если бы можно было добавить один предмет — что бы это было?',
      'В какой ситуации в школе ты недавно поступил по-своему и доволен этим?',
    ],
  },
  {
    key: 'football', image: require('../../assets/generated/direction-football.png'), title: 'Футбол', subtitle: 'Игра, характер, команда', colors: ['#347B60', '#65A77F'],
    questions: [
      'Какой момент на поле заставляет тебя чувствовать: «вот ради этого я играю»?',
      'Что труднее: проиграть самому или подвести команду?',
      'Какой футболист тебе нравится не только игрой, но и характером?',
      'Что ты делаешь после ошибки во время матча?',
      'Какая позиция на поле лучше всего подходит твоему характеру?',
      'Чему футбол учит тебя вне футбола?',
      'Как выглядит твоя идеальная тренировка?',
      'Какую футбольную цель ты хочешь однажды вспомнить и сказать: «я сделал это»?',
    ],
  },
  {
    key: 'future', image: require('../../assets/generated/badge-adventure.png'), title: 'Мечты', subtitle: 'Без требования всё решить', colors: ['#7B65AC', '#A893CE'],
    questions: [
      'Что ты хотел бы обязательно попробовать до 15 лет?',
      'Если бы на год можно было переехать в любую страну — куда и зачем?',
      'Какой взрослый навык тебе уже сейчас кажется интересным?',
      'Как бы выглядел твой идеальный обычный день через пять лет?',
      'Что ты хочешь уметь делать лучше папы?',
      'Какая мечта кажется немного безумной, но всё равно нравится?',
      'Если бы деньги вообще не имели значения, чему бы ты учился?',
      'Какую вещь о себе будущем ты хотел бы узнать прямо сейчас?',
    ],
  },
  {
    key: 'character', image: require('../../assets/generated/badge-courage.png'), title: 'Характер', subtitle: 'Решения и внутренний стержень', colors: ['#C37A3F', '#E2A361'],
    questions: [
      'Когда ты в последний раз сделал что-то правильно, хотя никто бы не узнал?',
      'Что для тебя сложнее: попросить помощи или признать ошибку?',
      'Каким человеком ты точно не хочешь становиться?',
      'Что значит быть сильным, кроме физической силы?',
      'Когда стоит стоять на своём, а когда лучше изменить мнение?',
      'За какое своё решение последнего месяца ты себя уважаешь?',
      'Как ты понимаешь, что человеку можно доверять?',
      'Какое качество ты больше всего ценишь в друзьях?',
    ],
  },
  {
    key: 'fun', image: require('../../assets/generated/utility-recognition.png'), title: 'Смешное', subtitle: 'Можно просто посмеяться', colors: ['#D08B45', '#E9B86A'],
    questions: [
      'Если бы наша семья была футбольной командой, кто бы на какой позиции играл?',
      'Какое самое бесполезное суперумение ты хотел бы иметь?',
      'Если бы папа на день стал одиннадцатилетним — что ему пришлось бы объяснять?',
      'Какой закон ты бы ввёл дома, если бы стал главным на сутки?',
      'Если бы можно было завести любое фантастическое животное — кого?',
      'Какой наш семейный мем должен пережить следующие десять лет?',
      'Что из взрослой жизни выглядит максимально странно?',
      'Если бы мы открыли кафе вдвоём, как бы оно называлось и что там подавали?',
    ],
  },
  {
    key: 'us', image: require('../../assets/generated/nav-together.png'), title: 'Папа & сын', subtitle: 'То, что обычно не спрашивают', colors: ['#A95A61', '#CF7E79'],
    questions: [
      'Какой наш общий момент ты хотел бы прожить ещё раз?',
      'Что я делаю как папа хорошо, а что можно делать по-другому?',
      'Чему ты хотел бы однажды научить меня?',
      'Когда тебе легче всего со мной говорить?',
      'Какую традицию нам стоит сохранить даже когда ты станешь взрослым?',
      'Какой мой совет действительно пригодился, а какой можно было не давать?',
      'Что нам обязательно нужно сделать вместе хотя бы один раз?',
      'Как ты думаешь, над чем мы будем смеяться, когда тебе будет 25?',
    ],
  },
] as const;

const voiceImage = require('../../assets/generated/utility-voice.png');
const recognitionImage = require('../../assets/generated/utility-recognition.png');

export default function ConversationCardsScreen() {
  const { members, me } = useFamily();
  const other = useMemo(() => members.find((member) => member.user_id !== me?.user_id) ?? null, [members, me]);
  const [deckKey, setDeckKey] = useState<DeckKey>('us');
  const [questionIndex, setQuestionIndex] = useState(0);

  const deck = decks.find((item) => item.key === deckKey) ?? decks[0]!;
  const question = deck.questions[questionIndex % deck.questions.length] ?? 'О чём хочется поговорить?';

  const selectDeck = (key: DeckKey) => {
    const nextDeck = decks.find((item) => item.key === key);
    setDeckKey(key);
    setQuestionIndex(Math.floor(Math.random() * Math.max(1, nextDeck?.questions.length ?? 1)));
  };

  const draw = () => {
    if (deck.questions.length < 2) return;
    let next = questionIndex;
    while (next === questionIndex) next = Math.floor(Math.random() * deck.questions.length);
    setQuestionIndex(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topCopy}><Text style={styles.topKicker}>БЕЗ ПРАВИЛЬНЫХ ОТВЕТОВ</Text><Text style={styles.topTitle}>Колода разговоров</Text></View>
        </View>

        <StoryHero
          kicker="РАЗГОВОР · ПАПА & Я"
          title="Иногда хороший вопрос делает для близости больше, чем длинный совет."
          subtitle="Можно ответить вслух и забыть. А если ответ хочется сохранить — он попадёт в вашу общую историю."
          variant="team"
          emblemImage={require('../../assets/generated/nav-together.png')}
        />

        <Text style={styles.sectionKicker}>ВЫБЕРИ ТЕМУ</Text>
        <View style={styles.deckGrid}>
          {decks.map((item) => {
            const active = item.key === deckKey;
            return (
              <Pressable key={item.key} onPress={() => selectDeck(item.key)} style={[styles.deckChip, active && styles.deckChipActive]}>
                <View style={[styles.deckIcon, active && styles.deckIconActive]}><Image source={item.image} style={styles.deckImage} resizeMode="contain" /></View>
                <View style={styles.deckCopy}><Text style={[styles.deckTitle, active && styles.deckTitleActive]}>{item.title}</Text><Text style={[styles.deckSubtitle, active && styles.deckSubtitleActive]}>{item.subtitle}</Text></View>
              </Pressable>
            );
          })}
        </View>

        <LinearGradient colors={deck.colors} style={[styles.questionCard, shadows.lift]}>
          <View style={styles.questionArt}><Image source={deck.image} style={styles.questionArtImage} resizeMode="contain" /></View>
          <View style={styles.questionTop}><View style={styles.questionDeckWrap}><Image source={deck.image} style={styles.questionDeckImage} resizeMode="contain" /><Text style={styles.questionDeck}>{deck.title.toUpperCase()}</Text></View><Text style={styles.questionCount}>{questionIndex + 1}/{deck.questions.length}</Text></View>
          <Text style={styles.quote}>“</Text>
          <Text style={styles.question}>{question}</Text>
          <Text style={styles.forTwo}>для {me?.display_name ?? 'тебя'} и {other?.display_name ?? 'второго участника'}</Text>
          <Pressable style={styles.drawButton} onPress={draw}><Text style={styles.drawButtonText}>Другая карточка ↻</Text></Pressable>
        </LinearGradient>

        <View style={[styles.answerCard, shadows.soft]}>
          <View style={styles.answerHead}><View style={styles.answerIcon}><Image source={recognitionImage} style={styles.answerIconImage} resizeMode="contain" /></View><View style={styles.answerCopy}><Text style={styles.answerTitle}>Хочется сохранить ответ?</Text><Text style={styles.answerText}>Он станет обычным семейным моментом, а не оценкой или заданием.</Text></View></View>
          <View style={styles.answerActions}>
            <Pressable style={styles.textButton} onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: question } })}><Image source={recognitionImage} style={styles.buttonImage} resizeMode="contain" /><Text style={styles.textButtonText}>Текстом</Text></Pressable>
            <Pressable style={styles.voiceButton} onPress={() => router.push({ pathname: '/voice-story-new', params: { prompt: question } })}><Image source={voiceImage} style={styles.buttonImage} resizeMode="contain" /><Text style={styles.voiceButtonText}>Голосом</Text></Pressable>
          </View>
        </View>

        <Text style={styles.footer}>Не обязательно отвечать на всё. Хорошая карточка — та, после которой разговор продолжается сам.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 32, lineHeight: 34, marginTop: -3 },
  topCopy: { flex: 1 },
  topKicker: { color: colors.purple, fontSize: 14, fontWeight: '900', letterSpacing: 1.25 },
  topTitle: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 2 },
  sectionKicker: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1.3 },
  deckGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deckChip: { width: '48.5%', minHeight: 78, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  deckChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  deckIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  deckIconActive: { backgroundColor: '#FFF3D9' },
  deckImage: { width: 43, height: 43 },
  deckCopy: { flex: 1 },
  deckTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  deckTitleActive: { color: colors.white },
  deckSubtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
  deckSubtitleActive: { color: '#C9DADD' },
  questionCard: { minHeight: 330, borderRadius: radius.xl, padding: 22, overflow: 'hidden' },
  questionArt: { position: 'absolute', right: -16, bottom: -8, width: 155, height: 155, opacity: 0.28 },
  questionArtImage: { width: 150, height: 150 },
  questionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionDeckWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  questionDeckImage: { width: 34, height: 34 },
  questionDeck: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '900', letterSpacing: 1.1 },
  questionCount: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '900' },
  quote: { color: 'rgba(255,255,255,0.20)', fontSize: 82, lineHeight: 82, fontWeight: '900', marginTop: 12 },
  question: { color: colors.white, fontSize: 25, lineHeight: 32, fontWeight: '900', marginTop: -18, maxWidth: '94%' },
  forTwo: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '700', marginTop: 14 },
  drawButton: { alignSelf: 'flex-start', minHeight: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  drawButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  answerCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 17 },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  answerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFF0D2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  answerIconImage: { width: 48, height: 48 },
  answerCopy: { flex: 1 },
  answerTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  answerText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  answerActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  textButton: { flex: 1, minHeight: 50, borderRadius: radius.md, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  textButtonText: { color: colors.navy, fontSize: 14, fontWeight: '900' },
  voiceButton: { flex: 1, minHeight: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  voiceButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  buttonImage: { width: 34, height: 34 },
  footer: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 26 },
});
