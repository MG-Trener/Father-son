-- This deployment is a private, single-family app. Bootstrap only from an
-- unambiguous existing parent; never infer ownership from client metadata.
create table private.app_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  email text not null,
  created_at timestamptz not null default now()
);
alter table private.app_owner enable row level security;
revoke all on private.app_owner from public, anon, authenticated;

do $$
begin
  if (select count(*) from public.family_members where role = 'parent') <> 1 then
    raise exception 'OWNER_BOOTSTRAP_REQUIRES_ONE_PARENT';
  end if;
  insert into private.app_owner(user_id, email)
    select fm.user_id, lower(u.email) from public.family_members fm
    join auth.users u on u.id = fm.user_id where fm.role = 'parent';
end $$;

-- Preserve existing installations only. New password sessions cannot add rows.
create table private.owner_legacy_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table private.owner_legacy_sessions enable row level security;
revoke all on private.owner_legacy_sessions from public, anon, authenticated;
insert into private.owner_legacy_sessions(session_id,user_id)
  select s.id,s.user_id from auth.sessions s join private.app_owner o on o.user_id=s.user_id;

create function private.is_app_session_allowed()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users u where u.id=(select auth.uid())
    and (
      not exists (select 1 from private.app_owner o where o.user_id=u.id)
      or exists (
        select 1 from private.app_owner o
        join auth.sessions s on s.user_id=o.user_id
        where o.user_id=u.id and lower(u.email)=o.email
          and s.id::text=(select auth.jwt()->>'session_id')
          and (s.not_after is null or s.not_after > now())
          and (
            exists (select 1 from private.owner_legacy_sessions l where l.session_id=s.id and l.user_id=u.id)
            or (
              -- GoTrue records email magic links as otp. This app has no phone
              -- auth; reject OTP approval if a phone identity has been attached.
              coalesce(u.phone,'')=''
              and exists (select 1 from auth.mfa_amr_claims a where a.session_id=s.id and a.authentication_method='otp')
            )
          )
      )
    )
  );
$$;
revoke all on function private.is_app_session_allowed() from public,anon;
grant execute on function private.is_app_session_allowed() to authenticated;

