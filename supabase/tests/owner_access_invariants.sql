-- Read-only regression: execute inside BEGIN READ ONLY ... ROLLBACK.
do $$
declare v_session record; v_owner uuid;
begin
  select user_id into strict v_owner from private.app_owner;
  if exists(select 1 from public.family_members where role='parent' and user_id<>v_owner) then
    raise exception 'UNAUTHORIZED_PARENT';
  end if;
  if has_table_privilege('authenticated','private.app_owner','SELECT')
    or has_table_privilege('authenticated','private.owner_legacy_sessions','INSERT')
    or has_function_privilege('anon','public.get_account_access()','EXECUTE') then
    raise exception 'OWNER_GUARD_PRIVILEGE_LEAK';
  end if;
  for v_session in select a.id,a.user_id from auth.sessions a
    join private.owner_legacy_sessions l on l.session_id=a.id
    where a.not_after is null or a.not_after>now()
  loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_session.user_id,'session_id',v_session.id,'role','authenticated')::text,true);
    if not private.is_app_session_allowed() then raise exception 'LEGACY_OWNER_SESSION_BLOCKED'; end if;
  end loop;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'session_id',gen_random_uuid(),'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','otp')))::text,true);
  if private.is_app_session_allowed() then raise exception 'UNCONFIRMED_OWNER_ALLOWED'; end if;
end $$;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.families) or exists(select 1 from public.family_members) then raise exception 'UNCONFIRMED_OWNER_RLS_LEAK'; end if;
  if not (public.get_account_access()->>'requires_confirmation')::boolean then raise exception 'CONFIRMATION_NOT_REQUIRED'; end if;
  begin
    perform public.create_family_invite('00000000-0000-0000-0000-000000000000',null);
    raise exception 'UNCONFIRMED_INVITE_ALLOWED';
  exception when others then if sqlerrm<>'OWNER_EMAIL_CONFIRMATION_REQUIRED' then raise; end if; end;
  begin
    perform public.open_future_letter('00000000-0000-0000-0000-000000000000');
    raise exception 'UNCONFIRMED_LETTER_ALLOWED';
  exception when others then if sqlerrm<>'OWNER_EMAIL_CONFIRMATION_REQUIRED' then raise; end if; end;
end $$;
reset role;
select 'owner_access_invariants_ok' as result;
