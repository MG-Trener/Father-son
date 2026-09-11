import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import DevelopmentV2 from '../../screens/DevelopmentV2';
import { colors, shadows } from '../../theme';

export default function DevelopmentTab() {
  return (
    <View style={styles.root}>
      <DevelopmentV2 />
      <Pressable style={[styles.launcher, shadows.lift]} onPress={() => router.push('/week-tools')}>
        <View style={styles.icon}>
          <Image source={require('../../../assets/generated/badge-planner.png')} style={styles.iconImage} resizeMode="contain" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>ЭТА НЕДЕЛЯ</Text>
          <Text style={styles.text}>Фокус и итог</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  launcher: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: '#FFF8E9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EBCB86',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: 36, height: 36 },
  copy: { minWidth: 95 },
  kicker: { color: '#A56E16', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  text: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
  arrow: { color: '#A56E16', fontSize: 20, fontWeight: '900' },
});
