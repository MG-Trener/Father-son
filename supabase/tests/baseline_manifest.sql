-- Verifies that the recovered baseline objects still exist after all migrations.
-- Assertions only; no data is changed.
do $$
declare
  required_tables text[] := array[
    'public.families',
    'public.family_members',
    'public.moods',
    'public.missions',
    'public.activity_events',
    'public.reflections',
    'public.achievement_definitions',
    'public.achievement_awards',
    'public.skill_paths',
    'public.skill_nodes',
    'public.skill_progress',
    'public.recognitions',
    'public.age_seasons',
    'public.year_reviews',
    'public.meetings',
    'public.meeting_ideas',
    'public.family_rituals',
    'public.ritual_moments',
    'public.voice_stories',
    'public.future_letters',
    'public.future_letter_contents',
    'public.family_agreements',
    'public.family_agreement_confirmations',
    'private.family_invites'
  ];
  object_name text;
begin
  foreach object_name in array required_tables loop
    if to_regclass(object_name) is null then
      raise exception 'BASELINE_MANIFEST_FAILED: missing table %', object_name;
    end if;
  end loop;
end $$;

do $$
declare
  required_indexes text[] := array[
    'public.ux_family_members_one_family_per_user',
    'public.missions_one_active_skill_node_idx',
    'public.achievement_awards_once_per_recipient_idx',
    'public.skill_progress_family_id_user_id_node_id_key',
    'public.ritual_moments_one_per_ritual_day_idx'
  ];
  object_name text;
begin
  foreach object_name in array required_indexes loop
    if to_regclass(object_name) is null then
      raise exception 'BASELINE_MANIFEST_FAILED: missing key index/constraint index %', object_name;
    end if;
  end loop;
end $$;

do $$
begin
  if to_regprocedure('private.is_family_member(uuid)') is null then
    raise exception 'BASELINE_MANIFEST_FAILED: private.is_family_member(uuid) missing';
  end if;
  if to_regprocedure('public.create_family_team(text,text)') is null then
    raise exception 'BASELINE_MANIFEST_FAILED: public.create_family_team(text,text) missing';
  end if;
  if to_regprocedure('public.create_family_invite(uuid,text)') is null then
    raise exception 'BASELINE_MANIFEST_FAILED: public.create_family_invite(uuid,text) missing';
  end if;
  if to_regprocedure('public.join_family_by_code(text,text,date)') is null then
    raise exception 'BASELINE_MANIFEST_FAILED: public.join_family_by_code(text,text,date) missing';
  end if;
  if to_regprocedure('public.create_mission(uuid,text,text,text,uuid,timestamptz,integer,text)') is null then
    raise exception 'BASELINE_MANIFEST_FAILED: public.create_mission(...) missing';
  end if;
  if to_regprocedure('public.complete_mission(uuid)') is null then
    raise exception 'BASELINE_MANIFEST_FAILED: public.complete_mission(uuid) missing';
  end if;
  if to_regprocedure('public.record_ritual_moment(uuid,date)') is null then
    raise exception 'BASELINE_MANIFEST_FAILED: public.record_ritual_moment(uuid,date) missing';
  end if;
  if to_regprocedure('private.record_ritual_moment(uuid,date)') is null then
    raise exception 'BASELINE_MANIFEST_FAILED: private.record_ritual_moment(uuid,date) missing';
  end if;
end $$;

do $$
declare
  path_count integer;
  node_count integer;
  definition_count integer;
begin
  select count(*) into path_count from public.skill_paths;
  select count(*) into node_count from public.skill_nodes;
  select count(*) into definition_count from public.achievement_definitions;

  if path_count <> 6 then
    raise exception 'BASELINE_MANIFEST_FAILED: expected 6 skill paths, found %', path_count;
  end if;
  if node_count <> 44 then
    raise exception 'BASELINE_MANIFEST_FAILED: expected 44 skill nodes, found %', node_count;
  end if;
  if definition_count <> 17 then
    raise exception 'BASELINE_MANIFEST_FAILED: expected 17 achievement definitions, found %', definition_count;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'families'
  ) then
    raise exception 'BASELINE_MANIFEST_FAILED: families missing from supabase_realtime';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'family_members'
  ) then
    raise exception 'BASELINE_MANIFEST_FAILED: family_members missing from supabase_realtime';
  end if;
end $$;

select 'baseline_manifest_ok' as result;