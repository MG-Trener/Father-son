-- Security regression checks for the Father-son Supabase project.
-- Safe to run against development/staging and production: assertions only, no data changes.

do $$
begin
  if has_schema_privilege('anon', 'private', 'USAGE') then
    raise exception 'SECURITY_INVARIANT_FAILED: anon must not have USAGE on private schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  ) then
    raise exception 'SECURITY_INVARIANT_FAILED: public schema must not contain SECURITY DEFINER functions';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and has_function_privilege('public', p.oid, 'EXECUTE')
  ) then
    raise exception 'SECURITY_INVARIANT_FAILED: private functions must not grant EXECUTE to PUBLIC';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ) then
    raise exception 'SECURITY_INVARIANT_FAILED: every public application table must have RLS enabled';
  end if;
end $$;

do $$
declare
  row record;
begin
  for row in
    select c.relname as table_name,
           has_table_privilege('anon', c.oid, 'SELECT') as can_select,
           has_table_privilege('anon', c.oid, 'INSERT') as can_insert,
           has_table_privilege('anon', c.oid, 'UPDATE') as can_update,
           has_table_privilege('anon', c.oid, 'DELETE') as can_delete
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    if row.table_name = 'app_releases' then
      if not row.can_select or row.can_insert or row.can_update or row.can_delete then
        raise exception 'SECURITY_INVARIANT_FAILED: anon may only SELECT app_releases';
      end if;
    elsif row.can_select or row.can_insert or row.can_update or row.can_delete then
      raise exception 'SECURITY_INVARIANT_FAILED: anon has table privileges on %', row.table_name;
    end if;
  end loop;
end $$;

do $$
begin
  if has_column_privilege('authenticated', 'public.family_members', 'family_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.family_members', 'user_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.family_members', 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.family_members', 'joined_at', 'UPDATE') then
    raise exception 'SECURITY_INVARIANT_FAILED: family membership identity/role columns must be immutable to authenticated clients';
  end if;

  if not has_column_privilege('authenticated', 'public.family_members', 'display_name', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.family_members', 'birth_date', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.family_members', 'onboarding_completed_at', 'UPDATE') then
    raise exception 'SECURITY_INVARIANT_FAILED: expected family member profile columns are not updateable';
  end if;
end $$;

do $$
begin
  if exists (
    with public_functions as (
      select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and not p.prosecdef
    ),
    private_functions as (
      select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private'
        and p.prosecdef
    )
    select 1
    from public_functions pub
    join private_functions priv
      on priv.proname = pub.proname
     and priv.args = pub.args
    where not has_function_privilege('authenticated', pub.oid, 'EXECUTE')
       or not has_function_privilege('authenticated', priv.oid, 'EXECUTE')
  ) then
    raise exception 'SECURITY_INVARIANT_FAILED: authenticated wrapper/private RPC execute chain is broken';
  end if;
end $$;

select 'security_invariants_ok' as result;
