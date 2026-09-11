create table if not exists public.future_letters (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  unlock_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','sealed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sealed_at timestamptz,
  opened_at timestamptz,
  constraint future_letters_title_length check (char_length(title) between 1 and 120)
);

create table if not exists public.future_letter_contents (
  letter_id uuid primary key references public.future_letters(id) on delete cascade,
  body text not null,
  updated_at timestamptz not null default now(),
  constraint future_letter_body_length check (char_length(body) between 1 and 8000)
);

create index if not exists future_letters_family_unlock_idx on public.future_letters(family_id, unlock_at desc);
create index if not exists future_letters_recipient_unlock_idx on public.future_letters(recipient_user_id, unlock_at desc);

alter table public.future_letters enable row level security;
alter table public.future_letter_contents enable row level security;

revoke all on public.future_letters from anon, authenticated;
revoke all on public.future_letter_contents from anon, authenticated;
grant select on public.future_letters to authenticated;
grant select on public.future_letter_contents to authenticated;

create policy future_letters_family_select
on public.future_letters
for select
to authenticated
using (private.is_family_member(family_id));

create policy future_letter_contents_unlocked_select
on public.future_letter_contents
for select
to authenticated
using (
  exists (
    select 1
    from public.future_letters fl
    where fl.id = future_letter_contents.letter_id
      and (
        (fl.status = 'draft' and fl.author_user_id = (select auth.uid()))
        or (
          fl.status = 'sealed'
          and fl.unlock_at <= now()
          and (select auth.uid()) in (fl.author_user_id, fl.recipient_user_id)
        )
      )
  )
);

