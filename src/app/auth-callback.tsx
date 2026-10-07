import { Redirect } from 'expo-router';

// AuthProvider verifies the link; AccountAccessGate waits for server approval.
export default function AuthCallback() { return <Redirect href="/" />; }
