-- Additive mobile features. Existing family history and owner session protection stay intact.
create table public.chat_messages (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index chat_family_created on public.chat_messages(family_id, created_at desc, id desc);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;
create policy chat_family_read on public.chat_messages for select to authenticated using (private.is_family_member(family_id));

create function private.send_chat_message(p_family_id uuid,p_id uuid,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_existing public.chat_messages; begin
  if not private.is_family_member(p_family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if char_length(trim(p_body)) not between 1 and 4000 or p_body is null then raise exception 'INVALID_MESSAGE'; end if;
  -- A retry after a lost response must not duplicate either the message or notification.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into v_existing from public.chat_messages where id=p_id;
  if found then
    if v_existing.author_user_id=v_user and v_existing.family_id=p_family_id and v_existing.body=trim(p_body) then return p_id; end if;
    raise exception 'MESSAGE_ID_CONFLICT';
  end if;
  if (select count(*) from public.chat_messages where author_user_id=v_user and created_at>now()-interval '1 minute')>=30 then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  insert into public.chat_messages(id,family_id,author_user_id,body) values(p_id,p_family_id,v_user,trim(p_body));
  insert into public.activity_events(family_id,actor_user_id,event_type,category,payload) values(p_family_id,v_user,'chat_message','together',jsonb_build_object('message_id',p_id));
  return p_id;
end $$;
revoke all on function private.send_chat_message(uuid,uuid,text) from public,anon;
grant execute on function private.send_chat_message(uuid,uuid,text) to authenticated;
create function public.send_chat_message(p_family_id uuid,p_id uuid,p_body text) returns uuid language sql security invoker set search_path='' as $$select private.send_chat_message(p_family_id,p_id,p_body)$$;
revoke all on function public.send_chat_message(uuid,uuid,text) from public,anon;
grant execute on function public.send_chat_message(uuid,uuid,text) to authenticated;

-- One board per family, overwritten on the next game; no winner/loser or score history.
create table public.chess_games (
  family_id uuid primary key references public.families(id) on delete cascade,
  white_user_id uuid not null references auth.users(id),
  black_user_id uuid not null references auth.users(id),
  fen text not null,
  pgn text not null default '',
  turn_user_id uuid not null references auth.users(id),
  version integer not null default 1,
  finished boolean not null default false,
  last_move text,
  updated_at timestamptz not null default now(),
  check (white_user_id<>black_user_id),
  check (turn_user_id in (white_user_id,black_user_id)),
  check (char_length(pgn)<=100000)
);
alter table public.chess_games enable row level security;
revoke all on public.chess_games from anon,authenticated;
grant select on public.chess_games to authenticated;
grant all on public.chess_games to service_role;
grant select on public.family_members to service_role;
grant insert on public.activity_events to service_role;
create policy chess_family_read on public.chess_games for select to authenticated using (private.is_family_member(family_id));

-- Only the authenticated Edge Function may commit a chess.js-validated position.
-- Compare-and-swap prevents concurrent/stale moves; actor identity comes from verified JWT.
create function public.commit_chess_position(p_family_id uuid,p_actor uuid,p_expected integer,p_fen text,p_pgn text,p_turn uuid,p_finished boolean,p_move text,p_notify boolean,p_new boolean default false)
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
  return jsonb_build_object('version',p_expected+1,'event_id',v_event);
end $$;
revoke all on function public.commit_chess_position(uuid,uuid,integer,text,text,uuid,boolean,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.commit_chess_position(uuid,uuid,integer,text,text,uuid,boolean,text,boolean,boolean) to service_role;

-- Private, size-limited avatars. Stable per-user path avoids abandoned old uploads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('family-avatars','family-avatars',false,102400,array['image/jpeg']);
create policy avatar_family_read on storage.objects for select to authenticated using (
  bucket_id='family-avatars' and exists(select 1 from public.family_members m where name=m.family_id::text||'/'||m.user_id::text||'.jpg' and private.is_family_member(m.family_id))
);
create policy avatar_self_insert on storage.objects for insert to authenticated with check (
  bucket_id='family-avatars' and exists(select 1 from public.family_members m where m.user_id=auth.uid() and name=m.family_id::text||'/'||m.user_id::text||'.jpg' and private.is_family_member(m.family_id))
);
create policy avatar_self_update on storage.objects for update to authenticated using (
  bucket_id='family-avatars' and exists(select 1 from public.family_members m where m.user_id=auth.uid() and name=m.family_id::text||'/'||m.user_id::text||'.jpg' and private.is_family_member(m.family_id))
) with check (
  bucket_id='family-avatars' and exists(select 1 from public.family_members m where m.user_id=auth.uid() and name=m.family_id::text||'/'||m.user_id::text||'.jpg' and private.is_family_member(m.family_id))
);

alter publication supabase_realtime add table public.chat_messages,public.chess_games;
