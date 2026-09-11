import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import TogetherV2 from '../../screens/TogetherV2';
import { colors, shadows } from '../../theme';

export default function TogetherTab() {
  return (
    <View style={styles.root}>
      <TogetherV2 />
      <Pressable style={[styles.launcher, shadows.lift]} onPress={() => router.push('/together-tools')}>
        <View style={styles.icon}>
          <Image source={require('../../../assets/generated/nav-together.png')} style={styles.iconImage} resizeMode="contain" />
        </View>
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
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: colors.navyDeep,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#FFF0CB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: 35, height: 35 },
  copy: { minWidth: 128 },
  kicker: { color: '#F1CB76', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  text: { color: colors.white, fontSize: 10, fontWeight: '900', marginTop: 1 },
  arrow: { color: colors.sun, fontSize: 20, fontWeight: '900' },
});
