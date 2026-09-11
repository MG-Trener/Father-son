import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import TogetherV2 from '../../screens/TogetherV2';
import { colors, shadows } from '../../theme';

export default function TogetherTab() {
  return (
    <View style={styles.root}>
      <TogetherV2 />
      <View style={[styles.quickDock, shadows.lift]}>
        <Pressable style={styles.todayButton} onPress={() => router.push('/today')}>
          <View style={styles.todayIcon}><Text style={styles.todayIconText}>☀</Text></View>
          <View style={styles.todayCopy}>
            <Text style={styles.todayKicker}>СЕГОДНЯ</Text>
            <Text style={styles.todayText}>Что важно прямо сейчас</Text>
          </View>
          <Text style={styles.todayArrow}>›</Text>
        </Pressable>
        <View style={styles.toolGrid}>
          <Pressable style={[styles.quickButton, styles.cardsButton]} onPress={() => router.push('/conversation-cards')}>
            <Text style={styles.cardsIcon}>?</Text>
            <Text style={styles.cardsText}>Карточки</Text>
          </Pressable>
          <Pressable style={[styles.quickButton, styles.ritualButton]} onPress={() => router.push('/rituals')}>
            <Text style={styles.ritualIcon}>∞</Text>
            <Text style={styles.ritualText}>Ритуалы</Text>
          </Pressable>
          <Pressable style={[styles.quickButton, styles.recognitionButton]} onPress={() => router.push('/recognitions')}>
            <Text style={styles.recognitionIcon}>✦</Text>
            <Text style={styles.recognitionText}>Я заметил</Text>
          </Pressable>
          <Pressable style={[styles.quickButton, styles.pulseButton]} onPress={() => router.push('/mood-check-in')}>
            <Text style={styles.pulseIcon}>♥</Text>
            <Text style={styles.pulseText}>Как мы?</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  quickDock: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    width: 212,
    padding: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(255,253,249,0.97)',
    borderWidth: 1,
    borderColor: '#E8E0D4',
    gap: 5,
  },
  todayButton: {
    minHeight: 48,
    borderRadius: 17,
    backgroundColor: colors.navyDeep,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  todayIcon: { width: 31, height: 31, borderRadius: 11, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  todayIconText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  todayCopy: { flex: 1 },
  todayKicker: { color: '#9FC3CA', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  todayText: { color: colors.white, fontSize: 9, fontWeight: '900', marginTop: 1 },
  todayArrow: { color: colors.sun, fontSize: 19, fontWeight: '900' },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  quickButton: {
    width: 97,
    minHeight: 38,
    paddingHorizontal: 9,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
  },
  cardsButton: { backgroundColor: '#EDE8F7', borderColor: '#D7CDEC' },
  ritualButton: { backgroundColor: '#FFF0D2', borderColor: '#E9D2A5' },
  recognitionButton: { backgroundColor: '#F7E8EE', borderColor: '#E8CAD6' },
  pulseButton: { backgroundColor: colors.navy, borderColor: colors.navy },
  cardsIcon: { color: '#66579C', fontSize: 13, fontWeight: '900' },
  cardsText: { color: '#66579C', fontSize: 9, fontWeight: '900' },
  ritualIcon: { color: '#A7751E', fontSize: 13, fontWeight: '900' },
  ritualText: { color: '#805B1E', fontSize: 9, fontWeight: '900' },
  recognitionIcon: { color: colors.coral, fontSize: 12, fontWeight: '900' },
  recognitionText: { color: '#9B5660', fontSize: 9, fontWeight: '900' },
  pulseIcon: { color: colors.sun, fontSize: 12, fontWeight: '900' },
  pulseText: { color: colors.white, fontSize: 9, fontWeight: '900' },
});