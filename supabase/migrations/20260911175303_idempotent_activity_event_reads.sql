create or replace function public.mark_activity_events_read(
  p_family_id uuid,
  p_event_ids uuid[]
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count integer := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_family_id is null then raise exception 'FAMILY_REQUIRED'; end if;
  if p_event_ids is null or cardinality(p_event_ids) = 0 then return 0; end if;

  insert into public.activity_event_reads(event_id, family_id, user_id)
  select ae.id, p_family_id, v_user
  from public.activity_events ae
  where ae.family_id = p_family_id
    and ae.id = any(p_event_ids)
  on conflict (event_id, user_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_activity_events_read(uuid, uuid[]) from public;
revoke all on function public.mark_activity_events_read(uuid, uuid[]) from anon;
grant execute on function public.mark_activity_events_read(uuid, uuid[]) to authenticated;
