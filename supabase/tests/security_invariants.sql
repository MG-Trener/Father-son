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
