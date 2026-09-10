import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type FamilyMember = {
  family_id: string;
  user_id: string;
  role: 'parent' | 'child';
  display_name: string;
  birth_date: string | null;
  joined_at: string;
};

export type FamilyTeam = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

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

  const clear = useCallback(() => {
    setFamily(null);
    setMe(null);
    setMembers([]);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !session) {
      clear();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: membership, error: membershipError } = await supabase
        .from('family_members')
        .select('family_id,user_id,role,display_name,birth_date,joined_at')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership) {
        setFamily(null);
        setMe(null);
        setMembers([]);
        return;
      }

      const [familyResult, membersResult] = await Promise.all([
        supabase
          .from('families')
          .select('id,name,created_by,created_at')
          .eq('id', membership.family_id)
          .single(),
        supabase
          .from('family_members')
          .select('family_id,user_id,role,display_name,birth_date,joined_at')
          .eq('family_id', membership.family_id)
          .order('joined_at', { ascending: true }),
      ]);

      if (familyResult.error) throw familyResult.error;
      if (membersResult.error) throw membersResult.error;

      setFamily(familyResult.data as FamilyTeam);
      setMe(membership as FamilyMember);
      setMembers((membersResult.data ?? []) as FamilyMember[]);
    } catch (caught) {
      clear();
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить команду.');
    } finally {
      setLoading(false);
    }
  }, [clear, session]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const signalFamilyDataChanged = useCallback(() => {
    setFamily((current) => (current ? { ...current } : current));
  }, []);

  const familyId = family?.id ?? null;
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase || !familyId || !userId) return undefined;

    const channel = supabase
      .channel(`family-live-${familyId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_events',
          filter: `family_id=eq.${familyId}`,
        },
        signalFamilyDataChanged,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'missions',
          filter: `family_id=eq.${familyId}`,
        },
        signalFamilyDataChanged,
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [familyId, signalFamilyDataChanged, userId]);

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
