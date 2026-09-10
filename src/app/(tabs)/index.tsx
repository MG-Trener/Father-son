import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../components/AppCard';
import { colors, radius } from '../../theme';

const directions = [
  { icon: '📚', title: 'Школа', detail: 'Цель недели: математика' },
  { icon: '⚽', title: 'Футбол', detail: 'Следующая тренировка завтра' },
  { icon: '♟', title: 'Шахматы', detail: 'Партия: ход Артура' },
  { icon: 'EN', title: 'English', detail: 'Серия: 6 дней' },
  { icon: '🧭', title: 'Лидерство', detail: 'Новая миссия' },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.brand}>Папа & Я</Text>
          <Text style={styles.tagline}>Михаил + Артур · одна команда, где бы мы ни были</Text>
        </View>

        <View style={styles.peopleRow}>
          <View style={styles.personCard}>
            <Text style={styles.personEmoji}>🙂</Text>
            <View>
              <Text style={styles.personName}>Михаил</Text>
              <Text style={styles.personMood}>Отлично</Text>
            </View>
          </View>
          <View style={styles.personCard}>
            <Text style={styles.personEmoji}>😎</Text>
            <View>
              <Text style={styles.personName}>Артур</Text>
              <Text style={styles.personMood}>Супер</Text>
            </View>
          </View>
        </View>

        <View style={styles.meetingCard}>
          <Text style={styles.meetingLabel}>ДО СЛЕДУЮЩЕЙ ВСТРЕЧИ</Text>
          <Text style={styles.meetingValue}>12 дней</Text>
          <Text style={styles.meetingHint}>Что сделаем вместе? Добавим идею →</Text>
        </View>

        <Pressable style={styles.fiveButton}>
          <Text style={styles.fiveTitle}>Есть 5 минут?</Text>
          <Text style={styles.fiveText}>Мягко позвать друг друга поговорить, сыграть или посоветоваться</Text>
        </Pressable>

        <AppCard title="Сегодня вместе" subtitle="Вопрос дня">
          <Text style={styles.question}>Какой момент сегодня ты хотел бы показать папе?</Text>
          <Pressable style={styles.voiceButton}>
            <Text style={styles.voiceButtonText}>🎙 Рассказать голосом</Text>
          </Pressable>
        </AppCard>

        <View>
          <Text style={styles.sectionTitle}>Наши направления</Text>
          <View style={styles.directionList}>
            {directions.map((item) => (
              <View key={item.title} style={styles.directionRow}>
                <View style={styles.directionIcon}><Text style={styles.directionIconText}>{item.icon}</Text></View>
                <View style={styles.directionText}>
                  <Text style={styles.directionTitle}>{item.title}</Text>
                  <Text style={styles.directionDetail}>{item.detail}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            ))}
          </View>
        </View>

        <AppCard title="Команда Михаил & Артур" subtitle="Уровень 1 · Напарники">
          <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
          <View style={styles.statsRow}>
            <Text style={styles.stat}>💬 0 разговоров</Text>
            <Text style={styles.stat}>🎯 0 миссий</Text>
            <Text style={styles.stat}>📖 0 воспоминаний</Text>
          </View>
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 32, gap: 18 },
  brand: { color: colors.navyDeep, fontSize: 31, fontWeight: '900', letterSpacing: -0.8 },
  tagline: { marginTop: 5, color: colors.muted, fontSize: 14, lineHeight: 20 },
  peopleRow: { flexDirection: 'row', gap: 10 },
  personCard: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.md, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line },
  personEmoji: { fontSize: 26 },
  personName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  personMood: { color: colors.green, marginTop: 2, fontSize: 12, fontWeight: '700' },
  meetingCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 22 },
  meetingLabel: { color: '#C9D7D7', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  meetingValue: { color: colors.white, fontSize: 38, fontWeight: '900', marginTop: 5 },
  meetingHint: { color: '#E7EEEE', fontSize: 13, marginTop: 7 },
  fiveButton: { backgroundColor: colors.amber, borderRadius: radius.lg, padding: 20 },
  fiveTitle: { color: colors.navyDeep, fontSize: 22, fontWeight: '900' },
  fiveText: { color: colors.navyDeep, opacity: 0.76, marginTop: 4, lineHeight: 19, fontSize: 13 },
  question: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 24 },
  voiceButton: { alignSelf: 'flex-start', backgroundColor: colors.navy, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  voiceButtonText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 10 },
  directionList: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  directionRow: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  directionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  directionIconText: { fontSize: 17, fontWeight: '900', color: colors.navy },
  directionText: { flex: 1, paddingHorizontal: 12 },
  directionTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  directionDetail: { color: colors.muted, marginTop: 2, fontSize: 12 },
  chevron: { color: colors.muted, fontSize: 25 },
  progressTrack: { height: 9, borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },
  progressFill: { width: '22%', height: '100%', backgroundColor: colors.green, borderRadius: radius.pill },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});
