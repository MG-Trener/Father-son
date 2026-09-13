create or replace function private.register_voice_story(
  p_family_id uuid,
  p_storage_path text,
  p_duration_ms integer,
  p_title text default null,
  p_prompt text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_path text := trim(coalesce(p_storage_path, ''));
  v_title text := nullif(left(trim(coalesce(p_title, '')), 120), '');
  v_prompt text := nullif(left(trim(coalesce(p_prompt, '')), 500), '');
  v_expected_prefix text;
  v_story_id uuid;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_family_member(p_family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if p_duration_ms not between 500 and 1200000 then raise exception 'INVALID_DURATION'; end if;

  v_expected_prefix := p_family_id::text || '/' || v_user_id::text || '/';
  if v_path not like v_expected_prefix || '%' then
    raise exception 'INVALID_STORAGE_PATH';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'voice-stories'
      and o.name = v_path
  ) then
    raise exception 'VOICE_OBJECT_NOT_FOUND';
  end if;

  insert into public.voice_stories(family_id, author_user_id, title, prompt, storage_path, duration_ms, status)
  values (p_family_id, v_user_id, v_title, v_prompt, v_path, p_duration_ms, 'ready')
  returning id into v_story_id;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    p_family_id,
    v_user_id,
    'voice_story_added',
    'together',
    jsonb_strip_nulls(jsonb_build_object(
      'voice_story_id', v_story_id,
      'title', v_title,
      'prompt', v_prompt,
      'duration_ms', p_duration_ms
    ))
  )
  returning id into v_event_id;

  return jsonb_build_object('voice_story_id', v_story_id, 'event_id', v_event_id);
end;
$function$;
