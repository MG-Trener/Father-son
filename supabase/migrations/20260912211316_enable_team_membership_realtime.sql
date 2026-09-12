do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'families'
  ) then
    alter publication supabase_realtime add table public.families;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_members'
  ) then
    alter publication supabase_realtime add table public.family_members;
  end if;
end $$;
