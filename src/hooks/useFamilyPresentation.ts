import { useFamily } from '../context/FamilyContext';
import { familyPresentation } from '../domain/presentation';
import { isSupabaseConfigured } from '../lib/supabase';

export function useFamilyPresentation() {
  const { members, me } = useFamily();
  // UI preview only: never override an authenticated user's real role.
  const previewRole = __DEV__ && !isSupabaseConfigured && process.env.EXPO_PUBLIC_PREVIEW_ROLE === 'child' ? 'child' : 'parent';
  return familyPresentation(members, me, previewRole);
}
