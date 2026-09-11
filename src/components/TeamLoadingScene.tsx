import { useEffect, useRef } from 'react';
import { Animated, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

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

  return (
    <View style={[styles.safe, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <ImageBackground
        source={require('../../assets/generated/splash-screen.png')}
        style={styles.scene}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(6,26,36,0.02)', 'rgba(6,26,36,0.05)', 'rgba(6,26,36,0.78)']}
          locations={[0, 0.64, 1]}
          style={styles.overlay}
        >
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingTitle}>Одна команда. Где бы мы ни были.</Text>
            <View style={styles.loadingPill}>
              <Text style={styles.loadingText}>Собираем ваше пространство</Text>
              <View style={styles.dots}>
                <Animated.View style={[styles.dot, { opacity: pulse }]} />
                <View style={[styles.dot, styles.dotMid]} />
                <Animated.View
                  style={[
                    styles.dot,
                    { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) },
                  ]}
                />
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.night },
  scene: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  loadingWrap: { alignItems: 'center', gap: 12 },
  loadingTitle: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 8,
  },
  loadingPill: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(6,31,41,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  loadingText: { color: '#F7F2E8', fontSize: 11, fontWeight: '800' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.sun },
  dotMid: { opacity: 0.65 },
});
