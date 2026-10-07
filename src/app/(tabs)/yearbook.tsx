import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { brandAssets } from '../../brandAssets';
import YearBookV2 from '../../screens/YearBookV2';
import { colors, shadows } from '../../theme';

export default function YearBookTab() {
  return (
    <View style={styles.root}>
      <YearBookV2 />
      <View style={styles.quickArchive}>
        <Pressable style={[styles.archiveButton, styles.historyButton, shadows.lift]} onPress={() => router.push('/(tabs)/history')}>
          <View style={styles.iconShellLight}>
            <Image source={brandAssets.navigation.book} style={styles.archiveImage} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.archiveKicker}>АРХИВ</Text>
            <Text style={styles.archiveText}>История</Text>
          </View>
        </Pressable>
        <Pressable style={[styles.archiveButton, styles.lettersButton, shadows.lift]} onPress={() => router.push('/letters')}>
          <View style={styles.iconShellDark}>
            <Image source={brandAssets.utility.letter} style={styles.archiveImage} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.lettersKicker}>КАПСУЛА</Text>
            <Text style={styles.lettersText}>Письма</Text>
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
    minHeight: 58,
    borderRadius: 19,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
  },
  historyButton: {
    backgroundColor: '#FFF8E9',
    borderColor: '#EBCB86',
  },
  lettersButton: {
    backgroundColor: colors.navyDeep,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  iconShellLight: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: colors.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconShellDark: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: '#FFF0CF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  archiveImage: { width: 36, height: 36 },
  archiveKicker: { color: '#9B7027', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  lettersKicker: { color: '#F1CB76', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  archiveText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
  lettersText: { color: colors.white, fontSize: 10, fontWeight: '900', marginTop: 1 },
});
