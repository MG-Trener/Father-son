import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import UsV2 from '../../screens/UsV2';
import { colors, shadows } from '../../theme';

export default function UsTab() {
  return (
    <View style={styles.root}>
      <UsV2 />
      <Pressable style={[styles.launcher, shadows.lift]} onPress={() => router.push('/team-tools')}>
        <View style={styles.icon}>
          <Image source={require('../../../assets/generated/nav-us.png')} style={styles.iconImage} resizeMode="contain" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>НАША КОМАНДА</Text>
          <Text style={styles.text}>События и настройки</Text>
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
    backgroundColor: '#FFF0CF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E9D7AC',
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
  iconImage: { width: 35, height: 35 },
  copy: { minWidth: 124 },
  kicker: { color: '#9B7027', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  text: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
  arrow: { color: '#9B7027', fontSize: 20, fontWeight: '900' },
});
