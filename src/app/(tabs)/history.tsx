import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../components/AppCard';
import { colors } from '../../theme';

const timeline = [
  ['Сегодня', '🧭', 'Начало пути', 'Создан будущий цифровой штаб Михаила и Артура.'],
  ['Следующая веха', '♟', 'Первая партия', 'Сохранится дата, результат и лучший момент партии.'],
  ['Следующая веха', '🇬🇧', 'Первая минута', 'Голосовое Артура на английском длиной 60 секунд.'],
];

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Наша история</Text>
        <Text style={styles.subtitle}>Не лента активности, а летопись важных моментов.</Text>

        <AppCard title="Артур · 11 лет" subtitle="Сезон 2026–2027 · Исследователь">
          <Text style={styles.body}>В конце возрастного года здесь появится книга: главная победа, сложный момент, футбол, шахматы, English, лидерство и то, что вы заметили друг в друге.</Text>
        </AppCard>

        <View style={styles.timeline}>
          {timeline.map(([date, icon, title, text], index) => (
            <View key={`${title}-${index}`} style={styles.event}>
              <View style={styles.rail}><View style={styles.dot} />{index < timeline.length - 1 ? <View style={styles.line} /> : null}</View>
              <View style={styles.eventContent}>
                <Text style={styles.date}>{date}</Text>
                <Text style={styles.eventTitle}>{icon} {title}</Text>
                <Text style={styles.eventText}>{text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 32, gap: 16 },
  title: { color: colors.navyDeep, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -9 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  timeline: { marginTop: 3 },
  event: { flexDirection: 'row', minHeight: 112 },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.amber, marginTop: 6 },
  line: { width: 2, flex: 1, backgroundColor: colors.line, marginVertical: 4 },
  eventContent: { flex: 1, paddingLeft: 8, paddingBottom: 22 },
  date: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  eventTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
  eventText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
});
