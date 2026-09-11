import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import TogetherV2 from '../../screens/TogetherV2';
import { colors, shadows } from '../../theme';

export default function TogetherTab() {
  return (
    <View style={styles.root}>
      <TogetherV2 />
      <View style={styles.quickDock}>
        <Pressable style={[styles.quickButton, styles.recognitionButton, shadows.lift]} onPress={() => router.push('/recognitions')}>
          <Text style={styles.recognitionIcon}>✦</Text>
          <Text style={styles.recognitionText}>Я заметил</Text>
        </Pressable>
        <Pressable style={[styles.quickButton, styles.pulseButton, shadows.lift]} onPress={() => router.push('/mood-check-in')}>
          <Text style={styles.pulseIcon}>♥</Text>
          <Text style={styles.pulseText}>Как мы?</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  quickDock: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    alignItems: 'flex-end',
    gap: 7,
  },
  quickButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
  },
  recognitionButton: { backgroundColor: '#F4EAF7', borderColor: '#D9C9E7' },
  pulseButton: { backgroundColor: colors.navy, borderColor: colors.navy },
  recognitionIcon: { color: colors.purple, fontSize: 13, fontWeight: '900' },
  recognitionText: { color: colors.purple, fontSize: 11, fontWeight: '900' },
  pulseIcon: { color: colors.sun, fontSize: 13, fontWeight: '900' },
  pulseText: { color: colors.white, fontSize: 11, fontWeight: '900' },
});
