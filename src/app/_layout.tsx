import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { PushNotificationsBridge } from '../components/PushNotificationsBridge';
import { AuthProvider } from '../context/AuthContext';
import { FamilyProvider } from '../context/FamilyContext';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <FamilyProvider>
          <PushNotificationsBridge />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.sand },
            }}
          />
        </FamilyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
