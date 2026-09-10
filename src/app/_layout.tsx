import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { FamilyProvider } from '../context/FamilyContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <FamilyProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </FamilyProvider>
    </AuthProvider>
  );
}
