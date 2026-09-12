-- Recovered RLS/security layer for the core schema.
-- Apply after 001_core_schema.sql on a fresh Supabase project.

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.family_members fm
      where fm.family_id = target_family_id
        and fm.user_id = (select auth.uid())
    );
$function$;

revoke all on function private.is_family_member(uuid) from public, anon;
grant execute on function private.is_family_member(uuid) to authenticated;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.moods enable row level security;
alter table public.missions enable row level security;
alter table public.activity_events enable row level security;
alter table public.reflections enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.achievement_awards enable row level security;
alter table public.skill_paths enable row level security;
alter table public.skill_nodes enable row level security;
alter table public.skill_progress enable row level security;
alter table public.recognitions enable row level security;
alter table public.age_seasons enable row level security;
alter table public.year_reviews enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_ideas enable row level security;
alter table private.family_invites enable row level security;

revoke all on table public.families from anon;
revoke all on table public.family_members from anon;
revoke all on table public.moods from anon;
revoke all on table public.missions from anon;
revoke all on table public.activity_events from anon;
revoke all on table public.reflections from anon;
revoke all on table public.achievement_definitions from anon;
revoke all on table public.achievement_awards from anon;
revoke all on table public.skill_paths from anon;
revoke all on table public.skill_nodes from anon;
revoke all on table public.skill_progress from anon;
revoke all on table public.recognitions from anon;
revoke all on table public.age_seasons from anon;
revoke all on table public.year_reviews from anon;
revoke all on table public.meetings from anon;
revoke all on table public.meeting_ideas from anon;
revoke all on table private.family_invites from public, anon, authenticated;

-- Object privileges are intentionally broad for authenticated users; RLS below
-- is the authoritative row-level boundary and denies operations without a policy.
grant select, insert, update, delete on table public.families to authenticated;
grant select, insert, update, delete on table public.family_members to authenticated;
grant select, insert, update, delete on table public.moods to authenticated;
grant select, insert, update, delete on table public.missions to authenticated;
grant select, insert, update, delete on table public.activity_events to authenticated;
grant select, insert, update, delete on table public.reflections to authenticated;
grant select on table public.achievement_definitions to authenticated;
grant select, insert on table public.achievement_awards to authenticated;
grant select on table public.skill_paths to authenticated;
grant select on table public.skill_nodes to authenticated;
grant select, insert, update on table public.skill_progress to authenticated;
grant select, insert on table public.recognitions to authenticated;
grant select, insert, update on table public.age_seasons to authenticated;
grant select, insert, update on table public.year_reviews to authenticated;
grant select, insert, update, delete on table public.meetings to authenticated;
grant select, insert, update, delete on table public.meeting_ideas to authenticated;

-- Families.
drop policy if exists families_insert_creator on public.families;
create policy families_insert_creator on public.families
for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists families_select_member on public.families;
create policy families_select_member on public.families
for select to authenticated
using (private.is_family_member(id) or created_by = (select auth.uid()));

drop policy if exists families_update_creator on public.families;
create policy families_update_creator on public.families
for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

-- Members.
drop policy if exists members_insert_self_creator on public.family_members;
create policy members_insert_self_creator on public.family_members
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.families f
    where f.id = family_members.family_id
      and f.created_by = (select auth.uid())
  )
);

drop policy if exists members_select_family on public.family_members;
create policy members_select_family on public.family_members
for select to authenticated
using (private.is_family_member(family_id) or user_id = (select auth.uid()));

drop policy if exists members_update_self on public.family_members;
create policy members_update_self on public.family_members
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Mood/check-ins.
drop policy if exists moods_family_all on public.moods;
create policy moods_family_all on public.moods
for select to authenticated
using (private.is_family_member(family_id));

drop policy if exists moods_insert_self on public.moods;
create policy moods_insert_self on public.moods
for insert to authenticated
with check (private.is_family_member(family_id) and user_id = (select auth.uid()));

drop policy if exists moods_update_self on public.moods;
create policy moods_update_self on public.moods
for update to authenticated
using (private.is_family_member(family_id) and user_id = (select auth.uid()))
with check (private.is_family_member(family_id) and user_id = (select auth.uid()));

-- Missions.
drop policy if exists missions_family_select on public.missions;
create policy missions_family_select on public.missions
for select to authenticated
using (private.is_family_member(family_id));

drop policy if exists missions_family_insert on public.missions;
create policy missions_family_insert on public.missions
for insert to authenticated
with check (private.is_family_member(family_id) and created_by = (select auth.uid()));

drop policy if exists missions_family_update on public.missions;
create policy missions_family_update on public.missions
for update to authenticated
using (private.is_family_member(family_id))
with check (private.is_family_member(family_id));

-- Event timeline.
drop policy if exists events_family_select on public.activity_events;
create policy events_family_select on public.activity_events
for select to authenticated
using (private.is_family_member(family_id));

drop policy if exists events_family_insert on public.activity_events;
create policy events_family_insert on public.activity_events
for insert to authenticated
with check (
  private.is_family_member(family_id)
  and (actor_user_id is null or actor_user_id = (select auth.uid()))
);

-- Reflections.
drop policy if exists reflections_family_select on public.reflections;
create policy reflections_family_select on public.reflections
for select to authenticated
using (
  private.is_family_member(family_id)
  and (visibility = 'family' or author_user_id = (select auth.uid()))
);

drop policy if exists reflections_insert_self on public.reflections;
create policy reflections_insert_self on public.reflections
for insert to authenticated
with check (private.is_family_member(family_id) and author_user_id = (select auth.uid()));

