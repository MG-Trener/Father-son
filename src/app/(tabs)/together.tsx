import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import TogetherV2 from '../../screens/TogetherV2';
import { colors, shadows } from '../../theme';

export default function TogetherTab() {
  return (
    <View style={styles.root}>
      <TogetherV2 />
      <Pressable style={[styles.pulseButton, shadows.lift]} onPress={() => router.push('/mood-check-in')}>
        <Text style={styles.pulseIcon}>♥</Text>
        <Text style={styles.pulseText}>Как мы?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pulseButton: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 22,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pulseIcon: { color: colors.sun, fontSize: 14, fontWeight: '900' },
  pulseText: { color: colors.white, fontSize: 12, fontWeight: '900' },
});
