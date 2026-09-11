create table if not exists public.activity_event_reads (
  event_id uuid not null references public.activity_events(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.activity_event_reads enable row level security;

revoke all on table public.activity_event_reads from anon;
grant select, insert, delete on table public.activity_event_reads to authenticated;

create policy activity_event_reads_self_select
  on public.activity_event_reads
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_family_member(family_id)
  );

create policy activity_event_reads_self_insert
  on public.activity_event_reads
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_family_member(family_id)
    and exists (
      select 1
      from public.activity_events ae
      where ae.id = activity_event_reads.event_id
        and ae.family_id = activity_event_reads.family_id
    )
  );

create policy activity_event_reads_self_delete
  on public.activity_event_reads
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_family_member(family_id)
  );

create index if not exists activity_event_reads_user_read_idx
  on public.activity_event_reads(user_id, read_at desc);
create index if not exists activity_event_reads_family_idx
  on public.activity_event_reads(family_id);