create or replace function private.is_family_member(target_family_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_app_session_allowed() and exists (
    select 1 from public.family_members fm
    where fm.family_id=target_family_id and fm.user_id=(select auth.uid())
  );
$$;

-- Only the owner/session-sensitive shortcuts need additional policies.
create policy owner_session_gate on public.families as restrictive for all to authenticated
using ((select private.is_app_session_allowed())) with check ((select private.is_app_session_allowed()));
create policy owner_session_gate on public.family_members as restrictive for all to authenticated
using ((select private.is_app_session_allowed())) with check ((select private.is_app_session_allowed()));
create policy owner_session_gate on public.push_devices as restrictive for all to authenticated
using ((select private.is_app_session_allowed())) with check ((select private.is_app_session_allowed()));

-- The existing owner already has a family. No additional parent or family can
-- be created through old APKs, new accounts, direct writes, or concurrent RPCs.
create or replace function private.create_family_team(p_display_name text, p_family_name text default 'Папа & Я')
returns jsonb language plpgsql security definer set search_path = ''
as $$ begin
  if not exists(select 1 from private.app_owner where user_id=(select auth.uid())) then
    raise exception 'OWNER_ACCOUNT_REQUIRED';
  end if;
  if not private.is_app_session_allowed() then raise exception 'OWNER_EMAIL_CONFIRMATION_REQUIRED'; end if;
  raise exception 'ALREADY_IN_FAMILY';
end $$;

create function private.guard_owner_role()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  if new.role='parent' and not exists(select 1 from private.app_owner where user_id=new.user_id) then
    raise exception 'OWNER_ACCOUNT_REQUIRED';
  end if;
  if exists(select 1 from private.app_owner where user_id=new.user_id) and new.role <> 'parent' then
    raise exception 'OWNER_ROLE_IMMUTABLE';
  end if;
  return new;
end $$;
revoke all on function private.guard_owner_role() from public,anon,authenticated;
create trigger guard_owner_role before insert or update of role,user_id on public.family_members
for each row execute function private.guard_owner_role();
create unique index one_parent_per_family on public.family_members(family_id) where role='parent';
create unique index one_child_per_family on public.family_members(family_id) where role='child';
create unique index one_family_per_account on public.family_members(user_id);

create function private.get_account_access()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ declare v_owner boolean; begin
  if not exists(select 1 from auth.users where id=(select auth.uid())) then raise exception 'AUTH_REQUIRED'; end if;
  v_owner := exists(select 1 from private.app_owner where user_id=(select auth.uid()));
  return jsonb_build_object('is_owner',v_owner,'requires_confirmation',v_owner and not private.is_app_session_allowed(),'owner_exists',true);
end $$;
revoke all on function private.get_account_access() from public,anon;
grant execute on function private.get_account_access() to authenticated;
create function public.get_account_access()
returns jsonb language sql stable set search_path = ''
as $$ select private.get_account_access(); $$;
revoke all on function public.get_account_access() from public,anon;
grant execute on function public.get_account_access() to authenticated;


-- Preserve the existing function body; require confirmed owner access first.
CREATE OR REPLACE FUNCTION private.can_access_voice_object(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.is_app_session_allowed() and exists (
    select 1
    from public.family_members fm
    where fm.user_id = (select auth.uid())
      and fm.family_id::text = split_part(coalesce(p_name, ''), '/', 1)
  );
$function$
;

-- Preserve the existing function body; require confirmed owner access first.
CREATE OR REPLACE FUNCTION private.create_family_invite(p_family_id uuid, p_display_name_hint text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_raw_code text;
  v_code_hash text;
  v_display_code text;
begin
  if not private.is_app_session_allowed() then raise exception 'OWNER_EMAIL_CONFIRMATION_REQUIRED'; end if;
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = v_user_id and fm.role = 'parent'
  ) then raise exception 'PARENT_REQUIRED'; end if;
  if (select count(*) from public.family_members fm where fm.family_id = p_family_id) >= 2 then raise exception 'FAMILY_FULL'; end if;

  update private.family_invites
  set expires_at = now()
  where family_id = p_family_id and used_at is null and expires_at > now();

  loop
    v_raw_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    v_code_hash := encode(extensions.digest(v_raw_code, 'sha256'), 'hex');
    exit when not exists (select 1 from private.family_invites fi where fi.code_hash = v_code_hash);
  end loop;

  v_display_code := substr(v_raw_code,1,4) || '-' || substr(v_raw_code,5,4) || '-' || substr(v_raw_code,9,4);
  insert into private.family_invites(family_id, created_by, code_hash, role, display_name_hint)
  values (p_family_id, v_user_id, v_code_hash, 'child', nullif(left(trim(coalesce(p_display_name_hint,'')),50),''));

  return jsonb_build_object('family_id', p_family_id, 'invite_code', v_display_code, 'invite_expires_at', now() + interval '7 days');
end;
$function$
;

-- Preserve the existing function body; require confirmed owner access first.
CREATE OR REPLACE FUNCTION private.delete_future_letter_draft(p_letter_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_deleted uuid;
begin
  if not private.is_app_session_allowed() then raise exception 'OWNER_EMAIL_CONFIRMATION_REQUIRED'; end if;
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.future_letters
  where id = p_letter_id and author_user_id = v_user_id and status = 'draft'
  returning id into v_deleted;
  if v_deleted is null then raise exception 'LETTER_DRAFT_ACCESS_DENIED'; end if;
  return true;
end;
$function$
;

-- Preserve the existing function body; require confirmed owner access first.
CREATE OR REPLACE FUNCTION private.open_future_letter(p_letter_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_letter public.future_letters%rowtype;
  v_body text;
  v_event_id uuid;
begin
  if not private.is_app_session_allowed() then raise exception 'OWNER_EMAIL_CONFIRMATION_REQUIRED'; end if;
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
$function$
;

-- Preserve the existing function body; require confirmed owner access first.
CREATE OR REPLACE FUNCTION private.register_push_device(p_expo_push_token text, p_platform text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_token text := trim(coalesce(p_expo_push_token, ''));
  v_device_id uuid;
  v_existing_user_id uuid;
begin
  if not private.is_app_session_allowed() then raise exception 'OWNER_EMAIL_CONFIRMATION_REQUIRED'; end if;
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_platform not in ('android', 'ios') then raise exception 'INVALID_PLATFORM'; end if;
  if char_length(v_token) not between 20 and 512 then raise exception 'INVALID_PUSH_TOKEN'; end if;

  select pd.user_id into v_existing_user_id
  from public.push_devices pd
  where pd.expo_push_token = v_token
  limit 1;

  if v_existing_user_id is not null and v_existing_user_id <> v_user_id then
    raise exception 'PUSH_TOKEN_ALREADY_REGISTERED';
  end if;

  insert into public.push_devices(
    user_id, expo_push_token, platform, enabled, last_seen_at, updated_at
  )
  values (
    v_user_id, v_token, p_platform, true, now(), now()
  )
  on conflict (expo_push_token) do update
  set platform = excluded.platform,
      enabled = true,
      last_seen_at = now(),
      updated_at = now()
  returning id into v_device_id;

  return v_device_id;
end;
$function$
;

-- Preserve the existing function body; require confirmed owner access first.
CREATE OR REPLACE FUNCTION private.seal_future_letter(p_letter_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_family_id uuid;
  v_unlock_at timestamptz;
  v_event_id uuid;
begin
  if not private.is_app_session_allowed() then raise exception 'OWNER_EMAIL_CONFIRMATION_REQUIRED'; end if;
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
$function$
;

-- Preserve the existing function body; require confirmed owner access first.
CREATE OR REPLACE FUNCTION private.update_future_letter_draft(p_letter_id uuid, p_title text, p_body text, p_unlock_at timestamp with time zone, p_recipient_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_family_id uuid;
  v_title text := left(trim(coalesce(p_title, '')), 120);
  v_body text := trim(coalesce(p_body, ''));
begin
  if not private.is_app_session_allowed() then raise exception 'OWNER_EMAIL_CONFIRMATION_REQUIRED'; end if;
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
$function$
;
