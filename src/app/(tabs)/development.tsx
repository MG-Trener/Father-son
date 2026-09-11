import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import DevelopmentV2 from '../../screens/DevelopmentV2';
import { colors, shadows } from '../../theme';

export default function DevelopmentTab() {
  return (
    <View style={styles.root}>
      <DevelopmentV2 />
      <Pressable style={[styles.focusButton, shadows.lift]} onPress={() => router.push('/weekly-focus')}>
        <View style={styles.icon}><Text style={styles.iconText}>◎</Text></View>
        <View>
          <Text style={styles.kicker}>ЭТА НЕДЕЛЯ</Text>
          <Text style={styles.text}>Фокус недели</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  focusButton: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: colors.navyDeep,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  icon: { width: 31, height: 31, borderRadius: 11, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.navyDeep, fontSize: 15, fontWeight: '900' },
  kicker: { color: '#AFC7CA', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  text: { color: colors.white, fontSize: 10, fontWeight: '900', marginTop: 1 },
});
