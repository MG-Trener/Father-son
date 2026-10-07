-- Data-integrity regression checks.
-- Assertions only; safe to run against production.

do $$
begin
  if has_table_privilege('authenticated', 'public.reflections', 'INSERT') then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: reflections must be RPC-only for inserts';
  end if;
  if not has_function_privilege('authenticated', 'public.create_reflection_entry(uuid,text,text)', 'EXECUTE') then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: create_reflection_entry RPC is unavailable';
  end if;
end $$;

do $$
declare
  create_team_definition text;
  create_invite_definition text;
  join_definition text;
begin
  select pg_get_functiondef('private.create_family_team(text,text)'::regprocedure) into create_team_definition;
  select pg_get_functiondef('private.create_family_invite(uuid,text)'::regprocedure) into create_invite_definition;
  select pg_get_functiondef('private.join_family_by_code(text,text,date)'::regprocedure) into join_definition;

  if create_team_definition is null
     or position('ALREADY_IN_FAMILY' in create_team_definition) = 0
     or position('''parent''' in lower(create_team_definition)) = 0 then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: create_family_team membership rules are incomplete';
  end if;

  if create_invite_definition is null
     or position('PARENT_REQUIRED' in create_invite_definition) = 0
     or position('FAMILY_FULL' in create_invite_definition) = 0
     or position('fm.role = ''parent''' in lower(create_invite_definition)) = 0 then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: create_family_invite parent/capacity rules are incomplete';
  end if;

  if join_definition is null
     or position('ALREADY_IN_FAMILY' in join_definition) = 0
     or position('INVITE_NOT_FOUND_OR_EXPIRED' in join_definition) = 0
     or position('FAMILY_FULL' in join_definition) = 0
     or position('for update' in lower(join_definition)) = 0
     or position('used_at = now()' in lower(join_definition)) = 0 then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: join_family_by_code single-use/capacity rules are incomplete';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'weekly_focuses'
      and indexname = 'weekly_focuses_personal_week_uidx'
      and indexdef ilike 'CREATE UNIQUE INDEX%'
  ) then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: personal weekly-focus uniqueness is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'weekly_focuses'
      and indexname = 'weekly_focuses_together_week_uidx'
      and indexdef ilike 'CREATE UNIQUE INDEX%'
  ) then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: together weekly-focus uniqueness is missing';
  end if;
end $$;

do $$
declare
  guard_definition text;
begin
  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.meeting_idea_reactions'::regclass
      and t.tgname = 'guard_meeting_idea_reaction_identity'
      and not t.tgisinternal
  ) then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: meeting reaction identity trigger is missing';
  end if;

  select pg_get_functiondef(p.oid) into guard_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'guard_meeting_idea_reaction_identity';

  if guard_definition is null
     or position('REACTION_IDENTITY_IMMUTABLE' in guard_definition) = 0
     or position('new.idea_id is distinct from old.idea_id' in lower(guard_definition)) = 0
     or position('new.family_id is distinct from old.family_id' in lower(guard_definition)) = 0
     or position('new.user_id is distinct from old.user_id' in lower(guard_definition)) = 0 then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: meeting reaction identity guard is incomplete';
  end if;

  if has_function_privilege('public', 'private.guard_meeting_idea_reaction_identity()', 'EXECUTE')
     or has_function_privilege('anon', 'private.guard_meeting_idea_reaction_identity()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.guard_meeting_idea_reaction_identity()', 'EXECUTE') then
    raise exception 'DATA_INTEGRITY_INVARIANT_FAILED: trigger helper must not be directly executable by client roles';
  end if;
end $$;

select 'data_integrity_invariants_ok' as result;
