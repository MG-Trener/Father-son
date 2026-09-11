import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import DevelopmentV2 from '../../screens/DevelopmentV2';
import { colors, shadows } from '../../theme';

export default function DevelopmentTab() {
  return (
    <View style={styles.root}>
      <DevelopmentV2 />
      <View style={styles.dock}>
        <Pressable style={[styles.tool, styles.review, shadows.lift]} onPress={() => router.push('/week-review')}>
          <Text style={styles.reviewIcon}>▤</Text>
          <View><Text style={styles.reviewKicker}>ЭТА НЕДЕЛЯ</Text><Text style={styles.reviewText}>Итог недели</Text></View>
        </Pressable>
        <Pressable style={[styles.tool, styles.focus, shadows.lift]} onPress={() => router.push('/weekly-focus')}>
          <Text style={styles.focusIcon}>◎</Text>
          <View><Text style={styles.focusKicker}>ОРИЕНТИР</Text><Text style={styles.focusText}>Фокус недели</Text></View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dock: { position: 'absolute', right: 16, bottom: 14, alignItems: 'flex-end', gap: 7 },
  tool: { minHeight: 43, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1 },
  review: { backgroundColor: '#E5F0F2', borderColor: '#C7DEE2' },
  focus: { backgroundColor: colors.navyDeep, borderColor: 'rgba(255,255,255,0.12)' },
  reviewIcon: { width: 24, color: colors.teal, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  focusIcon: { width: 24, color: colors.sun, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  reviewKicker: { color: colors.teal, fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  reviewText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
  focusKicker: { color: '#AFC7CA', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  focusText: { color: colors.white, fontSize: 10, fontWeight: '900', marginTop: 1 },
});
