import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import UsV2 from '../../screens/UsV2';
import { colors, shadows } from '../../theme';

export default function UsTab() {
  return (
    <View style={styles.root}>
      <UsV2 />
      <View style={styles.quickBar}>
        <Pressable style={[styles.launcher, styles.monthLauncher, shadows.lift]} onPress={() => router.push('/month-together')}>
          <View style={[styles.icon, styles.monthIcon]}>
            <Image source={require('../../../assets/generated/feature-path.png')} style={styles.iconImage} resizeMode="contain" />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.kicker, styles.monthKicker]}>ЭТОТ МЕСЯЦ</Text>
            <Text style={styles.text}>Что было вместе</Text>
          </View>
          <Text style={[styles.arrow, styles.monthArrow]}>›</Text>
        </Pressable>

        <Pressable style={[styles.launcher, styles.teamLauncher, shadows.lift]} onPress={() => router.push('/team-tools')}>
          <View style={styles.icon}>
            <Image source={require('../../../assets/generated/feature-family.png')} style={styles.iconImage} resizeMode="contain" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.kicker}>КОМАНДА</Text>
            <Text style={styles.text}>Ещё инструменты</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  quickBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    gap: 8,
  },
  launcher: {
    flex: 1,
    minHeight: 56,
    borderRadius: 19,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  monthLauncher: { backgroundColor: '#E6F0F2', borderColor: '#C9DEE2' },
  teamLauncher: { backgroundColor: '#FFF0CF', borderColor: '#E9D7AC' },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  monthIcon: { backgroundColor: '#1E6170' },
  iconImage: { width: 35, height: 35 },
  copy: { flex: 1, minWidth: 0 },
  kicker: { color: '#9B7027', fontSize: 6, fontWeight: '900', letterSpacing: 0.7 },
  monthKicker: { color: '#2D6D73' },
  text: { color: colors.navyDeep, fontSize: 9, fontWeight: '900', marginTop: 1 },
  arrow: { color: '#9B7027', fontSize: 19, fontWeight: '900' },
  monthArrow: { color: '#2D6D73' },
});
