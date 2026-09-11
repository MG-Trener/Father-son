create table if not exists public.family_rituals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text null check (description is null or char_length(description) <= 500),
  symbol text not null default '✦' check (char_length(symbol) between 1 and 8),
  cadence text not null default 'flexible' check (cadence in ('weekly','monthly','flexible')),
  cadence_value smallint null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_rituals_cadence_value_check check (
    (cadence = 'flexible' and cadence_value is null)
    or (cadence = 'weekly' and cadence_value between 0 and 6)
    or (cadence = 'monthly' and cadence_value between 1 and 31)
  )
);

create table if not exists public.ritual_moments (
  id uuid primary key default gen_random_uuid(),
  ritual_id uuid not null references public.family_rituals(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  happened_on date not null,
  note text null check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);

alter table public.family_rituals enable row level security;
alter table public.ritual_moments enable row level security;

revoke all on table public.family_rituals from anon;
revoke all on table public.ritual_moments from anon;
grant select, insert, update, delete on table public.family_rituals to authenticated;
grant select, insert, delete on table public.ritual_moments to authenticated;

create policy family_rituals_family_select on public.family_rituals
for select to authenticated
using (private.is_family_member(family_id));

create policy family_rituals_creator_insert on public.family_rituals
for insert to authenticated
with check (
  private.is_family_member(family_id)
  and created_by = (select auth.uid())
);

create policy family_rituals_creator_update on public.family_rituals
for update to authenticated
using (
  private.is_family_member(family_id)
  and created_by = (select auth.uid())
)
with check (
  private.is_family_member(family_id)
  and created_by = (select auth.uid())
);

create policy family_rituals_creator_delete on public.family_rituals
for delete to authenticated
using (
  private.is_family_member(family_id)
  and created_by = (select auth.uid())
);

create policy ritual_moments_family_select on public.ritual_moments
for select to authenticated
using (private.is_family_member(family_id));

create policy ritual_moments_self_insert on public.ritual_moments
for insert to authenticated
with check (
  private.is_family_member(family_id)
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.family_rituals fr
    where fr.id = ritual_moments.ritual_id
      and fr.family_id = ritual_moments.family_id
      and fr.active = true
  )
);

create policy ritual_moments_self_delete on public.ritual_moments
for delete to authenticated
using (
  private.is_family_member(family_id)
  and created_by = (select auth.uid())
);

create index if not exists family_rituals_family_active_idx
  on public.family_rituals(family_id, active, created_at desc);
create index if not exists family_rituals_created_by_idx
  on public.family_rituals(created_by);
create index if not exists ritual_moments_ritual_date_idx
  on public.ritual_moments(ritual_id, happened_on desc, created_at desc);
create index if not exists ritual_moments_family_date_idx
  on public.ritual_moments(family_id, happened_on desc);
create index if not exists ritual_moments_created_by_idx
  on public.ritual_moments(created_by);
