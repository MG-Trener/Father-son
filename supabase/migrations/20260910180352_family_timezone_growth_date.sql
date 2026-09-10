alter table public.families
  add column if not exists timezone text not null default 'Asia/Almaty';

create or replace function private.create_growth_entry(
  p_family_id uuid,
  p_user_id uuid,
  p_category text,
  p_entry_type text,
  p_activity_date date default current_date,
  p_title text default null,
  p_note text default null,
  p_metrics jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_caller uuid := auth.uid();
  v_entry public.growth_entries;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_entry_type text := btrim(coalesce(p_entry_type, ''));
  v_metrics jsonb := coalesce(p_metrics, '{}'::jsonb);
  v_timezone text;
  v_today date;
begin
  if v_caller is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not private.is_family_member(p_family_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  select f.timezone into v_timezone
  from public.families f
  where f.id = p_family_id;
  v_timezone := coalesce(v_timezone, 'UTC');
  v_today := (now() at time zone v_timezone)::date;

  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = p_user_id
  ) then
    raise exception 'TARGET_NOT_IN_FAMILY';
  end if;
  if p_category not in ('school','football','chess','english','leadership') then
    raise exception 'INVALID_CATEGORY';
  end if;
  if char_length(v_entry_type) not between 1 and 40 then
    raise exception 'INVALID_ENTRY_TYPE';
  end if;
  if p_activity_date is null or p_activity_date > v_today then
    raise exception 'INVALID_ACTIVITY_DATE';
  end if;
  if v_title is not null and char_length(v_title) > 120 then
    raise exception 'TITLE_TOO_LONG';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'NOTE_TOO_LONG';
  end if;
  if jsonb_typeof(v_metrics) <> 'object' or octet_length(v_metrics::text) > 4096 then
    raise exception 'INVALID_METRICS';
  end if;

  insert into public.growth_entries (
    family_id, user_id, category, entry_type, activity_date, title, note, metrics, created_by
  ) values (
    p_family_id, p_user_id, p_category, v_entry_type, p_activity_date, v_title, v_note, v_metrics, v_caller
  ) returning * into v_entry;

  insert into public.activity_events (family_id, actor_user_id, event_type, category, payload)
  values (
    p_family_id,
    v_caller,
    'growth_entry_added',
    p_category,
    jsonb_build_object(
      'growth_entry_id', v_entry.id,
      'target_user_id', p_user_id,
      'entry_type', v_entry_type,
      'title', v_title,
      'activity_date', p_activity_date
    )
  );

  return jsonb_build_object('entry_id', v_entry.id);
end;
$$;
