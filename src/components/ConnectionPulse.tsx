import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type ConnectionPulseProps = {
  size?: number;
  color?: string;
  active?: boolean;
};

export function ConnectionPulse({ size = 58, color = colors.orange, active = true }: ConnectionPulseProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [active, progress]);

  const ringStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.46, 0.22, 0] }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.45] }) }],
  };
  const coreStyle = {
    transform: [{ scale: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] }) }],
  };

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2, borderColor: color },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.core,
          {
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: size * 0.21,
            backgroundColor: color,
          },
          coreStyle,
        ]}
      >
        <View style={styles.spark} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
});
