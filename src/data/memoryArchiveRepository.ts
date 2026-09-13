import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRpcString, rpcString } from '../lib/rpcResult';
import type { Database, Tables } from '../types/database';

type AppSupabaseClient = SupabaseClient<Database>;

export type VoiceStory = Tables<'voice_stories'>;
export type FutureLetter = Tables<'future_letters'>;
export type FutureLetterDraft = FutureLetter & { body: string };

export type RegisteredVoiceStory = {
  voiceStoryId: string;
  eventId: string | null;
};

export type OpenedFutureLetter = {
  letterId: string;
  title: string;
  body: string;
  authorUserId: string;
  recipientUserId: string;
  unlockAt: string;
  openedAt: string;
  eventId: string | null;
};

export async function listVoiceStories(
  client: AppSupabaseClient,
  familyId: string,
  limit = 100,
): Promise<VoiceStory[]> {
  const { data, error } = await client
    .from('voice_stories')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'ready')
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function uploadVoiceStoryAudio(
  client: AppSupabaseClient,
  storagePath: string,
  audio: ArrayBuffer,
): Promise<void> {
  const { error } = await client.storage
    .from('voice-stories')
    .upload(storagePath, audio, {
      contentType: 'audio/mp4',
      cacheControl: '3600',
      upsert: false,
    });
  if (error) throw error;
}

export async function removeVoiceStoryAudio(client: AppSupabaseClient, storagePath: string): Promise<void> {
  const { error } = await client.storage.from('voice-stories').remove([storagePath]);
  if (error) throw error;
}

export async function createVoiceStorySignedUrl(
  client: AppSupabaseClient,
  storagePath: string,
  expiresInSeconds = 10 * 60,
): Promise<string> {
  const { data, error } = await client.storage
    .from('voice-stories')
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('VOICE_SIGNED_URL_MISSING');
  return data.signedUrl;
}

export async function registerVoiceStory(
  client: AppSupabaseClient,
  input: {
    familyId: string;
    storagePath: string;
    durationMs: number;
    title?: string | null;
    prompt?: string | null;
  },
): Promise<RegisteredVoiceStory> {
  const { data, error } = await client.rpc('register_voice_story', {
    p_family_id: input.familyId,
    p_storage_path: input.storagePath,
    p_duration_ms: input.durationMs,
    p_title: input.title ?? null,
    p_prompt: input.prompt ?? null,
  });
  if (error) throw error;
  return {
    voiceStoryId: requireRpcString(data, 'voice_story_id', 'VOICE_STORY_RESULT_INVALID'),
    eventId: rpcString(data, 'event_id'),
  };
}

export async function listFutureLetters(client: AppSupabaseClient, familyId: string): Promise<FutureLetter[]> {
  const { data, error } = await client
    .from('future_letters')
    .select('*')
    .eq('family_id', familyId)
    .order('unlock_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getFutureLetterDraft(client: AppSupabaseClient, letterId: string): Promise<FutureLetterDraft> {
  const [letterResult, contentResult] = await Promise.all([
    client.from('future_letters').select('*').eq('id', letterId).single(),
    client.from('future_letter_contents').select('body').eq('letter_id', letterId).maybeSingle(),
  ]);

  if (letterResult.error) throw letterResult.error;
  if (contentResult.error) throw contentResult.error;
  if (!contentResult.data) throw new Error('FUTURE_LETTER_CONTENT_MISSING');

  return {
    ...letterResult.data,
    body: contentResult.data.body,
  };
}

export async function createFutureLetter(
  client: AppSupabaseClient,
  input: {
    familyId: string;
    recipientUserId: string;
    title: string;
    body: string;
    unlockAt: string;
  },
): Promise<string> {
  const { data, error } = await client.rpc('create_future_letter', {
    p_family_id: input.familyId,
    p_recipient_user_id: input.recipientUserId,
    p_title: input.title,
    p_body: input.body,
    p_unlock_at: input.unlockAt,
  });
  if (error) throw error;
  return requireRpcString(data, 'letter_id', 'FUTURE_LETTER_CREATE_RESULT_INVALID');
}

export async function updateFutureLetterDraft(
  client: AppSupabaseClient,
  input: {
    letterId: string;
    recipientUserId: string;
    title: string;
    body: string;
    unlockAt: string;
  },
): Promise<void> {
  const { error } = await client.rpc('update_future_letter_draft', {
    p_letter_id: input.letterId,
    p_recipient_user_id: input.recipientUserId,
    p_title: input.title,
    p_body: input.body,
    p_unlock_at: input.unlockAt,
  });
  if (error) throw error;
}

export async function sealFutureLetter(client: AppSupabaseClient, letterId: string): Promise<string | null> {
  const { data, error } = await client.rpc('seal_future_letter', { p_letter_id: letterId });
  if (error) throw error;
  return rpcString(data, 'event_id');
}

export async function openFutureLetter(client: AppSupabaseClient, letterId: string): Promise<OpenedFutureLetter> {
  const { data, error } = await client.rpc('open_future_letter', { p_letter_id: letterId });
  if (error) throw error;
  return {
    letterId: requireRpcString(data, 'letter_id', 'FUTURE_LETTER_OPEN_RESULT_INVALID'),
    title: requireRpcString(data, 'title', 'FUTURE_LETTER_OPEN_RESULT_INVALID'),
    body: requireRpcString(data, 'body', 'FUTURE_LETTER_OPEN_RESULT_INVALID'),
    authorUserId: requireRpcString(data, 'author_user_id', 'FUTURE_LETTER_OPEN_RESULT_INVALID'),
    recipientUserId: requireRpcString(data, 'recipient_user_id', 'FUTURE_LETTER_OPEN_RESULT_INVALID'),
    unlockAt: requireRpcString(data, 'unlock_at', 'FUTURE_LETTER_OPEN_RESULT_INVALID'),
    openedAt: requireRpcString(data, 'opened_at', 'FUTURE_LETTER_OPEN_RESULT_INVALID'),
    eventId: rpcString(data, 'event_id'),
  };
}

export async function deleteFutureLetterDraft(client: AppSupabaseClient, letterId: string): Promise<void> {
  const { error } = await client.rpc('delete_future_letter_draft', { p_letter_id: letterId });
  if (error) throw error;
}
