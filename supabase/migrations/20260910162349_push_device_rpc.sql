create or replace function private.register_push_device(
  p_expo_push_token text,
  p_platform text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_token text := trim(coalesce(p_expo_push_token, ''));
  v_device_id uuid;
  v_existing_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_platform not in ('android', 'ios') then
    raise exception 'INVALID_PLATFORM';
  end if;

  if char_length(v_token) not between 20 and 512 then
    raise exception 'INVALID_PUSH_TOKEN';
  end if;

  select pd.user_id
    into v_existing_user_id
  from public.push_devices pd
  where pd.expo_push_token = v_token
  limit 1;

  if v_existing_user_id is not null and v_existing_user_id <> v_user_id then
    raise exception 'PUSH_TOKEN_ALREADY_REGISTERED';
  end if;

  insert into public.push_devices(
    user_id,
    expo_push_token,
    platform,
    enabled,
    last_seen_at,
    updated_at
  )
  values (
    v_user_id,
    v_token,
    p_platform,
    true,
    now(),
    now()
  )
  on conflict (expo_push_token) do update
  set platform = excluded.platform,
      enabled = true,
      last_seen_at = now(),
      updated_at = now()
  returning id into v_device_id;

  return v_device_id;
end;
$$;

create or replace function private.unregister_push_device(
  p_expo_push_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_deleted boolean := false;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  delete from public.push_devices
  where user_id = v_user_id
    and expo_push_token = trim(coalesce(p_expo_push_token, ''));

  v_deleted := found;
  return v_deleted;
end;
$$;

create or replace function public.register_push_device(
  p_expo_push_token text,
  p_platform text
)
returns uuid
language sql
set search_path = ''
as $$
  select private.register_push_device(p_expo_push_token, p_platform);
$$;

create or replace function public.unregister_push_device(
  p_expo_push_token text
)
returns boolean
language sql
set search_path = ''
as $$
  select private.unregister_push_device(p_expo_push_token);
$$;

revoke all on function public.register_push_device(text, text) from public, anon;
revoke all on function public.unregister_push_device(text) from public, anon;
grant execute on function public.register_push_device(text, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;
