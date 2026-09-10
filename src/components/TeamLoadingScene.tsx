import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius } from '../theme';

type Props = {
  topInset?: number;
  bottomInset?: number;
};

export function TeamLoadingScene({ topInset = 0, bottomInset = 0 }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.16] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.08] });

  return (
    <View style={[styles.safe, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <LinearGradient colors={gradients.team} style={styles.scene}>
        <View style={styles.orbOne} />
        <View style={styles.orbTwo} />

        <View style={styles.brandWrap}>
          <Text style={styles.kicker}>ПАПА & Я</Text>
          <Text style={styles.title}>Одна команда</Text>
          <Text style={styles.subtitle}>Где бы мы ни были.</Text>
        </View>

        <View style={styles.peopleRow}>
          <View style={styles.person}>
            <View style={[styles.avatar, styles.parentAvatar]}><Text style={styles.avatarText}>М</Text></View>
            <Text style={styles.name}>Михаил</Text>
          </View>

          <View style={styles.route}>
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <View style={styles.pulseWrap}>
              <Animated.View style={[styles.pulseHalo, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
              <View style={styles.pulseCore}><Text style={styles.pulseText}>✦</Text></View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeDot} />
          </View>

          <View style={styles.person}>
            <View style={[styles.avatar, styles.childAvatar]}><Text style={styles.avatarText}>А</Text></View>
            <Text style={styles.name}>Артур</Text>
          </View>
        </View>

        <View style={styles.loadingPill}>
          <Text style={styles.loadingText}>Собираем ваше пространство</Text>
          <View style={styles.dots}>
            <Animated.View style={[styles.dot, { opacity: pulse }]} />
            <View style={[styles.dot, styles.dotMid]} />
            <Animated.View style={[styles.dot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }]} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.night },
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, overflow: 'hidden' },
  orbOne: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,215,106,0.08)', top: -90, right: -100 },
  orbTwo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)', bottom: -70, left: -80 },
  brandWrap: { alignItems: 'center', marginBottom: 52 },
  kicker: { color: colors.sun, fontSize: 11, fontWeight: '900', letterSpacing: 2.1 },
  title: { color: colors.white, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 7 },
  subtitle: { color: '#CFE0E1', fontSize: 14, fontWeight: '700', marginTop: 3 },
  peopleRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  person: { width: 74, alignItems: 'center', gap: 8 },
  avatar: { width: 58, height: 58, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.24)' },
  parentAvatar: { backgroundColor: colors.teal },
  childAvatar: { backgroundColor: colors.orange },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '900' },
  name: { color: colors.white, fontSize: 11, fontWeight: '900' },
  route: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingBottom: 23, marginHorizontal: 4 },
  routeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.58)' },
  routeLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  pulseWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  pulseHalo: { position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: colors.sun },
  pulseCore: { width: 32, height: 32, borderRadius: 12, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  pulseText: { color: colors.navyDeep, fontSize: 16, fontWeight: '900' },
  loadingPill: { marginTop: 48, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  loadingText: { color: '#DDE9E9', fontSize: 11, fontWeight: '800' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.sun },
  dotMid: { opacity: 0.65 },
});