drop policy if exists reflections_update_self on public.reflections;
create policy reflections_update_self on public.reflections
for update to authenticated
using (author_user_id = (select auth.uid()))
with check (author_user_id = (select auth.uid()) and private.is_family_member(family_id));

-- Read-only catalogs.
drop policy if exists achievement_definitions_read on public.achievement_definitions;
create policy achievement_definitions_read on public.achievement_definitions
for select to authenticated using (true);

drop policy if exists skill_paths_read on public.skill_paths;
create policy skill_paths_read on public.skill_paths
for select to authenticated using (true);

drop policy if exists skill_nodes_read on public.skill_nodes;
create policy skill_nodes_read on public.skill_nodes
for select to authenticated using (true);

-- Awards/progress.
drop policy if exists achievement_awards_family_select on public.achievement_awards;
create policy achievement_awards_family_select on public.achievement_awards
for select to authenticated
using (private.is_family_member(family_id));

drop policy if exists achievement_awards_family_insert on public.achievement_awards;
create policy achievement_awards_family_insert on public.achievement_awards
for insert to authenticated
with check (
  private.is_family_member(family_id)
  and (awarded_by is null or awarded_by = (select auth.uid()))
);

drop policy if exists skill_progress_family_select on public.skill_progress;
create policy skill_progress_family_select on public.skill_progress
for select to authenticated
using (private.is_family_member(family_id));

drop policy if exists skill_progress_family_insert on public.skill_progress;
create policy skill_progress_family_insert on public.skill_progress
for insert to authenticated
with check (private.is_family_member(family_id) and user_id = (select auth.uid()));

drop policy if exists skill_progress_family_update on public.skill_progress;
create policy skill_progress_family_update on public.skill_progress
for update to authenticated
using (private.is_family_member(family_id) and user_id = (select auth.uid()))
with check (private.is_family_member(family_id) and user_id = (select auth.uid()));

-- Recognition.
drop policy if exists recognitions_family_select on public.recognitions;
create policy recognitions_family_select on public.recognitions
for select to authenticated
using (private.is_family_member(family_id));

drop policy if exists recognitions_insert_author on public.recognitions;
create policy recognitions_insert_author on public.recognitions
for insert to authenticated
with check (
  private.is_family_member(family_id)
  and from_user_id = (select auth.uid())
  and to_user_id <> from_user_id
  and exists (
    select 1 from public.family_members fm
    where fm.family_id = recognitions.family_id
      and fm.user_id = recognitions.to_user_id
  )
);

-- Age/year book.
drop policy if exists age_seasons_family_select on public.age_seasons;
create policy age_seasons_family_select on public.age_seasons
for select to authenticated using (private.is_family_member(family_id));
drop policy if exists age_seasons_family_insert on public.age_seasons;
create policy age_seasons_family_insert on public.age_seasons
for insert to authenticated with check (private.is_family_member(family_id));
drop policy if exists age_seasons_family_update on public.age_seasons;
create policy age_seasons_family_update on public.age_seasons
for update to authenticated using (private.is_family_member(family_id))
with check (private.is_family_member(family_id));

drop policy if exists year_reviews_family_select on public.year_reviews;
create policy year_reviews_family_select on public.year_reviews
for select to authenticated using (private.is_family_member(family_id));
drop policy if exists year_reviews_family_insert on public.year_reviews;
create policy year_reviews_family_insert on public.year_reviews
for insert to authenticated with check (private.is_family_member(family_id));
drop policy if exists year_reviews_family_update on public.year_reviews;
create policy year_reviews_family_update on public.year_reviews
for update to authenticated using (private.is_family_member(family_id))
with check (private.is_family_member(family_id));

-- Meetings.
drop policy if exists meetings_family_select on public.meetings;
create policy meetings_family_select on public.meetings
for select to authenticated using (private.is_family_member(family_id));
drop policy if exists meetings_family_insert on public.meetings;
create policy meetings_family_insert on public.meetings
for insert to authenticated
with check (private.is_family_member(family_id) and created_by = (select auth.uid()));
drop policy if exists meetings_family_update on public.meetings;
create policy meetings_family_update on public.meetings
for update to authenticated using (private.is_family_member(family_id))
with check (private.is_family_member(family_id));
drop policy if exists meetings_creator_delete on public.meetings;
create policy meetings_creator_delete on public.meetings
for delete to authenticated
using (private.is_family_member(family_id) and created_by = (select auth.uid()));

drop policy if exists meeting_ideas_family_select on public.meeting_ideas;
create policy meeting_ideas_family_select on public.meeting_ideas
for select to authenticated using (private.is_family_member(family_id));
drop policy if exists meeting_ideas_family_insert on public.meeting_ideas;
create policy meeting_ideas_family_insert on public.meeting_ideas
for insert to authenticated
with check (
  private.is_family_member(family_id)
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.meetings m
    where m.id = meeting_ideas.meeting_id
      and m.family_id = meeting_ideas.family_id
  )
);
drop policy if exists meeting_ideas_family_update on public.meeting_ideas;
create policy meeting_ideas_family_update on public.meeting_ideas
for update to authenticated
using (private.is_family_member(family_id) and created_by = (select auth.uid()))
with check (private.is_family_member(family_id) and created_by = (select auth.uid()));
drop policy if exists meeting_ideas_creator_delete on public.meeting_ideas;
create policy meeting_ideas_creator_delete on public.meeting_ideas
for delete to authenticated
using (private.is_family_member(family_id) and created_by = (select auth.uid()));

-- Invitations are RPC-only. No authenticated client receives direct table access.
drop policy if exists family_invites_deny_direct on private.family_invites;
create policy family_invites_deny_direct on private.family_invites
for all to authenticated using (false) with check (false);
