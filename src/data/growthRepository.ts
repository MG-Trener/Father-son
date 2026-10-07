import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRpcString, rpcBoolean, rpcNumber, rpcStringArray } from '../lib/rpcResult';
import type { Database, Json, Tables } from '../types/database';

type AppSupabaseClient = SupabaseClient<Database>;

export type GrowthCategory = 'school' | 'football' | 'chess' | 'english' | 'leadership';
export type MissionCategory = GrowthCategory | 'together';

export type GrowthEntry = Tables<'growth_entries'>;
export type Mission = Tables<'missions'>;
export type SkillPath = Tables<'skill_paths'>;
export type SkillNode = Tables<'skill_nodes'>;
export type SkillProgress = Tables<'skill_progress'>;
export type AchievementAward = Tables<'achievement_awards'>;
export type AchievementDefinition = Tables<'achievement_definitions'>;

export type CreateMissionInput = {
  familyId: string;
  category: MissionCategory;
  title: string;
  description?: string | null;
  assignedTo?: string | null;
  dueAt?: string | null;
  xpReward?: number;
  skillNodeId?: string | null;
};

export type CompleteMissionResult = {
  missionId: string;
  alreadyCompleted: boolean;
  xpReward: number | null;
  achievementTitles: string[];
};

export async function listSkillPaths(client: AppSupabaseClient): Promise<SkillPath[]> {
  const { data, error } = await client.from('skill_paths').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listSkillNodes(client: AppSupabaseClient): Promise<SkillNode[]> {
  const { data, error } = await client
    .from('skill_nodes')
    .select('*')
    .eq('hidden', false)
    .order('path_id', { ascending: true })
    .order('stage_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getSkillNode(client: AppSupabaseClient, nodeId: string): Promise<SkillNode | null> {
  const { data, error } = await client
    .from('skill_nodes')
    .select('*')
    .eq('id', nodeId)
    .eq('hidden', false)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMissions(client: AppSupabaseClient, familyId: string): Promise<Mission[]> {
  const { data, error } = await client
    .from('missions')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listGrowthEntries(client: AppSupabaseClient, familyId: string): Promise<GrowthEntry[]> {
  const { data, error } = await client
    .from('growth_entries')
    .select('*')
    .eq('family_id', familyId)
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSkillProgress(
  client: AppSupabaseClient,
  familyId: string,
  userId: string,
): Promise<SkillProgress[]> {
  const { data, error } = await client
    .from('skill_progress')
    .select('*')
    .eq('family_id', familyId)
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function listAchievementAwards(
  client: AppSupabaseClient,
  familyId: string,
): Promise<AchievementAward[]> {
  const { data, error } = await client
    .from('achievement_awards')
    .select('*')
    .eq('family_id', familyId)
    .order('awarded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAchievementDefinitions(client: AppSupabaseClient): Promise<AchievementDefinition[]> {
  const { data, error } = await client
    .from('achievement_definitions')
    .select('*')
    .eq('hidden', false)
    .order('tier', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createGrowthEntry(
  client: AppSupabaseClient,
  input: {
    familyId: string;
    userId: string;
    category: GrowthCategory;
    entryType: string;
    activityDate?: string;
    title?: string | null;
    note?: string | null;
    metrics?: Json;
  },
): Promise<string> {
  const { data, error } = await client.rpc('create_growth_entry', {
    p_family_id: input.familyId,
    p_user_id: input.userId,
    p_category: input.category,
    p_entry_type: input.entryType,
    ...(input.activityDate ? { p_activity_date: input.activityDate } : {}),
    p_title: input.title ?? null,
    p_note: input.note ?? null,
    ...(input.metrics === undefined ? {} : { p_metrics: input.metrics }),
  });
  if (error) throw error;
  return requireRpcString(data, 'entry_id', 'GROWTH_ENTRY_RESULT_INVALID');
}

export async function createMission(client: AppSupabaseClient, input: CreateMissionInput): Promise<string> {
  const { data, error } = await client.rpc('create_mission', {
    p_family_id: input.familyId,
    p_category: input.category,
    p_title: input.title,
    p_description: input.description ?? null,
    p_assigned_to: input.assignedTo ?? null,
    p_due_at: input.dueAt ?? null,
    p_xp_reward: input.xpReward ?? 10,
    p_skill_node_id: input.skillNodeId ?? null,
  });
  if (error) throw error;
  return requireRpcString(data, 'mission_id', 'MISSION_CREATE_RESULT_INVALID');
}

export async function completeMission(client: AppSupabaseClient, missionId: string): Promise<CompleteMissionResult> {
  const { data, error } = await client.rpc('complete_mission', { p_mission_id: missionId });
  if (error) throw error;
  return {
    missionId: requireRpcString(data, 'mission_id', 'MISSION_COMPLETE_RESULT_INVALID'),
    alreadyCompleted: rpcBoolean(data, 'already_completed') ?? false,
    xpReward: rpcNumber(data, 'xp_reward'),
    achievementTitles: rpcStringArray(data, 'achievement_titles'),
  };
}
