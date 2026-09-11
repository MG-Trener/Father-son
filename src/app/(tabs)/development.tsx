import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import DevelopmentV2 from '../../screens/DevelopmentV2';
import { colors, shadows } from '../../theme';

export default function DevelopmentTab() {
  return (
    <View style={styles.root}>
      <DevelopmentV2 />
      <View style={styles.quickActions}>
        <Pressable style={[styles.compactAction, styles.badgesAction, shadows.lift]} onPress={() => router.push('/achievements')}>
          <Image source={require('../../../assets/generated/badge-courage.png')} style={styles.compactImage} resizeMode="contain" />
          <View>
            <Text style={styles.badgesKicker}>11 → 18</Text>
            <Text style={styles.badgesText}>Гербы</Text>
          </View>
        </Pressable>

        <Pressable style={[styles.compactAction, styles.weekAction, shadows.lift]} onPress={() => router.push('/week-tools')}>
          <Image source={require('../../../assets/generated/badge-planner.png')} style={styles.compactImage} resizeMode="contain" />
          <View>
            <Text style={styles.weekKicker}>ЭТА НЕДЕЛЯ</Text>
            <Text style={styles.weekText}>Фокус и итог</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  quickActions: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    gap: 8,
  },
  compactAction: {
    minHeight: 54,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  badgesAction: { backgroundColor: '#FFF0E7', borderColor: '#E8C3B2' },
  weekAction: { backgroundColor: '#FFF8E9', borderColor: '#EBCB86' },
  compactImage: { width: 38, height: 38 },
  badgesKicker: { color: '#8D5246', fontSize: 6, fontWeight: '900', letterSpacing: 0.7 },
  badgesText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
  weekKicker: { color: '#A56E16', fontSize: 6, fontWeight: '900', letterSpacing: 0.7 },
  weekText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
});
