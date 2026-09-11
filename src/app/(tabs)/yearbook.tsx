import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import YearBookV2 from '../../screens/YearBookV2';
import { colors, shadows } from '../../theme';

export default function YearBookTab() {
  return (
    <View style={styles.root}>
      <YearBookV2 />
      <View style={styles.quickArchive}>
        <Pressable style={[styles.archiveButton, styles.historyButton, shadows.lift]} onPress={() => router.push('/(tabs)/history')}>
          <Text style={styles.historyIcon}>↺</Text>
          <View>
            <Text style={styles.archiveKicker}>АРХИВ</Text>
            <Text style={styles.archiveText}>История</Text>
          </View>
        </Pressable>
        <Pressable style={[styles.archiveButton, styles.lettersButton, shadows.lift]} onPress={() => router.push('/letters')}>
          <Text style={styles.lettersIcon}>✉️</Text>
          <View>
            <Text style={styles.archiveKicker}>КАПСУЛА</Text>
            <Text style={styles.archiveText}>Письма</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  quickArchive: {
    position: 'absolute',
    right: 16,
    bottom: 15,
    flexDirection: 'row',
    gap: 8,
  },
  archiveButton: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
  },
  historyButton: {
    backgroundColor: colors.paper,
    borderColor: '#D8E1DF',
  },
  lettersButton: {
    backgroundColor: colors.navyDeep,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  historyIcon: { color: colors.teal, fontSize: 19, fontWeight: '900' },
  lettersIcon: { fontSize: 19 },
  archiveKicker: { color: '#8AA0A3', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  archiveText: { color: colors.text, fontSize: 10, fontWeight: '900', marginTop: 1 },
});
