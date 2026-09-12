-- Recovered RPC layer that existed before the first tracked migration.
-- Apply after 001_core_schema.sql and 002_core_security.sql.

create or replace function private.create_family_team(
  p_display_name text,
  p_family_name text default 'Папа & Я'::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_family_id uuid;
  v_raw_code text;
  v_code_hash text;
  v_display_code text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) not between 1 and 50 then raise exception 'INVALID_DISPLAY_NAME'; end if;
  if exists (select 1 from public.family_members fm where fm.user_id = v_user_id) then raise exception 'ALREADY_IN_FAMILY'; end if;

  insert into public.families(name, created_by)
  values (left(coalesce(nullif(trim(p_family_name), ''), 'Папа & Я'), 80), v_user_id)
  returning id into v_family_id;

  insert into public.family_members(family_id, user_id, role, display_name)
  values (v_family_id, v_user_id, 'parent', left(trim(p_display_name), 50));

  loop
    v_raw_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    v_code_hash := encode(extensions.digest(v_raw_code, 'sha256'), 'hex');
    exit when not exists (select 1 from private.family_invites fi where fi.code_hash = v_code_hash);
  end loop;

  v_display_code := substr(v_raw_code,1,4) || '-' || substr(v_raw_code,5,4) || '-' || substr(v_raw_code,9,4);
  insert into private.family_invites(family_id, created_by, code_hash, role, display_name_hint)
  values (v_family_id, v_user_id, v_code_hash, 'child', 'Артур');

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (v_family_id, v_user_id, 'family_created', 'together', jsonb_build_object('family_name', coalesce(nullif(trim(p_family_name), ''), 'Папа & Я')));

  return jsonb_build_object('family_id', v_family_id, 'invite_code', v_display_code, 'invite_expires_at', now() + interval '7 days');
end;
$function$;

