-- Family calendar day is authoritative on the server, independent of phone clocks.
create function private.record_is_from_today(p_created_at timestamptz) returns boolean
language sql volatile set search_path='' as $$
  select (p_created_at at time zone 'Asia/Qyzylorda')::date = (clock_timestamp() at time zone 'Asia/Qyzylorda')::date
$$;
revoke all on function private.record_is_from_today(timestamptz) from public,anon,authenticated;

-- Do not allow changing the original date/author to bypass the editing window.
revoke update,delete on public.reflections from authenticated;
drop policy if exists reflections_update_self on public.reflections;

create function private.edit_reflection(p_id uuid,p_body text,p_expected_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_row public.reflections; begin
  select * into v_row from public.reflections where id=p_id for update;
  if v_row.id is null or v_row.author_user_id is distinct from auth.uid() or not private.is_family_member(v_row.family_id) then raise exception 'EDIT_ACCESS_DENIED'; end if;
  if not private.record_is_from_today(v_row.created_at) then raise exception 'EDIT_WINDOW_CLOSED'; end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 4000 then raise exception 'INVALID_BODY'; end if;
  if v_row.body is distinct from p_expected_body and v_row.body is distinct from trim(p_body) then raise exception 'RECORD_CHANGED'; end if;
  update public.reflections set body=trim(p_body) where id=p_id;
  return p_id;
end $$;
revoke all on function private.edit_reflection(uuid,text,text) from public,anon;
grant execute on function private.edit_reflection(uuid,text,text) to authenticated;
create function public.edit_reflection(p_id uuid,p_body text,p_expected_body text) returns uuid
language sql security invoker set search_path='' as $$ select private.edit_reflection(p_id,p_body,p_expected_body) $$;
revoke all on function public.edit_reflection(uuid,text,text) from public,anon;
grant execute on function public.edit_reflection(uuid,text,text) to authenticated;

create function private.edit_chat_message(p_id uuid,p_body text,p_expected_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_row public.chat_messages; begin
  select * into v_row from public.chat_messages where id=p_id for update;
  if v_row.id is null or v_row.author_user_id is distinct from auth.uid() or not private.is_family_member(v_row.family_id) then raise exception 'EDIT_ACCESS_DENIED'; end if;
  if not private.record_is_from_today(v_row.created_at) then raise exception 'EDIT_WINDOW_CLOSED'; end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 4000 then raise exception 'INVALID_BODY'; end if;
  if v_row.body is distinct from p_expected_body and v_row.body is distinct from trim(p_body) then raise exception 'RECORD_CHANGED'; end if;
  update public.chat_messages set body=trim(p_body) where id=p_id;
  return p_id;
end $$;
revoke all on function private.edit_chat_message(uuid,text,text) from public,anon;
grant execute on function private.edit_chat_message(uuid,text,text) to authenticated;
create function public.edit_chat_message(p_id uuid,p_body text,p_expected_body text) returns uuid
language sql security invoker set search_path='' as $$ select private.edit_chat_message(p_id,p_body,p_expected_body) $$;
revoke all on function public.edit_chat_message(uuid,text,text) from public,anon;
grant execute on function public.edit_chat_message(uuid,text,text) to authenticated;

-- Always upload a new immutable object; swap the reference atomically afterwards.
create function private.replace_voice_story(p_id uuid,p_expected_path text,p_storage_path text,p_duration_ms integer,p_title text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.voice_stories; v_path text:=trim(p_storage_path); begin
  select * into v_row from public.voice_stories where id=p_id for update;
  if v_row.id is null or v_row.author_user_id is distinct from auth.uid() or not private.is_family_member(v_row.family_id) then raise exception 'EDIT_ACCESS_DENIED'; end if;
  if v_row.status<>'ready' or not private.record_is_from_today(v_row.created_at) then raise exception 'EDIT_WINDOW_CLOSED'; end if;
  if p_duration_ms is null or p_duration_ms not between 500 and 1200000 then raise exception 'INVALID_DURATION'; end if;
  if v_path is null or v_path not like v_row.family_id::text||'/'||auth.uid()::text||'/%' then raise exception 'INVALID_STORAGE_PATH'; end if;
  -- A retry after a lost response must not create another entry or lose the audio.
  if v_row.storage_path=v_path then return jsonb_build_object('voice_story_id',p_id); end if;
  if v_row.storage_path is distinct from p_expected_path then raise exception 'RECORD_CHANGED'; end if;
  perform 1 from storage.objects where bucket_id='voice-stories' and name=v_path for update;
  if not found then raise exception 'VOICE_OBJECT_NOT_FOUND'; end if;
  update public.voice_stories set storage_path=v_path,duration_ms=p_duration_ms,title=nullif(left(trim(p_title),120),''),updated_at=clock_timestamp() where id=p_id;
  return jsonb_build_object('voice_story_id',p_id);
end $$;
revoke all on function private.replace_voice_story(uuid,text,text,integer,text) from public,anon;
grant execute on function private.replace_voice_story(uuid,text,text,integer,text) to authenticated;
create function public.replace_voice_story(p_id uuid,p_expected_path text,p_storage_path text,p_duration_ms integer,p_title text) returns jsonb
language sql security invoker set search_path='' as $$ select private.replace_voice_story(p_id,p_expected_path,p_storage_path,p_duration_ms,p_title) $$;
revoke all on function public.replace_voice_story(uuid,text,text,integer,text) from public,anon;
grant execute on function public.replace_voice_story(uuid,text,text,integer,text) to authenticated;

-- Protect even yesterday's audio from replacement/deletion through the Storage API.
drop policy if exists voice_stories_objects_update_own on storage.objects;
drop policy if exists voice_stories_objects_delete_own on storage.objects;
create function private.can_delete_unused_voice(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.owns_voice_object(p_name) and not exists(select 1 from public.voice_stories where storage_path=p_name)
$$;
revoke all on function private.can_delete_unused_voice(text) from public,anon;
grant execute on function private.can_delete_unused_voice(text) to authenticated;
create policy voice_stories_objects_delete_unused on storage.objects for delete to authenticated
using (bucket_id='voice-stories' and private.can_delete_unused_voice(name));

-- Idempotent first save: retry the same uploaded path after connection loss.
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

  perform pg_advisory_xact_lock(hashtextextended(v_path,0));
  select id into v_story_id from public.voice_stories where storage_path=v_path and family_id=p_family_id and author_user_id=v_user_id;
  if found then return jsonb_build_object('voice_story_id',v_story_id); end if;

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

-- Return the committed position in the same transaction, avoiding a second client request.
create or replace function public.commit_chess_position(p_family_id uuid,p_actor uuid,p_expected integer,p_fen text,p_pgn text,p_turn uuid,p_finished boolean,p_move text,p_notify boolean,p_new boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_game public.chess_games; v_other uuid; v_event uuid; begin
  perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,0));
  if not exists(select 1 from public.family_members where family_id=p_family_id and user_id=p_actor) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  select * into v_game from public.chess_games where family_id=p_family_id for update;
  if coalesce(v_game.version,0)<>p_expected then raise exception 'STALE_POSITION'; end if;
  if p_new then
    if v_game.family_id is not null and not v_game.finished then raise exception 'GAME_IN_PROGRESS'; end if;
    select user_id into v_other from public.family_members where family_id=p_family_id and user_id<>p_actor limit 1;
    if v_other is null then raise exception 'PARTNER_REQUIRED'; end if;
    insert into public.chess_games(family_id,white_user_id,black_user_id,fen,pgn,turn_user_id,version,finished,last_move)
    values(p_family_id,p_actor,v_other,p_fen,'',p_actor,p_expected+1,false,null)
    on conflict(family_id) do update set white_user_id=p_actor,black_user_id=v_other,fen=p_fen,pgn='',turn_user_id=p_actor,version=p_expected+1,finished=false,last_move=null,updated_at=now();
  else
    if v_game.family_id is null or v_game.finished then raise exception 'NO_ACTIVE_GAME'; end if;
    if v_game.turn_user_id<>p_actor then raise exception 'NOT_YOUR_TURN'; end if;
    update public.chess_games set fen=p_fen,pgn=p_pgn,turn_user_id=p_turn,finished=p_finished,last_move=p_move,version=version+1,updated_at=now() where family_id=p_family_id;
  end if;
  if p_notify then
    insert into public.activity_events(family_id,actor_user_id,event_type,category,payload) values(p_family_id,p_actor,'chess_move','chess',jsonb_build_object('version',p_expected+1)) returning id into v_event;
  end if;
  select * into v_game from public.chess_games where family_id=p_family_id;
  return jsonb_build_object('version',p_expected+1,'event_id',v_event,'game',to_jsonb(v_game));
end $$;
