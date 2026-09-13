import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database';

export type FamilyRole = 'parent' | 'child';
export type FamilyMember = Omit<Tables<'family_members'>, 'role'> & { role: FamilyRole };
export type FamilyTeam = Pick<Tables<'families'>, 'id' | 'name' | 'created_by' | 'created_at'>;

type AppSupabaseClient = SupabaseClient<Database>;

const memberFields = 'family_id,user_id,role,display_name,birth_date,joined_at,onboarding_completed_at';
const familyFields = 'id,name,created_by,created_at';

const normalizeMember = (row: Tables<'family_members'>): FamilyMember => {
  if (row.role !== 'parent' && row.role !== 'child') {
    throw new Error(`UNSUPPORTED_FAMILY_ROLE:${row.role}`);
  }
  return { ...row, role: row.role };
};

export async function getMembership(client: AppSupabaseClient, userId: string): Promise<FamilyMember | null> {
  const { data, error } = await client
    .from('family_members')
    .select(memberFields)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeMember(data as Tables<'family_members'>) : null;
}

export async function getFamily(client: AppSupabaseClient, familyId: string): Promise<FamilyTeam> {
  const { data, error } = await client
    .from('families')
    .select(familyFields)
    .eq('id', familyId)
    .single();

  if (error) throw error;
  return data as FamilyTeam;
}

export async function getFamilyMembers(client: AppSupabaseClient, familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await client
    .from('family_members')
    .select(memberFields)
    .eq('family_id', familyId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => normalizeMember(row as Tables<'family_members'>));
}

export async function getFamilySnapshot(client: AppSupabaseClient, userId: string) {
  const membership = await getMembership(client, userId);
  if (!membership) return null;

  const [family, members] = await Promise.all([
    getFamily(client, membership.family_id),
    getFamilyMembers(client, membership.family_id),
  ]);

  const me = members.find((member) => member.user_id === userId) ?? membership;
  return { family, members, me };
}
