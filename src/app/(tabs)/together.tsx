import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../components/AppCard';
import { colors, radius } from '../../theme';

const actions = [
  ['⏱', 'Есть 5 минут?', 'Позвать друг друга без обязательства'],
  ['🧭', 'Мне нужен совет', 'Школа, футбол, друзья или просто поговорить'],
  ['🎙', 'Голосовая история', 'Оставить кусочек сегодняшнего дня'],
  ['🎲', 'Не знаем, о чём говорить', 'Получить случайную тему'],
];

export default function TogetherScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Вместе</Text>
        <Text style={styles.subtitle}>Поводы быть ближе, даже когда вы в разных местах.</Text>

        {actions.map(([icon, title, detail]) => (
          <Pressable key={title} style={styles.action}>
            <Text style={styles.actionIcon}>{icon}</Text>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>{title}</Text>
              <Text style={styles.actionDetail}>{detail}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}

        <AppCard title="Совместная миссия недели" subtitle="Михаил + Артур">
          <Text style={styles.mission}>♟ Сыграть одну шахматную партию и после неё каждый выбирает лучший ход соперника.</Text>
          <View style={styles.reward}><Text style={styles.rewardText}>+15 XP команде</Text></View>
        </AppCard>

        <AppCard title="Вопрос, который я никогда не задавал">
          <Text style={styles.question}>Михаил: чего ты больше всего боялся, когда тебе было 11?</Text>
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
  action: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, flexDirection: 'row', alignItems: 'center' },
  actionIcon: { fontSize: 25, width: 43 },
  actionText: { flex: 1 },
  actionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  actionDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  arrow: { color: colors.muted, fontSize: 28 },
  mission: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  reward: { alignSelf: 'flex-start', backgroundColor: '#FFF0CF', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  rewardText: { color: '#8A5D12', fontSize: 12, fontWeight: '900' },
  question: { color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: '700' },
});
