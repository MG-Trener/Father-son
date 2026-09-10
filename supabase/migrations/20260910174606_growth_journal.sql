create table public.growth_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('school','football','chess','english','leadership')),
  entry_type text not null check (char_length(entry_type) between 1 and 40),
  activity_date date not null default current_date,
  title text null check (title is null or char_length(title) <= 120),
  note text null check (note is null or char_length(note) <= 2000),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object' and octet_length(metrics::text) <= 4096),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index growth_entries_family_user_date_idx
  on public.growth_entries (family_id, user_id, activity_date desc, created_at desc);
create index growth_entries_family_category_date_idx
  on public.growth_entries (family_id, category, activity_date desc, created_at desc);

alter table public.growth_entries enable row level security;
revoke all on table public.growth_entries from anon, authenticated;
grant select on table public.growth_entries to authenticated;

create policy "family members read growth journal"
  on public.growth_entries for select
  to authenticated
  using ((select private.is_family_member(family_id)));

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
begin
  if v_caller is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not private.is_family_member(p_family_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;
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
  if p_activity_date is null or p_activity_date > current_date then
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

revoke all on function private.create_growth_entry(uuid,uuid,text,text,date,text,text,jsonb) from public, anon;
grant execute on function private.create_growth_entry(uuid,uuid,text,text,date,text,text,jsonb) to authenticated;

create or replace function public.create_growth_entry(
  p_family_id uuid,
  p_user_id uuid,
  p_category text,
  p_entry_type text,
  p_activity_date date default current_date,
  p_title text default null,
  p_note text default null,
  p_metrics jsonb default '{}'::jsonb
) returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.create_growth_entry(
    p_family_id,
    p_user_id,
    p_category,
    p_entry_type,
    p_activity_date,
    p_title,
    p_note,
    p_metrics
  );
$$;

revoke all on function public.create_growth_entry(uuid,uuid,text,text,date,text,text,jsonb) from public, anon;
grant execute on function public.create_growth_entry(uuid,uuid,text,text,date,text,text,jsonb) to authenticated;