create or replace function private.create_future_letter(
  p_family_id uuid,
  p_recipient_user_id uuid,
  p_title text,
  p_body text,
  p_unlock_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_title text := left(trim(coalesce(p_title, '')), 120);
  v_body text := trim(coalesce(p_body, ''));
  v_letter_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_family_member(p_family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = p_recipient_user_id
  ) then raise exception 'RECIPIENT_NOT_IN_FAMILY'; end if;
  if char_length(v_title) not between 1 and 120 then raise exception 'INVALID_TITLE'; end if;
  if char_length(v_body) not between 1 and 8000 then raise exception 'INVALID_BODY'; end if;
  if p_unlock_at <= now() then raise exception 'UNLOCK_MUST_BE_FUTURE'; end if;

  insert into public.future_letters(family_id, author_user_id, recipient_user_id, title, unlock_at)
  values (p_family_id, v_user_id, p_recipient_user_id, v_title, p_unlock_at)
  returning id into v_letter_id;

  insert into public.future_letter_contents(letter_id, body)
  values (v_letter_id, v_body);

  return jsonb_build_object('letter_id', v_letter_id, 'status', 'draft');
end;
$function$;

create or replace function private.update_future_letter_draft(
  p_letter_id uuid,
  p_title text,
  p_body text,
  p_unlock_at timestamptz,
  p_recipient_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_family_id uuid;
  v_title text := left(trim(coalesce(p_title, '')), 120);
  v_body text := trim(coalesce(p_body, ''));
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select fl.family_id into v_family_id
  from public.future_letters fl
  where fl.id = p_letter_id and fl.author_user_id = v_user_id and fl.status = 'draft';
  if v_family_id is null then raise exception 'LETTER_DRAFT_ACCESS_DENIED'; end if;
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = v_family_id and fm.user_id = p_recipient_user_id
  ) then raise exception 'RECIPIENT_NOT_IN_FAMILY'; end if;
  if char_length(v_title) not between 1 and 120 then raise exception 'INVALID_TITLE'; end if;
  if char_length(v_body) not between 1 and 8000 then raise exception 'INVALID_BODY'; end if;
  if p_unlock_at <= now() then raise exception 'UNLOCK_MUST_BE_FUTURE'; end if;

  update public.future_letters
  set title = v_title,
      recipient_user_id = p_recipient_user_id,
      unlock_at = p_unlock_at,
      updated_at = now()
  where id = p_letter_id;

  update public.future_letter_contents
  set body = v_body, updated_at = now()
  where letter_id = p_letter_id;

  return jsonb_build_object('letter_id', p_letter_id, 'status', 'draft');
end;
$function$;

create or replace function private.seal_future_letter(p_letter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_family_id uuid;
  v_unlock_at timestamptz;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select fl.family_id, fl.unlock_at into v_family_id, v_unlock_at
  from public.future_letters fl
  where fl.id = p_letter_id and fl.author_user_id = v_user_id and fl.status = 'draft'
  for update;
  if v_family_id is null then raise exception 'LETTER_DRAFT_ACCESS_DENIED'; end if;
  if v_unlock_at <= now() then raise exception 'UNLOCK_MUST_BE_FUTURE'; end if;

  update public.future_letters
  set status = 'sealed', sealed_at = now(), updated_at = now()
  where id = p_letter_id;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    v_family_id,
    v_user_id,
    'future_letter_sealed',
    'together',
    jsonb_build_object('letter_id', p_letter_id, 'unlock_at', v_unlock_at)
  )
  returning id into v_event_id;

  return jsonb_build_object('letter_id', p_letter_id, 'status', 'sealed', 'event_id', v_event_id);
end;
$function$;

create or replace function private.delete_future_letter_draft(p_letter_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_deleted uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.future_letters
  where id = p_letter_id and author_user_id = v_user_id and status = 'draft'
  returning id into v_deleted;
  if v_deleted is null then raise exception 'LETTER_DRAFT_ACCESS_DENIED'; end if;
  return true;
end;
$function$;

create or replace function private.open_future_letter(p_letter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_letter public.future_letters%rowtype;
  v_body text;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_letter
  from public.future_letters fl
  where fl.id = p_letter_id
  for update;
  if v_letter.id is null then raise exception 'LETTER_NOT_FOUND'; end if;
  if v_user_id not in (v_letter.author_user_id, v_letter.recipient_user_id) then raise exception 'LETTER_ACCESS_DENIED'; end if;
  if v_letter.status <> 'sealed' or v_letter.unlock_at > now() then raise exception 'LETTER_STILL_SEALED'; end if;

  select flc.body into v_body
  from public.future_letter_contents flc
  where flc.letter_id = p_letter_id;

  if v_letter.opened_at is null then
    update public.future_letters set opened_at = now(), updated_at = now() where id = p_letter_id;
    insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
    values (
      v_letter.family_id,
      v_user_id,
      'future_letter_opened',
      'together',
      jsonb_build_object('letter_id', p_letter_id, 'title', v_letter.title)
    )
    returning id into v_event_id;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'letter_id', v_letter.id,
    'title', v_letter.title,
    'body', v_body,
    'author_user_id', v_letter.author_user_id,
    'recipient_user_id', v_letter.recipient_user_id,
    'unlock_at', v_letter.unlock_at,
    'opened_at', coalesce(v_letter.opened_at, now()),
    'event_id', v_event_id
  ));
end;
$function$;

create or replace function public.create_future_letter(p_family_id uuid, p_recipient_user_id uuid, p_title text, p_body text, p_unlock_at timestamptz)
returns jsonb language sql set search_path to '' as $function$
  select private.create_future_letter(p_family_id, p_recipient_user_id, p_title, p_body, p_unlock_at);
$function$;

create or replace function public.update_future_letter_draft(p_letter_id uuid, p_title text, p_body text, p_unlock_at timestamptz, p_recipient_user_id uuid)
returns jsonb language sql set search_path to '' as $function$
  select private.update_future_letter_draft(p_letter_id, p_title, p_body, p_unlock_at, p_recipient_user_id);
$function$;

create or replace function public.seal_future_letter(p_letter_id uuid)
returns jsonb language sql set search_path to '' as $function$
  select private.seal_future_letter(p_letter_id);
$function$;

create or replace function public.delete_future_letter_draft(p_letter_id uuid)
returns boolean language sql set search_path to '' as $function$
  select private.delete_future_letter_draft(p_letter_id);
$function$;

create or replace function public.open_future_letter(p_letter_id uuid)
returns jsonb language sql set search_path to '' as $function$
  select private.open_future_letter(p_letter_id);
$function$;

revoke all on function private.create_future_letter(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function private.update_future_letter_draft(uuid, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function private.seal_future_letter(uuid) from public, anon, authenticated;
revoke all on function private.delete_future_letter_draft(uuid) from public, anon, authenticated;
revoke all on function private.open_future_letter(uuid) from public, anon, authenticated;

revoke all on function public.create_future_letter(uuid, uuid, text, text, timestamptz) from public, anon;
revoke all on function public.update_future_letter_draft(uuid, text, text, timestamptz, uuid) from public, anon;
revoke all on function public.seal_future_letter(uuid) from public, anon;
revoke all on function public.delete_future_letter_draft(uuid) from public, anon;
revoke all on function public.open_future_letter(uuid) from public, anon;

grant execute on function public.create_future_letter(uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.update_future_letter_draft(uuid, text, text, timestamptz, uuid) to authenticated;
grant execute on function public.seal_future_letter(uuid) to authenticated;
grant execute on function public.delete_future_letter_draft(uuid) to authenticated;
grant execute on function public.open_future_letter(uuid) to authenticated;
