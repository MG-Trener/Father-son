import type { SupabaseClient } from '@supabase/supabase-js';

export type FamilyRole = 'parent' | 'child';

export type FamilyMember = {
  family_id: string;
  user_id: string;
  role: FamilyRole;
  display_name: string;
  birth_date: string | null;
  joined_at: string;
  onboarding_completed_at: string | null;
};

export type FamilyTeam = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

const memberFields = 'family_id,user_id,role,display_name,birth_date,joined_at,onboarding_completed_at';
const familyFields = 'id,name,created_by,created_at';

const normalizeMember = (row: Record<string, unknown>): FamilyMember => ({
  family_id: String(row.family_id),
  user_id: String(row.user_id),
  role: row.role === 'child' ? 'child' : 'parent',
  display_name: String(row.display_name ?? ''),
  birth_date: typeof row.birth_date === 'string' ? row.birth_date : null,
  joined_at: String(row.joined_at),
  onboarding_completed_at: typeof row.onboarding_completed_at === 'string' ? row.onboarding_completed_at : null,
});

const normalizeFamily = (row: Record<string, unknown>): FamilyTeam => ({
  id: String(row.id),
  name: String(row.name ?? ''),
  created_by: String(row.created_by),
  created_at: String(row.created_at),
});

export async function getMembership(client: SupabaseClient, userId: string): Promise<FamilyMember | null> {
  const { data, error } = await client
    .from('family_members')
    .select(memberFields)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeMember(data as Record<string, unknown>) : null;
}

export async function getFamily(client: SupabaseClient, familyId: string): Promise<FamilyTeam> {
  const { data, error } = await client
    .from('families')
    .select(familyFields)
    .eq('id', familyId)
    .single();

  if (error) throw error;
  return normalizeFamily(data as Record<string, unknown>);
}

export async function getFamilyMembers(client: SupabaseClient, familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await client
    .from('family_members')
    .select(memberFields)
    .eq('family_id', familyId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => normalizeMember(row as Record<string, unknown>));
}

export async function getFamilySnapshot(client: SupabaseClient, userId: string) {
  const membership = await getMembership(client, userId);
  if (!membership) return null;

  const [family, members] = await Promise.all([
    getFamily(client, membership.family_id),
    getFamilyMembers(client, membership.family_id),
  ]);

  const me = members.find((member) => member.user_id === userId) ?? membership;
  return { family, members, me };
}
