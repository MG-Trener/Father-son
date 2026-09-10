create or replace function private.unregister_all_push_devices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  delete from public.push_devices
  where user_id = v_user_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.unregister_all_push_devices()
returns integer
language sql
set search_path = ''
as $$
  select private.unregister_all_push_devices();
$$;

revoke all on function public.unregister_all_push_devices() from public, anon;
grant execute on function public.unregister_all_push_devices() to authenticated;
