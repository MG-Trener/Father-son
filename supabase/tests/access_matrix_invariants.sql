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

select 'access_matrix_invariants_ok' as result;
