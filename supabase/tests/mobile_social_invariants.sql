-- Read-only regression guard for the shared mobile features.
do $$
begin
  if exists(select 1 from pg_class where oid in ('public.chat_messages'::regclass,'public.chess_games'::regclass) and (
    not relrowsecurity or not has_table_privilege('authenticated',oid,'SELECT')
    or has_table_privilege('authenticated',oid,'INSERT') or has_table_privilege('authenticated',oid,'UPDATE')
    or has_table_privilege('anon',oid,'SELECT'))) then
    raise exception 'MOBILE_SOCIAL_ACCESS_FAILED';
  end if;
  if has_function_privilege('authenticated','public.commit_chess_position(uuid,uuid,integer,text,text,uuid,boolean,text,boolean,boolean)','EXECUTE')
    or has_function_privilege('anon','public.commit_chess_position(uuid,uuid,integer,text,text,uuid,boolean,text,boolean,boolean)','EXECUTE')
    or not has_function_privilege('service_role','public.commit_chess_position(uuid,uuid,integer,text,text,uuid,boolean,text,boolean,boolean)','EXECUTE') then
    raise exception 'CHESS_SERVER_BOUNDARY_FAILED';
  end if;
  if not exists(select 1 from storage.buckets where id='family-avatars' and not public and file_size_limit=102400 and allowed_mime_types=array['image/jpeg']) then
    raise exception 'AVATAR_BUCKET_FAILED';
  end if;
end $$;
select 'mobile_social_invariants_ok' as result;
