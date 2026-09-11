import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import DevelopmentV2 from '../../screens/DevelopmentV2';
import { colors, shadows } from '../../theme';

export default function DevelopmentTab() {
  return (
    <View style={styles.root}>
      <DevelopmentV2 />
      <Pressable style={[styles.launcher, shadows.lift]} onPress={() => router.push('/week-tools')}>
        <View style={styles.icon}><Text style={styles.iconText}>◎</Text></View>
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
    minHeight: 50,
    borderRadius: 19,
    backgroundColor: '#E5F0F2',
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#C7DEE2',
  },
  icon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.sun, fontSize: 14, fontWeight: '900' },
  copy: { minWidth: 95 },
  kicker: { color: colors.teal, fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  text: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
  arrow: { color: colors.teal, fontSize: 20, fontWeight: '900' },
});
