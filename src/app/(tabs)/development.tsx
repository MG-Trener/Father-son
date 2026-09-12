import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import DevelopmentV2 from '../../screens/DevelopmentV2';
import { colors, shadows } from '../../theme';

export default function DevelopmentTab() {
  return (
    <View style={styles.root}>
      <DevelopmentV2 />
      <View style={styles.quickActions}>
        <Pressable style={[styles.compactAction, styles.pathAction, shadows.lift]} onPress={() => router.push('/path-map')}>
          <Image source={require('../../../assets/generated/badge-adventure.png')} style={styles.compactImage} resizeMode="contain" />
          <View style={styles.compactCopy}>
            <Text style={styles.pathKicker}>11 → 18</Text>
            <Text style={styles.actionText}>Путь</Text>
          </View>
        </Pressable>

        <Pressable style={[styles.compactAction, styles.badgesAction, shadows.lift]} onPress={() => router.push('/achievements')}>
          <Image source={require('../../../assets/generated/badge-courage.png')} style={styles.compactImage} resizeMode="contain" />
          <View style={styles.compactCopy}>
            <Text style={styles.badgesKicker}>ВЕХИ</Text>
            <Text style={styles.actionText}>Гербы</Text>
          </View>
        </Pressable>

        <Pressable style={[styles.compactAction, styles.weekAction, shadows.lift]} onPress={() => router.push('/week-tools')}>
          <Image source={require('../../../assets/generated/badge-planner.png')} style={styles.compactImage} resizeMode="contain" />
          <View style={styles.compactCopy}>
            <Text style={styles.weekKicker}>НЕДЕЛЯ</Text>
            <Text style={styles.actionText}>Фокус</Text>
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
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    gap: 7,
  },
  compactAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    borderRadius: 19,
    paddingHorizontal: 7,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
  },
  pathAction: { backgroundColor: '#E8F1F2', borderColor: '#C9DEE2' },
  badgesAction: { backgroundColor: '#FFF0E7', borderColor: '#E8C3B2' },
  weekAction: { backgroundColor: '#FFF8E9', borderColor: '#EBCB86' },
  compactImage: { width: 34, height: 34 },
  compactCopy: { flex: 1, minWidth: 0 },
  pathKicker: { color: '#2D6D73', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.5 },
  badgesKicker: { color: '#8D5246', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.5 },
  weekKicker: { color: '#A56E16', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.5 },
  actionText: { color: colors.navyDeep, fontSize: 9, fontWeight: '900', marginTop: 1 },
});
