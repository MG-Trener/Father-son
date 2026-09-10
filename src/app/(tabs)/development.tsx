import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../components/AppCard';
import { colors, radius } from '../../theme';

const paths = [
  { icon: '📚', title: 'Школа', stage: 'Самостоятельность', next: 'Самому выбрать цель недели' },
  { icon: '⚽', title: 'Футбол', stage: 'Игрок команды', next: 'Отметить сильную сторону тренировки' },
  { icon: '♟', title: 'Шахматы', stage: 'Ученик → Тактик', next: 'Завершить первую партию' },
  { icon: '🇬🇧', title: 'English', stage: 'Первые фразы', next: 'Голосовое 60 секунд' },
  { icon: '🧭', title: 'Лидерство', stage: 'Ответственность', next: 'Проявить инициативу' },
];

export default function DevelopmentScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Развитие</Text>
        <Text style={styles.subtitle}>Не оценки, а путь. Прогресс не уменьшается из-за пауз.</Text>

        <AppCard title="Артур · 11 лет" subtitle="Глава: Исследователь">
          <Text style={styles.body}>Главный фокус сейчас: любопытство, небольшая самостоятельность, командность и удовольствие от прогресса.</Text>
        </AppCard>

        {paths.map((path) => (
          <View key={path.title} style={styles.pathCard}>
            <Text style={styles.icon}>{path.icon}</Text>
            <View style={styles.pathText}>
              <Text style={styles.pathTitle}>{path.title}</Text>
              <Text style={styles.stage}>{path.stage}</Text>
              <Text style={styles.next}>Следующий шаг: {path.next}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
        ))}

        <AppCard title="Дерево лидерства" subtitle="Растёт несколько лет">
          <View style={styles.treeRow}><Text style={styles.nodeDone}>Ответственность</Text><Text style={styles.line}>→</Text><Text style={styles.nodeNext}>Самостоятельность</Text></View>
          <View style={styles.treeRow}><Text style={styles.nodeNext}>Инициатива</Text><Text style={styles.line}>→</Text><Text style={styles.nodeFuture}>Командная работа</Text></View>
          <View style={styles.treeRow}><Text style={styles.nodeFuture}>Решения</Text><Text style={styles.line}>→</Text><Text style={styles.nodeFuture}>Наставничество</Text></View>
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 32, gap: 14 },
  title: { color: colors.navyDeep, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -7, marginBottom: 4 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  pathCard: { backgroundColor: colors.paper, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 27, width: 42 },
  pathText: { flex: 1 },
  pathTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  stage: { color: colors.green, marginTop: 2, fontSize: 13, fontWeight: '800' },
  next: { color: colors.muted, marginTop: 5, fontSize: 12, lineHeight: 17 },
  arrow: { color: colors.muted, fontSize: 28 },
  treeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  nodeDone: { backgroundColor: '#DCECE3', color: colors.green, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, fontWeight: '800', fontSize: 12 },
  nodeNext: { backgroundColor: '#FFF0CF', color: '#8A5D12', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, fontWeight: '800', fontSize: 12 },
  nodeFuture: { backgroundColor: '#EEF1F1', color: colors.muted, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, fontWeight: '800', fontSize: 12 },
  line: { color: colors.muted },
});
