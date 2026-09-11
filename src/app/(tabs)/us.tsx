import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import UsV2 from '../../screens/UsV2';
import { colors, shadows } from '../../theme';

export default function UsTab() {
  return (
    <View style={styles.root}>
      <UsV2 />
      <Pressable style={[styles.agreementButton, shadows.lift]} onPress={() => router.push('/agreements')}>
        <View style={styles.icon}><Text style={styles.iconText}>🤝</Text></View>
        <View>
          <Text style={styles.kicker}>МЕЖДУ НАМИ</Text>
          <Text style={styles.text}>Договорённости</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  agreementButton: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: '#FFF0CF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E9D7AC',
  },
  icon: { width: 31, height: 31, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 15 },
  kicker: { color: '#9B7027', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  text: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', marginTop: 1 },
});
