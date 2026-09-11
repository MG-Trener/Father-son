import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import UsV2 from '../../screens/UsV2';
import { colors, shadows } from '../../theme';

export default function UsTab() {
  return (
    <View style={styles.root}>
      <UsV2 />
      <View style={styles.dock}>
        <Pressable style={[styles.tool, styles.guideButton, shadows.lift]} onPress={() => router.push('/onboarding')}>
          <View style={[styles.icon, styles.guideIcon]}><Text style={styles.guideIconText}>?</Text></View>
          <View><Text style={styles.guideKicker}>КАК УСТРОЕНО</Text><Text style={styles.guideText}>Короткое знакомство</Text></View>
        </Pressable>
        <Pressable style={[styles.tool, styles.agreementButton, shadows.lift]} onPress={() => router.push('/agreements')}>
          <View style={styles.icon}><Text style={styles.iconText}>🤝</Text></View>
          <View><Text style={styles.kicker}>МЕЖДУ НАМИ</Text><Text style={styles.text}>Договорённости</Text></View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dock: { position: 'absolute', right: 16, bottom: 14, alignItems: 'flex-end', gap: 7 },
  tool: { minHeight: 47, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1 },
  guideButton: { backgroundColor: '#E6F0F2', borderColor: '#CADFE3' },
  agreementButton: { backgroundColor: '#FFF0CF', borderColor: '#E9D7AC' },
  icon: { width: 31, height: 31, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 15 },
  guideIcon: { backgroundColor: colors.navyDeep },
  guideIconText: { color: colors.sun, fontSize: 14, fontWeight: '900' },
  guideKicker: { color: colors.teal, fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  guideText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
  kicker: { color: '#9B7027', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  text: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
});
