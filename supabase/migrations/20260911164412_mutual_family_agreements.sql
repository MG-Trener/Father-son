create table public.family_agreements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note text null,
  created_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint family_agreements_title_check check (char_length(title) between 3 and 140),
  constraint family_agreements_note_check check (note is null or char_length(note) <= 1200)
);

create table public.family_agreement_confirmations (
  agreement_id uuid not null references public.family_agreements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (agreement_id, user_id)
);

create index family_agreements_family_created_idx on public.family_agreements(family_id, created_at desc);
create index family_agreement_confirmations_user_idx on public.family_agreement_confirmations(user_id, confirmed_at desc);

alter table public.family_agreements enable row level security;
alter table public.family_agreement_confirmations enable row level security;

create policy family_agreements_family_select
  on public.family_agreements for select to authenticated
  using (private.is_family_member(family_id));

create policy family_agreement_confirmations_family_select
  on public.family_agreement_confirmations for select to authenticated
  using (
    exists (
      select 1 from public.family_agreements a
      where a.id = family_agreement_confirmations.agreement_id
        and private.is_family_member(a.family_id)
    )
  );

revoke insert, update, delete on public.family_agreements from authenticated;
revoke insert, update, delete on public.family_agreement_confirmations from authenticated;
grant select on public.family_agreements to authenticated;
grant select on public.family_agreement_confirmations to authenticated;

create or replace function private.create_family_agreement(
  p_family_id uuid,
  p_title text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_event uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_family_member(p_family_id) then raise exception 'NOT_FAMILY_MEMBER'; end if;
  if char_length(v_title) < 3 or char_length(v_title) > 140 then raise exception 'INVALID_TITLE'; end if;
  if v_note is not null and char_length(v_note) > 1200 then raise exception 'NOTE_TOO_LONG'; end if;

  insert into public.family_agreements(family_id, created_by, title, note)
  values (p_family_id, v_user, v_title, v_note)
  returning id into v_id;

  insert into public.family_agreement_confirmations(agreement_id, user_id)
  values (v_id, v_user);

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (p_family_id, v_user, 'agreement_proposed', 'together', jsonb_build_object('agreement_id', v_id, 'title', v_title))
  returning id into v_event;

  return jsonb_build_object('agreement_id', v_id, 'event_id', v_event);
end;
$$;

create or replace function private.confirm_family_agreement(p_agreement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid;
  v_title text;
  v_archived timestamptz;
  v_inserted integer := 0;
  v_confirmations integer := 0;
  v_members integer := 0;
  v_active boolean := false;
  v_event uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select family_id, title, archived_at into v_family, v_title, v_archived
  from public.family_agreements where id = p_agreement_id;
  if v_family is null then raise exception 'AGREEMENT_NOT_FOUND'; end if;
  if v_archived is not null then raise exception 'AGREEMENT_ARCHIVED'; end if;
  if not private.is_family_member(v_family) then raise exception 'NOT_FAMILY_MEMBER'; end if;

  insert into public.family_agreement_confirmations(agreement_id, user_id)
  values (p_agreement_id, v_user)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  select count(*) into v_confirmations from public.family_agreement_confirmations where agreement_id = p_agreement_id;
  select count(*) into v_members from public.family_members where family_id = v_family;
  v_active := v_members >= 2 and v_confirmations >= v_members;

  if v_inserted > 0 and v_active then
    insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
    values (v_family, v_user, 'agreement_activated', 'together', jsonb_build_object('agreement_id', p_agreement_id, 'title', v_title))
    returning id into v_event;
  end if;

  return jsonb_build_object('agreement_id', p_agreement_id, 'confirmations', v_confirmations, 'members', v_members, 'active', v_active, 'event_id', v_event);
end;
$$;

create or replace function private.archive_family_agreement(p_agreement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid;
  v_title text;
  v_changed integer := 0;
  v_event uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select family_id, title into v_family, v_title from public.family_agreements where id = p_agreement_id;
  if v_family is null then raise exception 'AGREEMENT_NOT_FOUND'; end if;
  if not private.is_family_member(v_family) then raise exception 'NOT_FAMILY_MEMBER'; end if;

  update public.family_agreements set archived_at = now()
  where id = p_agreement_id and archived_at is null;
  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
    values (v_family, v_user, 'agreement_archived', 'together', jsonb_build_object('agreement_id', p_agreement_id, 'title', v_title))
    returning id into v_event;
  end if;

  return jsonb_build_object('agreement_id', p_agreement_id, 'archived', v_changed > 0, 'event_id', v_event);
end;
$$;

grant execute on function private.create_family_agreement(uuid, text, text) to authenticated;
grant execute on function private.confirm_family_agreement(uuid) to authenticated;
grant execute on function private.archive_family_agreement(uuid) to authenticated;
