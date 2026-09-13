create unique index if not exists ritual_moments_one_per_ritual_day_idx
  on public.ritual_moments(ritual_id, happened_on);

create or replace function private.record_ritual_moment(
  p_ritual_id uuid,
  p_happened_on date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_user_id uuid := auth.uid();
  v_ritual public.family_rituals%rowtype;
  v_timezone text;
  v_today date;
  v_moment_id uuid;
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_ritual
  from public.family_rituals fr
  where fr.id = p_ritual_id
    and fr.active = true;

  if v_ritual.id is null then
    raise exception 'RITUAL_NOT_FOUND_OR_INACTIVE';
  end if;
  if not private.is_family_member(v_ritual.family_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  select f.timezone into v_timezone
  from public.families f
  where f.id = v_ritual.family_id;
  v_today := (now() at time zone coalesce(v_timezone, 'UTC'))::date;

  if p_happened_on is null or p_happened_on > v_today then
    raise exception 'INVALID_RITUAL_DATE';
  end if;

  insert into public.ritual_moments(ritual_id, family_id, created_by, happened_on)
  values (v_ritual.id, v_ritual.family_id, v_user_id, p_happened_on)
  on conflict (ritual_id, happened_on) do nothing
  returning id into v_moment_id;

  if v_moment_id is null then
    select rm.id into v_moment_id
    from public.ritual_moments rm
    where rm.ritual_id = v_ritual.id
      and rm.happened_on = p_happened_on;

    return jsonb_build_object(
      'moment_id', v_moment_id,
      'already_recorded', true
    );
  end if;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    v_ritual.family_id,
    v_user_id,
    'ritual_moment_added',
    'together',
    jsonb_build_object(
      'ritual_id', v_ritual.id,
      'title', v_ritual.title,
      'symbol', v_ritual.symbol,
      'happened_on', p_happened_on
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'moment_id', v_moment_id,
    'event_id', v_event_id,
    'already_recorded', false
  );
end;
$$;

revoke all on function private.record_ritual_moment(uuid, date) from public, anon;
grant execute on function private.record_ritual_moment(uuid, date) to authenticated;

create or replace function public.record_ritual_moment(
  p_ritual_id uuid,
  p_happened_on date default current_date
)
returns jsonb
language sql
set search_path = 'pg_catalog', 'public', 'private'
as $$
  select private.record_ritual_moment(p_ritual_id, p_happened_on);
$$;

revoke all on function public.record_ritual_moment(uuid, date) from public, anon;
grant execute on function public.record_ritual_moment(uuid, date) to authenticated;
