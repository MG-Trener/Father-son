import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import YearBookV2 from '../../screens/YearBookV2';
import { colors, shadows } from '../../theme';

export default function YearBookTab() {
  return (
    <View style={styles.root}>
      <YearBookV2 />
      <Pressable style={[styles.lettersButton, shadows.lift]} onPress={() => router.push('/letters')}>
        <Text style={styles.lettersIcon}>✉️</Text>
        <View>
          <Text style={styles.lettersKicker}>КАПСУЛА</Text>
          <Text style={styles.lettersText}>Письма</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  lettersButton: {
    position: 'absolute',
    right: 16,
    bottom: 15,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.navyDeep,
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  lettersIcon: { fontSize: 19 },
  lettersKicker: { color: '#AFC7CA', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  lettersText: { color: colors.white, fontSize: 10, fontWeight: '900', marginTop: 1 },
});
