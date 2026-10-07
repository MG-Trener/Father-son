import type { Database as GeneratedDatabase, Json } from './database.generated';

type PublicSchema = GeneratedDatabase['public'];
type GeneratedFunctions = PublicSchema['Functions'];

type NullableRpcOverrides = {
  create_family_agreement: {
    Args: Omit<GeneratedFunctions['create_family_agreement']['Args'], 'p_note'> & { p_note?: string | null };
    Returns: Json;
  };
  create_family_invite: {
    Args: Omit<GeneratedFunctions['create_family_invite']['Args'], 'p_display_name_hint'> & { p_display_name_hint?: string | null };
    Returns: Json;
  };
  create_growth_entry: {
    Args: Omit<GeneratedFunctions['create_growth_entry']['Args'], 'p_note' | 'p_title'> & {
      p_note?: string | null;
      p_title?: string | null;
    };
    Returns: Json;
  };
  create_meeting_plan: {
    Args: Omit<GeneratedFunctions['create_meeting_plan']['Args'], 'p_note'> & { p_note?: string | null };
    Returns: Json;
  };
  create_mission: {
    Args: Omit<GeneratedFunctions['create_mission']['Args'], 'p_assigned_to' | 'p_description' | 'p_due_at' | 'p_skill_node_id'> & {
      p_assigned_to?: string | null;
      p_description?: string | null;
      p_due_at?: string | null;
      p_skill_node_id?: string | null;
    };
    Returns: Json;
  };
  create_reflection_entry: {
    Args: Omit<GeneratedFunctions['create_reflection_entry']['Args'], 'p_prompt'> & { p_prompt?: string | null };
    Returns: Json;
  };
  join_family_by_code: {
    Args: Omit<GeneratedFunctions['join_family_by_code']['Args'], 'p_birth_date'> & { p_birth_date?: string | null };
    Returns: Json;
  };
  register_voice_story: {
    Args: Omit<GeneratedFunctions['register_voice_story']['Args'], 'p_prompt' | 'p_title'> & {
      p_prompt?: string | null;
      p_title?: string | null;
    };
    Returns: Json;
  };
  send_connection_signal: {
    Args: Omit<GeneratedFunctions['send_connection_signal']['Args'], 'p_message'> & { p_message?: string | null };
    Returns: Json;
  };
};

type AppRpcAdditions = {
  get_account_access: {
    Args: Record<PropertyKey, never>;
    Returns: Json;
  };
  record_ritual_moment: {
    Args: { p_ritual_id: string; p_happened_on?: string };
    Returns: Json;
  };
};

/**
 * App-facing database type.
 *
 * `database.generated.ts` is the raw schema snapshot. PostgreSQL function
 * arguments with `DEFAULT NULL` are currently generated as optional strings,
 * even though passing SQL NULL is valid and used by the app. Keep those
 * narrow overrides here instead of editing the generated snapshot.
 *
 * AppRpcAdditions lets a just-deployed backwards-compatible RPC be consumed
 * immediately; the raw snapshot is regenerated from production on the next
 * full schema sync.
 */
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<PublicSchema, 'Functions'> & {
    Functions: Omit<GeneratedFunctions, keyof NullableRpcOverrides> & NullableRpcOverrides & AppRpcAdditions;
  };
};

export type { Json } from './database.generated';
export type Tables<TableName extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][TableName]['Row'];
export type TablesInsert<TableName extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][TableName]['Insert'];
export type TablesUpdate<TableName extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][TableName]['Update'];
