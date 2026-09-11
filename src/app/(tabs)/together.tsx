import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import TogetherV2 from '../../screens/TogetherV2';
import { colors, shadows } from '../../theme';

export default function TogetherTab() {
  return (
    <View style={styles.root}>
      <TogetherV2 />
      <Pressable style={[styles.launcher, shadows.lift]} onPress={() => router.push('/together-tools')}>
        <View style={styles.icon}><Text style={styles.iconText}>♥</Text></View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>ВМЕСТЕ</Text>
          <Text style={styles.text}>Что можно сделать сейчас</Text>
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
    backgroundColor: colors.navyDeep,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  icon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  copy: { minWidth: 128 },
  kicker: { color: '#9FC3CA', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  text: { color: colors.white, fontSize: 10, fontWeight: '900', marginTop: 1 },
  arrow: { color: colors.sun, fontSize: 20, fontWeight: '900' },
});
