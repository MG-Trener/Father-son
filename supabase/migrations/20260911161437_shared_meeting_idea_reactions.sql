create table if not exists public.meeting_idea_reactions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.meeting_ideas(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('want','must','maybe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idea_id, user_id)
);

alter table public.meeting_idea_reactions enable row level security;

revoke all on table public.meeting_idea_reactions from anon;
grant select, insert, update, delete on table public.meeting_idea_reactions to authenticated;

drop policy if exists meeting_idea_reactions_family_select on public.meeting_idea_reactions;
create policy meeting_idea_reactions_family_select
on public.meeting_idea_reactions
for select
to authenticated
using (private.is_family_member(family_id));

drop policy if exists meeting_idea_reactions_self_insert on public.meeting_idea_reactions;
create policy meeting_idea_reactions_self_insert
on public.meeting_idea_reactions
for insert
to authenticated
with check (
  private.is_family_member(family_id)
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.meeting_ideas mi
    where mi.id = meeting_idea_reactions.idea_id
      and mi.family_id = meeting_idea_reactions.family_id
  )
);

drop policy if exists meeting_idea_reactions_self_update on public.meeting_idea_reactions;
create policy meeting_idea_reactions_self_update
on public.meeting_idea_reactions
for update
to authenticated
using (
  private.is_family_member(family_id)
  and user_id = (select auth.uid())
)
with check (
  private.is_family_member(family_id)
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.meeting_ideas mi
    where mi.id = meeting_idea_reactions.idea_id
      and mi.family_id = meeting_idea_reactions.family_id
  )
);

drop policy if exists meeting_idea_reactions_self_delete on public.meeting_idea_reactions;
create policy meeting_idea_reactions_self_delete
on public.meeting_idea_reactions
for delete
to authenticated
using (
  private.is_family_member(family_id)
  and user_id = (select auth.uid())
);

create index if not exists meeting_idea_reactions_family_idx
  on public.meeting_idea_reactions(family_id, idea_id);
create index if not exists meeting_idea_reactions_user_idx
  on public.meeting_idea_reactions(user_id, updated_at desc);
