-- Every direct authenticated table privilege should have a matching RLS policy.
-- Column-level UPDATE grants are intentionally checked by security_invariants.sql.

do $$
begin
  if exists (
    with ops(op) as (
      values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
    ),
    tables as (
      select c.oid, n.nspname as schema_name, c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
    ),
    matrix as (
      select
        t.schema_name,
        t.table_name,
        o.op,
        has_table_privilege('authenticated', t.oid, o.op) as has_privilege,
        exists (
          select 1
          from pg_policies p
          where p.schemaname = t.schema_name
            and p.tablename = t.table_name
            and 'authenticated' = any(p.roles)
            and (p.cmd = o.op or p.cmd = 'ALL')
        ) as has_policy
      from tables t
      cross join ops o
    )
    select 1
    from matrix
    where has_privilege and not has_policy
  ) then
    raise exception 'ACCESS_MATRIX_INVARIANT_FAILED: authenticated table grant exists without matching RLS policy';
  end if;
end $$;

-- Mission state and achievement awards must only be directly readable by clients.
-- Writes go through validated SECURITY DEFINER RPCs in the private schema.
do $$
begin
  if not has_table_privilege('authenticated', 'public.missions', 'SELECT')
     or has_table_privilege('authenticated', 'public.missions', 'INSERT')
     or has_table_privilege('authenticated', 'public.missions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.missions', 'DELETE') then
    raise exception 'ACCESS_MATRIX_INVARIANT_FAILED: missions must be read-only through the Data API';
  end if;

  if not has_table_privilege('authenticated', 'public.achievement_awards', 'SELECT')
     or has_table_privilege('authenticated', 'public.achievement_awards', 'INSERT')
     or has_table_privilege('authenticated', 'public.achievement_awards', 'UPDATE')
     or has_table_privilege('authenticated', 'public.achievement_awards', 'DELETE') then
    raise exception 'ACCESS_MATRIX_INVARIANT_FAILED: achievement_awards must be read-only through the Data API';
  end if;

  if not has_function_privilege('authenticated', 'public.create_mission(uuid,text,text,text,uuid,timestamp with time zone,integer,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.complete_mission(uuid)', 'EXECUTE') then
    raise exception 'ACCESS_MATRIX_INVARIANT_FAILED: mission RPC execution chain is unavailable';
  end if;
end $$;

-- Family/yearbook inserts must preserve the family -> subject -> season graph.
do $$
declare
  age_check text;
  review_check text;
begin
  select with_check into age_check
  from pg_policies
  where schemaname = 'public'
    and tablename = 'age_seasons'
    and policyname = 'age_seasons_family_insert';

  if age_check is null
     or position('family_members' in age_check) = 0
     or position('subject_user_id' in age_check) = 0 then
    raise exception 'ACCESS_MATRIX_INVARIANT_FAILED: age_seasons insert does not validate family membership';
  end if;

  select with_check into review_check
  from pg_policies
  where schemaname = 'public'
    and tablename = 'year_reviews'
    and policyname = 'year_reviews_family_insert';

  if review_check is null
     or position('family_members' in review_check) = 0
     or position('age_seasons' in review_check) = 0
     or position('season_id' in review_check) = 0
     or position('subject_user_id' in review_check) = 0 then
    raise exception 'ACCESS_MATRIX_INVARIANT_FAILED: year_reviews insert does not validate family/subject/season graph';
  end if;
end $$;

select 'access_matrix_invariants_ok' as result;
