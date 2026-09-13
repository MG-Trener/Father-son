import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRpcString } from '../lib/rpcResult';
import type { Database, Tables } from '../types/database';

type AppSupabaseClient = SupabaseClient<Database>;

export type MeetingStatus = 'planned' | 'completed' | 'cancelled';
export type IdeaReaction = 'want' | 'must' | 'maybe';

export type Meeting = Pick<
  Tables<'meetings'>,
  'id' | 'family_id' | 'meeting_date' | 'title' | 'note' | 'status' | 'created_by' | 'created_at' | 'updated_at'
> & { status: MeetingStatus };

export type MeetingIdea = Pick<
  Tables<'meeting_ideas'>,
  'id' | 'meeting_id' | 'family_id' | 'created_by' | 'title' | 'created_at'
>;

export type MeetingIdeaReaction = Pick<
  Tables<'meeting_idea_reactions'>,
  'id' | 'idea_id' | 'family_id' | 'user_id' | 'reaction' | 'updated_at'
> & { reaction: IdeaReaction };

const assertMeetingStatus = (status: string): MeetingStatus => {
  if (status === 'planned' || status === 'completed' || status === 'cancelled') return status;
  throw new Error(`UNSUPPORTED_MEETING_STATUS:${status}`);
};

const assertIdeaReaction = (reaction: string): IdeaReaction => {
  if (reaction === 'want' || reaction === 'must' || reaction === 'maybe') return reaction;
  throw new Error(`UNSUPPORTED_IDEA_REACTION:${reaction}`);
};

export async function listMeetings(client: AppSupabaseClient, familyId: string): Promise<Meeting[]> {
  const { data, error } = await client
    .from('meetings')
    .select('id,family_id,meeting_date,title,note,status,created_by,created_at,updated_at')
    .eq('family_id', familyId)
    .in('status', ['planned', 'completed'])
    .order('meeting_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, status: assertMeetingStatus(row.status) }));
}

export async function listMeetingIdeas(
  client: AppSupabaseClient,
  familyId: string,
  meetingId: string,
): Promise<MeetingIdea[]> {
  const { data, error } = await client
    .from('meeting_ideas')
    .select('id,meeting_id,family_id,created_by,title,created_at')
    .eq('family_id', familyId)
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listMeetingIdeaReactions(
  client: AppSupabaseClient,
  ideaIds: string[],
): Promise<MeetingIdeaReaction[]> {
  if (!ideaIds.length) return [];

  const { data, error } = await client
    .from('meeting_idea_reactions')
    .select('id,idea_id,family_id,user_id,reaction,updated_at')
    .in('idea_id', ideaIds);

  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, reaction: assertIdeaReaction(row.reaction) }));
}

export async function createMeetingPlan(
  client: AppSupabaseClient,
  input: { familyId: string; meetingDate: string; title: string; note?: string | null },
): Promise<string> {
  const { data, error } = await client.rpc('create_meeting_plan', {
    p_family_id: input.familyId,
    p_meeting_date: input.meetingDate,
    p_title: input.title,
    p_note: input.note ?? null,
  });
  if (error) throw error;
  return requireRpcString(data, 'meeting_id', 'MEETING_CREATE_RESULT_INVALID');
}

export async function completeMeetingPlan(client: AppSupabaseClient, meetingId: string): Promise<void> {
  const { error } = await client.rpc('complete_meeting_plan', { p_meeting_id: meetingId });
  if (error) throw error;
}

export async function cancelMeetingPlan(
  client: AppSupabaseClient,
  familyId: string,
  meetingId: string,
): Promise<void> {
  const { error } = await client
    .from('meetings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', meetingId)
    .eq('family_id', familyId);
  if (error) throw error;
}

export async function addMeetingIdea(
  client: AppSupabaseClient,
  input: { familyId: string; meetingId: string; createdBy: string; title: string },
): Promise<void> {
  const { error } = await client.from('meeting_ideas').insert({
    family_id: input.familyId,
    meeting_id: input.meetingId,
    created_by: input.createdBy,
    title: input.title,
    reaction: null,
  });
  if (error) throw error;
}

export async function setMeetingIdeaReaction(
  client: AppSupabaseClient,
  input: { familyId: string; ideaId: string; userId: string; reaction: IdeaReaction },
): Promise<void> {
  const { error } = await client.from('meeting_idea_reactions').upsert({
    family_id: input.familyId,
    idea_id: input.ideaId,
    user_id: input.userId,
    reaction: input.reaction,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'idea_id,user_id' });
  if (error) throw error;
}

export async function removeMeetingIdeaReaction(
  client: AppSupabaseClient,
  ideaId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('meeting_idea_reactions')
    .delete()
    .eq('idea_id', ideaId)
    .eq('user_id', userId);
  if (error) throw error;
}
