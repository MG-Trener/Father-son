import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getFamily,
  getFamilyMembers,
  getFamilySnapshot,
  type FamilyMember,
  type FamilyTeam,
} from '../data/familyRepository';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type { FamilyMember, FamilyTeam } from '../data/familyRepository';

type FamilyContextValue = {
  family: FamilyTeam | null;
  me: FamilyMember | null;
  members: FamilyMember[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const FamilyContext = createContext<FamilyContextValue | undefined>(undefined);

export function FamilyProvider({ children }: PropsWithChildren) {
  const { session, loading: authLoading } = useAuth();
  const [family, setFamily] = useState<FamilyTeam | null>(null);
  const [me, setMe] = useState<FamilyMember | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const familySignalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teamRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    setFamily(null);
    setMe(null);
    setMembers([]);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    const client = supabase;
    const userId = session?.user.id;

    if (!isSupabaseConfigured || !client || !userId) {
      clear();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const snapshot = await getFamilySnapshot(client, userId);
      if (!snapshot) {
        clear();
        return;
      }

      setFamily(snapshot.family);
      setMe(snapshot.me);
      setMembers(snapshot.members);
    } catch (caught) {
      clear();
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить команду.');
    } finally {
      setLoading(false);
    }
  }, [clear, session?.user.id]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const refreshFamilyRecord = useCallback(async (familyId: string) => {
    const client = supabase;
    if (!client) return;

    try {
      const nextFamily = await getFamily(client, familyId);
      setError(null);
      setFamily(nextFamily);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось обновить данные семьи.');
    }
  }, []);

  const refreshMembers = useCallback(async (familyId: string, userId: string) => {
    const client = supabase;
    if (!client) return;

    try {
      const nextMembers = await getFamilyMembers(client, familyId);
      const nextMe = nextMembers.find((member) => member.user_id === userId) ?? null;
      if (!nextMe) {
        void refresh();
        return;
      }

      setError(null);
      setMembers(nextMembers);
      setMe(nextMe);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось обновить состав команды.');
    }
  }, [refresh]);

  const signalFamilyDataChanged = useCallback(() => {
    if (familySignalTimer.current) clearTimeout(familySignalTimer.current);
    familySignalTimer.current = setTimeout(() => {
      familySignalTimer.current = null;
      setFamily((current) => (current ? { ...current } : current));
    }, 80);
  }, []);

  const scheduleTeamRefresh = useCallback((familyId: string, userId: string) => {
    if (teamRefreshTimer.current) clearTimeout(teamRefreshTimer.current);
    teamRefreshTimer.current = setTimeout(() => {
      teamRefreshTimer.current = null;
      void refreshMembers(familyId, userId);
    }, 80);
  }, [refreshMembers]);

  useEffect(() => () => {
    if (familySignalTimer.current) clearTimeout(familySignalTimer.current);
    if (teamRefreshTimer.current) clearTimeout(teamRefreshTimer.current);
  }, []);

  const familyId = family?.id ?? null;
  const userId = session?.user.id ?? null;

  useEffect(() => {
    const client = supabase;
    if (!client || !familyId || !userId) return undefined;

    const onFamilyChange = () => {
      signalFamilyDataChanged();
    };
    const onFamilyRecordChange = () => {
      void refreshFamilyRecord(familyId);
    };
    const onTeamChange = () => {
      scheduleTeamRefresh(familyId, userId);
    };

    const channel = client
      .channel(`family-live-${familyId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'families',
          filter: `id=eq.${familyId}`,
        },
        onFamilyRecordChange,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_members',
          filter: `family_id=eq.${familyId}`,
        },
        onTeamChange,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'family_members',
          filter: `family_id=eq.${familyId}`,
        },
        onTeamChange,
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'family_members',
          filter: `family_id=eq.${familyId}`,
        },
        onTeamChange,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_events',
          filter: `family_id=eq.${familyId}`,
        },
        onFamilyChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'missions',
          filter: `family_id=eq.${familyId}`,
        },
        onFamilyChange,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moods',
          filter: `family_id=eq.${familyId}`,
        },
        onFamilyChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
          filter: `family_id=eq.${familyId}`,
        },
        onFamilyChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_ideas',
          filter: `family_id=eq.${familyId}`,
        },
        onFamilyChange,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'growth_entries',
          filter: `family_id=eq.${familyId}`,
        },
        onFamilyChange,
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [familyId, refreshFamilyRecord, scheduleTeamRefresh, signalFamilyDataChanged, userId]);

  const value = useMemo<FamilyContextValue>(
    () => ({ family, me, members, loading, error, refresh }),
    [family, me, members, loading, error, refresh],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const value = useContext(FamilyContext);
  if (!value) {
    throw new Error('useFamily must be used inside FamilyProvider');
  }
  return value;
}
