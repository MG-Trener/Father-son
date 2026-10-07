import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AppUpdateGate } from '../components/AppUpdateGate';
import { AccountAccessGate } from '../components/AccountAccessGate';
import { PushNotificationsBridge } from '../components/PushNotificationsBridge';
import { AuthProvider } from '../context/AuthContext';
import { FamilyProvider } from '../context/FamilyContext';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <AppUpdateGate />
        <AccountAccessGate>
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
        </AccountAccessGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
