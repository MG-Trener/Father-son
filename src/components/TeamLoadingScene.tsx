import { useEffect, useRef } from 'react';
import { Animated, Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

type Props = {
  topInset?: number;
  bottomInset?: number;
};

export function TeamLoadingScene({ topInset = 0, bottomInset = 0 }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    const progressAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 2100, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    pulseAnimation.start();
    progressAnimation.start();
    return () => {
      pulseAnimation.stop();
      progressAnimation.stop();
    };
  }, [progress, pulse]);

  return (
    <View style={[styles.safe, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <ImageBackground
        source={require('../../assets/generated/splash-screen.png')}
        style={styles.scene}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(6,26,36,0.02)', 'rgba(6,26,36,0.05)', 'rgba(6,26,36,0.82)']}
          locations={[0, 0.60, 1]}
          style={styles.overlay}
        >
          <View style={styles.loadingWrap}>
            <View style={styles.brandBadge}>
              <Image source={require('../../assets/generated/app-icon.png')} style={styles.brandIcon} resizeMode="cover" />
            </View>
            <Text style={styles.loadingTitle}>Одна команда. Где бы мы ни были.</Text>
            <View style={styles.loadingPill}>
              <View style={styles.loadingCopy}>
                <Text style={styles.loadingText}>Собираем ваше пространство</Text>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { transform: [{ scaleX: progress }], transformOrigin: 'left center' },
                    ]}
                  />
                </View>
              </View>
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
  brandBadge: {
    width: 74,
    height: 74,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  brandIcon: { width: '100%', height: '100%' },
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
    minHeight: 58,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(6,31,41,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    minWidth: 255,
  },
  loadingCopy: { flex: 1, gap: 7 },
  loadingText: { color: '#F7F2E8', fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.sun, width: '100%' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.sun },
  dotMid: { opacity: 0.65 },
});
