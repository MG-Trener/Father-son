import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRpcString } from '../lib/rpcResult';
import type { Database } from '../types/database';

type AppSupabaseClient = SupabaseClient<Database>;

export async function createReflection(
  client: AppSupabaseClient,
  input: { familyId: string; body: string; prompt?: string | null },
): Promise<string> {
  const { data, error } = await client.rpc('create_reflection_entry', {
    p_family_id: input.familyId,
    p_body: input.body,
    p_prompt: input.prompt ?? null,
  });
  if (error) throw error;
  return requireRpcString(data, 'reflection_id', 'REFLECTION_ID_MISSING');
}
