-- Client roles must never receive PostgreSQL table privileges that are not
-- required by the Supabase Data API. In particular TRUNCATE bypasses normal
-- row-by-row application semantics and has no place in a mobile client role.

do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
  ) then
    raise exception 'CLIENT_PRIVILEGE_INVARIANT_FAILED: client roles have TRUNCATE/REFERENCES/TRIGGER privileges';
  end if;
end $$;

select 'client_privilege_invariants_ok' as result;
