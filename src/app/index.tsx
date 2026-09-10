import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { colors } from '../theme';

export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  if (authLoading || (session && familyLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  if (!isSupabaseConfigured) {
    return <Redirect href="/(tabs)" />;
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  if (!family) {
    return <Redirect href="/team-setup" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sand,
  },
});
