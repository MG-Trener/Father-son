import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { parseOwnerCallback } from '../domain/ownerAccess';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { unregisterAllPushDevices } from '../lib/pushDevices';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  linkError: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let processing = false;
    const acceptLink = async (url: string | null) => {
      if (!url || processing) return;
      try {
        const tokens = parseOwnerCallback(url);
        if (!tokens) return;
        processing = true;
        setLinkError(null);
        const { data: current } = await client.auth.getSession();
        const { data: verified, error } = await client.auth.getUser(tokens.access_token);
        if (error || !verified.user) throw new Error('Ссылка недействительна. Запросите новое письмо.');
        if (current.session && current.session.user.id !== verified.user.id) {
          throw new Error('Это письмо для другого аккаунта. Сначала выйдите из текущего аккаунта.');
        }
        const { error: sessionError } = await client.auth.setSession(tokens);
        if (sessionError) throw new Error('Ссылка устарела. Запросите новое письмо.');
      } catch (error) { setLinkError(error instanceof Error ? error.message : 'Не удалось подтвердить вход.'); }
      finally { processing = false; }
    };
    void Linking.getInitialURL().then(acceptLink);
    const listener = Linking.addEventListener('url', ({ url }) => { void acceptLink(url); });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let receivedAuthEvent = false;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted && !receivedAuthEvent) setSession(data.session);
      } catch {
        if (mounted && !receivedAuthEvent) setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      linkError,
      signOut: async () => {
        if (!supabase) return;

        try {
          if (session) {
            await unregisterAllPushDevices();
          }
        } finally {
          await supabase.auth.signOut({ scope: 'local' });
          setLinkError(null);
        }
      },
    }),
    [session, loading, linkError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