create or replace function private.create_family_invite(
  p_family_id uuid,
  p_display_name_hint text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_raw_code text;
  v_code_hash text;
  v_display_code text;
begin
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
$function$;

create or replace function private.join_family_by_code(
  p_invite_code text,
  p_display_name text,
  p_birth_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_normalized_code text;
  v_code_hash text;
  v_invite private.family_invites%rowtype;
  v_family_name text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) not between 1 and 50 then raise exception 'INVALID_DISPLAY_NAME'; end if;
  if exists (select 1 from public.family_members fm where fm.user_id = v_user_id) then raise exception 'ALREADY_IN_FAMILY'; end if;

  v_normalized_code := regexp_replace(upper(coalesce(p_invite_code, '')), '[^A-F0-9]', '', 'g');
  if char_length(v_normalized_code) <> 12 then raise exception 'INVALID_INVITE_CODE'; end if;
  v_code_hash := encode(extensions.digest(v_normalized_code, 'sha256'), 'hex');

  select * into v_invite
  from private.family_invites fi
  where fi.code_hash = v_code_hash and fi.used_at is null and fi.expires_at > now()
  for update;
  if not found then raise exception 'INVITE_NOT_FOUND_OR_EXPIRED'; end if;
  if (select count(*) from public.family_members fm where fm.family_id = v_invite.family_id) >= 2 then raise exception 'FAMILY_FULL'; end if;

  insert into public.family_members(family_id, user_id, role, display_name, birth_date)
  values (v_invite.family_id, v_user_id, v_invite.role, left(trim(p_display_name), 50), p_birth_date);

  update private.family_invites set used_at = now(), used_by = v_user_id where id = v_invite.id;
  select f.name into v_family_name from public.families f where f.id = v_invite.family_id;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (v_invite.family_id, v_user_id, 'family_joined', 'together', jsonb_build_object('display_name', left(trim(p_display_name), 50)));

  return jsonb_build_object('family_id', v_invite.family_id, 'family_name', v_family_name, 'role', v_invite.role);
end;
$function$;

create or replace function private.create_mission(
  p_family_id uuid,
  p_category text,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_at timestamptz default null,
  p_xp_reward integer default 10,
  p_skill_node_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_assigned_to uuid := p_assigned_to;
  v_mission_id uuid;
  v_due_at timestamptz := coalesce(p_due_at, now() + interval '7 days');
  v_title text := trim(coalesce(p_title, ''));
  v_node_stage integer;
  v_node_type text;
  v_xp_reward integer := 10;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_family_member(p_family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if char_length(v_title) not between 1 and 120 then raise exception 'INVALID_TITLE'; end if;
  if v_due_at < now() then raise exception 'INVALID_DUE_AT'; end if;

  if v_assigned_to is null then
    select fm.user_id into v_assigned_to
    from public.family_members fm
    where fm.family_id = p_family_id and fm.role = 'child'
    order by fm.joined_at
    limit 1;
    v_assigned_to := coalesce(v_assigned_to, v_user_id);
  end if;

  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = v_assigned_to
  ) then raise exception 'ASSIGNEE_NOT_IN_FAMILY'; end if;

  if p_skill_node_id is not null then
    select sn.stage_order, sn.node_type into v_node_stage, v_node_type
    from public.skill_nodes sn
    where sn.id = p_skill_node_id and sn.path_id = p_category and sn.hidden = false;

    if v_node_stage is null then raise exception 'INVALID_SKILL_NODE'; end if;

    v_xp_reward := case v_node_type
      when 'mentor' then 25
      when 'milestone' then 20
      else 10
    end;

    if exists (
      select 1 from public.skill_progress sp
      where sp.family_id = p_family_id
        and sp.user_id = v_assigned_to
        and sp.node_id = p_skill_node_id
        and sp.status = 'completed'
    ) then raise exception 'SKILL_STEP_ALREADY_COMPLETED'; end if;

    if exists (
      select 1
      from public.skill_nodes prev
      where prev.path_id = p_category
        and prev.hidden = false
        and prev.stage_order < v_node_stage
        and not exists (
          select 1 from public.skill_progress sp
          where sp.family_id = p_family_id
            and sp.user_id = v_assigned_to
            and sp.node_id = prev.id
            and sp.status = 'completed'
        )
    ) then raise exception 'PREVIOUS_SKILL_STEP_REQUIRED'; end if;

    if exists (
      select 1 from public.missions m
      where m.family_id = p_family_id
        and m.assigned_to = v_assigned_to
        and m.skill_node_id = p_skill_node_id
        and m.status = 'active'
    ) then raise exception 'ACTIVE_MISSION_ALREADY_EXISTS'; end if;
  end if;

  insert into public.missions(
    family_id, created_by, assigned_to, category, title, description, due_at, status, xp_reward, skill_node_id
  ) values (
    p_family_id, v_user_id, v_assigned_to, p_category, v_title,
    nullif(left(trim(coalesce(p_description, '')), 1000), ''), v_due_at, 'active', v_xp_reward, p_skill_node_id
  ) returning id into v_mission_id;

  if p_skill_node_id is not null then
    insert into public.skill_progress(family_id, user_id, node_id, status, evidence)
    values (p_family_id, v_assigned_to, p_skill_node_id, 'open', jsonb_build_object('mission_id', v_mission_id))
    on conflict (family_id, user_id, node_id) do nothing;
  end if;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    p_family_id, v_user_id, 'mission_created', p_category,
    jsonb_build_object('mission_id', v_mission_id, 'title', v_title, 'assigned_to', v_assigned_to, 'xp_reward', v_xp_reward, 'skill_node_id', p_skill_node_id)
  );

  return jsonb_build_object('mission_id', v_mission_id, 'assigned_to', v_assigned_to, 'due_at', v_due_at, 'xp_reward', v_xp_reward);
end;
$function$;

create or replace function private.complete_mission(p_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_mission public.missions%rowtype;
  v_recipient uuid;
  v_def record;
  v_inserted_definition text;
  v_awarded_titles text[] := array[]::text[];
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_mission
  from public.missions m
  where m.id = p_mission_id
  for update;

  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if not private.is_family_member(v_mission.family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if v_user_id <> v_mission.created_by and (v_mission.assigned_to is null or v_user_id <> v_mission.assigned_to) then
    raise exception 'MISSION_COMPLETION_NOT_ALLOWED';
  end if;

  if v_mission.status = 'completed' then
    return jsonb_build_object(
      'mission_id', v_mission.id,
      'already_completed', true,
      'completed_at', v_mission.completed_at,
      'xp_reward', v_mission.xp_reward,
      'achievement_awarded', false,
      'achievement_titles', '[]'::jsonb
    );
  end if;

  if v_mission.status <> 'active' then raise exception 'MISSION_NOT_ACTIVE'; end if;

  update public.missions
  set status = 'completed', completed_at = now()
  where id = v_mission.id
  returning * into v_mission;

  v_recipient := coalesce(v_mission.assigned_to, v_user_id);

  if v_mission.skill_node_id is not null then
    insert into public.skill_progress(family_id, user_id, node_id, status, opened_at, completed_at, evidence)
    values (
      v_mission.family_id, v_recipient, v_mission.skill_node_id, 'completed', v_mission.created_at, now(),
      jsonb_build_object('mission_id', v_mission.id, 'completed_by', v_user_id)
    )
    on conflict (family_id, user_id, node_id)
    do update set
      status = 'completed',
      completed_at = now(),
      evidence = public.skill_progress.evidence || jsonb_build_object('mission_id', v_mission.id, 'completed_by', v_user_id);
  end if;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    v_mission.family_id, v_user_id, 'mission_completed', v_mission.category,
    jsonb_build_object(
      'mission_id', v_mission.id,
      'title', v_mission.title,
      'assigned_to', v_recipient,
      'xp_reward', v_mission.xp_reward,
      'skill_node_id', v_mission.skill_node_id
    )
  );

  for v_def in
    select ad.id, ad.title
    from public.achievement_definitions ad
    where ad.hidden = false
      and (
        ad.id = v_mission.category || '.first_mission'
        or (
          v_mission.skill_node_id is not null
          and ad.rule->>'type' = 'skill_node'
          and ad.rule->>'node_id' = v_mission.skill_node_id
        )
      )
    order by ad.tier, ad.id
  loop
    v_inserted_definition := null;
    insert into public.achievement_awards(family_id, definition_id, recipient_user_id, awarded_by, evidence)
    values (
      v_mission.family_id, v_def.id, v_recipient, v_user_id,
      jsonb_build_object('mission_id', v_mission.id, 'category', v_mission.category, 'skill_node_id', v_mission.skill_node_id)
    )
    on conflict do nothing
    returning definition_id into v_inserted_definition;

    if v_inserted_definition is not null then
      v_awarded_titles := array_append(v_awarded_titles, v_def.title);
      insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
      values (
        v_mission.family_id, v_user_id, 'achievement_awarded', v_mission.category,
        jsonb_build_object(
          'definition_id', v_def.id,
          'title', v_def.title,
          'recipient_user_id', v_recipient,
          'mission_id', v_mission.id
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'mission_id', v_mission.id,
    'already_completed', false,
    'completed_at', v_mission.completed_at,
    'xp_reward', v_mission.xp_reward,
    'achievement_awarded', cardinality(v_awarded_titles) > 0,
    'achievement_id', null,
    'achievement_title', case when cardinality(v_awarded_titles) > 0 then v_awarded_titles[1] else null end,
    'achievement_titles', to_jsonb(v_awarded_titles)
  );
end;
$function$;

create or replace function public.create_family_team(
  p_display_name text,
  p_family_name text default 'Папа & Я'::text
)
returns jsonb
language sql
set search_path to ''
as $function$ select private.create_family_team(p_display_name, p_family_name); $function$;

create or replace function public.create_family_invite(
  p_family_id uuid,
  p_display_name_hint text default null
)
returns jsonb
language sql
set search_path to ''
as $function$ select private.create_family_invite(p_family_id, p_display_name_hint); $function$;

create or replace function public.join_family_by_code(
  p_invite_code text,
  p_display_name text,
  p_birth_date date default null
)
returns jsonb
language sql
set search_path to ''
as $function$ select private.join_family_by_code(p_invite_code, p_display_name, p_birth_date); $function$;

create or replace function public.create_mission(
  p_family_id uuid,
  p_category text,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_at timestamptz default null,
  p_xp_reward integer default 10,
  p_skill_node_id text default null
)
returns jsonb
language sql
set search_path to ''
as $function$
  select private.create_mission(p_family_id, p_category, p_title, p_description, p_assigned_to, p_due_at, p_xp_reward, p_skill_node_id);
$function$;

create or replace function public.complete_mission(p_mission_id uuid)
returns jsonb
language sql
set search_path to ''
as $function$ select private.complete_mission(p_mission_id); $function$;

revoke all on function private.create_family_team(text, text) from public, anon;
revoke all on function private.create_family_invite(uuid, text) from public, anon;
revoke all on function private.join_family_by_code(text, text, date) from public, anon;
revoke all on function private.create_mission(uuid, text, text, text, uuid, timestamptz, integer, text) from public, anon;
revoke all on function private.complete_mission(uuid) from public, anon;
grant execute on function private.create_family_team(text, text) to authenticated;
grant execute on function private.create_family_invite(uuid, text) to authenticated;
grant execute on function private.join_family_by_code(text, text, date) to authenticated;
grant execute on function private.create_mission(uuid, text, text, text, uuid, timestamptz, integer, text) to authenticated;
grant execute on function private.complete_mission(uuid) to authenticated;

revoke all on function public.create_family_team(text, text) from public, anon;
revoke all on function public.create_family_invite(uuid, text) from public, anon;
revoke all on function public.join_family_by_code(text, text, date) from public, anon;
revoke all on function public.create_mission(uuid, text, text, text, uuid, timestamptz, integer, text) from public, anon;
revoke all on function public.complete_mission(uuid) from public, anon;
grant execute on function public.create_family_team(text, text) to authenticated;
grant execute on function public.create_family_invite(uuid, text) to authenticated;
grant execute on function public.join_family_by_code(text, text, date) to authenticated;
grant execute on function public.create_mission(uuid, text, text, text, uuid, timestamptz, integer, text) to authenticated;
grant execute on function public.complete_mission(uuid) to authenticated;
