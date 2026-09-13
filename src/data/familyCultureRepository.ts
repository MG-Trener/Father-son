import type { SupabaseClient } from '@supabase/supabase-js';
import { rpcBoolean, rpcString } from '../lib/rpcResult';
import type { Database, Tables } from '../types/database';

type AppSupabaseClient = SupabaseClient<Database>;

export type FamilyAgreement = Tables<'family_agreements'>;
export type AgreementConfirmation = Tables<'family_agreement_confirmations'>;
export type RitualCadence = 'weekly' | 'monthly' | 'flexible';
export type FamilyRitual = Omit<Tables<'family_rituals'>, 'cadence'> & { cadence: RitualCadence };
export type RitualMoment = Tables<'ritual_moments'>;

export type RecordRitualMomentResult = {
  alreadyRecorded: boolean;
  eventId: string | null;
};

const normalizeRitual = (row: Tables<'family_rituals'>): FamilyRitual => {
  if (row.cadence !== 'weekly' && row.cadence !== 'monthly' && row.cadence !== 'flexible') {
    throw new Error(`UNSUPPORTED_RITUAL_CADENCE:${row.cadence}`);
  }
  return { ...row, cadence: row.cadence };
};

export async function listFamilyAgreements(client: AppSupabaseClient, familyId: string): Promise<FamilyAgreement[]> {
  const { data, error } = await client
    .from('family_agreements')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return data ?? [];
}

export async function listAgreementConfirmations(
  client: AppSupabaseClient,
  agreementIds: string[],
): Promise<AgreementConfirmation[]> {
  if (!agreementIds.length) return [];
  const { data, error } = await client
    .from('family_agreement_confirmations')
    .select('*')
    .in('agreement_id', agreementIds);
  if (error) throw error;
  return data ?? [];
}

export async function createFamilyAgreement(
  client: AppSupabaseClient,
  familyId: string,
  title: string,
  note?: string | null,
): Promise<string | null> {
  const { data, error } = await client.rpc('create_family_agreement', {
    p_family_id: familyId,
    p_title: title,
    p_note: note ?? null,
  });
  if (error) throw error;
  return rpcString(data, 'event_id');
}

export async function confirmFamilyAgreement(client: AppSupabaseClient, agreementId: string): Promise<string | null> {
  const { data, error } = await client.rpc('confirm_family_agreement', { p_agreement_id: agreementId });
  if (error) throw error;
  return rpcString(data, 'event_id');
}

export async function archiveFamilyAgreement(client: AppSupabaseClient, agreementId: string): Promise<void> {
  const { error } = await client.rpc('archive_family_agreement', { p_agreement_id: agreementId });
  if (error) throw error;
}

export async function listActiveRituals(client: AppSupabaseClient, familyId: string): Promise<FamilyRitual[]> {
  const { data, error } = await client
    .from('family_rituals')
    .select('*')
    .eq('family_id', familyId)
    .eq('active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeRitual);
}

export async function listRitualMoments(
  client: AppSupabaseClient,
  familyId: string,
  limit = 80,
): Promise<RitualMoment[]> {
  const { data, error } = await client
    .from('ritual_moments')
    .select('*')
    .eq('family_id', familyId)
    .order('happened_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createRitual(
  client: AppSupabaseClient,
  input: {
    familyId: string;
    userId: string;
    title: string;
    description?: string | null;
    symbol: string;
    cadence: RitualCadence;
    cadenceValue?: number | null;
  },
): Promise<void> {
  const { error } = await client.from('family_rituals').insert({
    family_id: input.familyId,
    created_by: input.userId,
    title: input.title,
    description: input.description ?? null,
    symbol: input.symbol,
    cadence: input.cadence,
    cadence_value: input.cadenceValue ?? null,
  });
  if (error) throw error;
}

export async function addRitualMoment(
  client: AppSupabaseClient,
  input: { ritualId: string; happenedOn: string },
): Promise<RecordRitualMomentResult> {
  const { data, error } = await client.rpc('record_ritual_moment', {
    p_ritual_id: input.ritualId,
    p_happened_on: input.happenedOn,
  });
  if (error) throw error;
  return {
    alreadyRecorded: rpcBoolean(data, 'already_recorded') ?? false,
    eventId: rpcString(data, 'event_id'),
  };
}

export async function archiveRitual(
  client: AppSupabaseClient,
  input: { familyId: string; ritualId: string; createdBy: string },
): Promise<void> {
  const { error } = await client
    .from('family_rituals')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', input.ritualId)
    .eq('family_id', input.familyId)
    .eq('created_by', input.createdBy);
  if (error) throw error;
}
