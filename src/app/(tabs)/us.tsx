import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../components/AppCard';
import { colors, radius } from '../../theme';

const years = ['11', '12', '13', '14', '15', '16', '17', '18'];

export default function UsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Мы</Text>
        <Text style={styles.subtitle}>Михаил + Артур</Text>

        <View style={styles.hero}>
          <Text style={styles.heroKicker}>КОМАНДА</Text>
          <Text style={styles.heroTitle}>Напарники</Text>
          <Text style={styles.heroText}>Уровень 1 · начало большой истории</Text>
        </View>

        <AppCard title="Путь Артура" subtitle="Это не шкала выполнения. Это годы, которые будут наполняться воспоминаниями.">
          <View style={styles.years}>
            {years.map((year, index) => (
              <View key={year} style={[styles.year, index === 0 && styles.yearActive]}>
                <Text style={[styles.yearText, index === 0 && styles.yearTextActive]}>{year}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        <AppCard title="Будущие артефакты пути">
          <Text style={styles.artifact}>♟ Шахматный конь · первая большая шахматная веха</Text>
          <Text style={styles.artifact}>⚽ Капитанская повязка · лидерство на поле</Text>
          <Text style={styles.artifact}>🧭 Компас · серьёзное самостоятельное решение</Text>
          <Text style={styles.artifact}>❤️ Фото · важный день Михаила и Артура</Text>
        </AppCard>

        <AppCard title="Главное правило">
          <Text style={styles.rule}>XP — для атмосферы. Настоящие достижения сохраняют реальные события, выборы, усилия, мысли и голос.</Text>
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 32, gap: 15 },
  title: { color: colors.navyDeep, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: -9 },
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 22 },
  heroKicker: { color: '#C9D7D7', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle: { color: colors.white, fontSize: 31, fontWeight: '900', marginTop: 3 },
  heroText: { color: '#E7EEEE', marginTop: 5, fontSize: 13 },
  years: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  year: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  yearActive: { backgroundColor: colors.amber },
  yearText: { color: colors.muted, fontWeight: '900' },
  yearTextActive: { color: colors.navyDeep },
  artifact: { color: colors.text, fontSize: 13, lineHeight: 20 },
  rule: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '700' },
});
