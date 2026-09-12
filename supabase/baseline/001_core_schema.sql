-- Recovered core baseline for «Папа & Я».
--
-- This file reconstructs the schema layer that existed before the first tracked
-- migration (20260910153606_together_interactions_rpc.sql). It intentionally
-- lives outside supabase/migrations so it is never pushed onto an existing
-- production database as a new migration.
--
-- Recovery order for a fresh Supabase project:
--   1. 001_core_schema.sql
--   2. 002_core_security.sql
--   3. 003_core_rpcs.sql
--   4. 004_seed_catalog.sql
--   5. tracked migrations from 20260910153606 onward

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Папа & Я',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null constraint family_members_role_check check (role in ('parent','child')),
  display_name text not null,
  birth_date date null,
  joined_at timestamptz not null default now(),
  constraint family_members_pkey primary key (family_id, user_id)
);

create table if not exists public.moods (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text not null constraint moods_mood_check check (mood in ('great','good','ok','tired','sad','angry')),
  note text null constraint moods_note_check check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists public.skill_paths (
  id text primary key,
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_nodes (
  id text primary key,
  path_id text not null references public.skill_paths(id) on delete cascade,
  title text not null,
  description text not null,
  stage_order integer not null,
  recommended_age_from integer null constraint skill_nodes_recommended_age_from_check check (recommended_age_from between 5 and 25),
  recommended_age_to integer null constraint skill_nodes_recommended_age_to_check check (recommended_age_to between 5 and 25),
  node_type text not null default 'growth' constraint skill_nodes_node_type_check check (node_type in ('growth','milestone','reflection','mentor')),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint skill_nodes_path_id_stage_order_title_key unique (path_id, stage_order, title)
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid null references auth.users(id) on delete set null,
  category text not null constraint missions_category_check check (category in ('school','football','chess','english','leadership','together')),
  title text not null constraint missions_title_check check (char_length(title) <= 120),
  description text null constraint missions_description_check check (char_length(description) <= 1000),
  status text not null default 'active' constraint missions_status_check check (status in ('active','completed','skipped','archived')),
  xp_reward integer not null default 5 constraint missions_xp_reward_check check (xp_reward between 0 and 100),
  due_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  skill_node_id text null references public.skill_nodes(id) on delete set null
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type text not null constraint activity_events_event_type_check check (char_length(event_type) <= 80),
  category text null constraint activity_events_category_check check (category in ('school','football','chess','english','leadership','together','system')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  category text null constraint reflections_category_check check (category in ('school','football','chess','english','leadership','together')),
  prompt text null,
  body text not null constraint reflections_body_check check (char_length(body) <= 4000),
  visibility text not null default 'family' constraint reflections_visibility_check check (visibility in ('family','private_until_review')),
  created_at timestamptz not null default now()
);

create table if not exists public.achievement_definitions (
  id text primary key,
  category text not null constraint achievement_definitions_category_check check (category in ('school','football','chess','english','leadership','together')),
  title text not null,
  description text not null,
  tier integer not null default 1 constraint achievement_definitions_tier_check check (tier between 1 and 10),
  hidden boolean not null default false,
  rule_version integer not null default 1,
  rule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.achievement_awards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  recipient_user_id uuid null references auth.users(id) on delete set null,
  definition_id text not null references public.achievement_definitions(id) on delete restrict,
  awarded_by uuid null references auth.users(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  constraint achievement_awards_family_id_recipient_user_id_definition_i_key
    unique (family_id, recipient_user_id, definition_id, awarded_at)
);

create table if not exists public.skill_progress (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id text not null references public.skill_nodes(id) on delete restrict,
  status text not null default 'open' constraint skill_progress_status_check check (status in ('open','in_progress','completed','paused')),
  opened_at timestamptz not null default now(),
  completed_at timestamptz null,
  evidence jsonb not null default '{}'::jsonb,
  constraint skill_progress_family_id_user_id_node_id_key unique (family_id, user_id, node_id)
);

create table if not exists public.recognitions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null constraint recognitions_category_check check (category in ('school','football','chess','english','leadership','together')),
  quality text not null constraint recognitions_quality_check check (char_length(quality) <= 80),
  title text not null constraint recognitions_title_check check (char_length(title) <= 120),
  note text not null constraint recognitions_note_check check (char_length(note) <= 1500),
  related_event_id uuid null references public.activity_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.age_seasons (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  age_year integer not null constraint age_seasons_age_year_check check (age_year between 5 and 25),
  title text not null,
  started_on date not null,
  ended_on date null,
  status text not null default 'active' constraint age_seasons_status_check check (status in ('planned','active','completed')),
  created_at timestamptz not null default now(),
  constraint age_seasons_family_id_subject_user_id_age_year_key unique (family_id, subject_user_id, age_year)
);

create table if not exists public.year_reviews (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references public.age_seasons(id) on delete cascade,
  highlights jsonb not null default '{}'::jsonb,
  generated_summary text null,
  finalized_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint year_reviews_season_id_key unique (season_id)
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  meeting_date date not null,
  title text not null default 'Наша встреча' constraint meetings_title_check check (char_length(title) between 1 and 100),
  note text null,
  status text not null default 'planned' constraint meetings_status_check check (status in ('planned','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_ideas (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null constraint meeting_ideas_title_check check (char_length(title) between 1 and 120),
  reaction text null constraint meeting_ideas_reaction_check check (reaction in ('want','must','maybe') or reaction is null),
  created_at timestamptz not null default now()
);

create table if not exists private.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  role text not null default 'child' constraint family_invites_role_check check (role in ('parent','child')),
  display_name_hint text null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz null,
  used_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint family_invites_check check (expires_at > created_at)
);

create index if not exists idx_families_created_by on public.families(created_by);
create index if not exists idx_family_members_user on public.family_members(user_id);
create unique index if not exists ux_family_members_one_family_per_user on public.family_members(user_id);
create index if not exists idx_moods_family_created on public.moods(family_id, created_at desc);
create index if not exists idx_moods_user_id on public.moods(user_id);
create index if not exists idx_skill_nodes_path on public.skill_nodes(path_id, stage_order);
create index if not exists idx_missions_assigned_to on public.missions(assigned_to);
create index if not exists idx_missions_created_by on public.missions(created_by);
create index if not exists idx_missions_family_status on public.missions(family_id, status, due_at);
create index if not exists idx_missions_skill_node on public.missions(skill_node_id);
create index if not exists missions_assigned_to_status_idx on public.missions(assigned_to, status, created_at desc);
create index if not exists missions_family_status_idx on public.missions(family_id, status, created_at desc);
create unique index if not exists missions_one_active_skill_node_idx
  on public.missions(family_id, assigned_to, skill_node_id)
  where status = 'active' and assigned_to is not null and skill_node_id is not null;
create index if not exists idx_activity_events_actor on public.activity_events(actor_user_id);
create index if not exists idx_events_family_occurred on public.activity_events(family_id, occurred_at desc);
create index if not exists idx_reflections_author on public.reflections(author_user_id);
create index if not exists idx_reflections_family_created on public.reflections(family_id, created_at desc);
create index if not exists idx_awards_awarded_by on public.achievement_awards(awarded_by);
create index if not exists idx_awards_definition on public.achievement_awards(definition_id);
create index if not exists idx_awards_family_awarded on public.achievement_awards(family_id, awarded_at desc);
create index if not exists idx_awards_recipient on public.achievement_awards(recipient_user_id);
create unique index if not exists achievement_awards_once_per_recipient_idx
  on public.achievement_awards(family_id, recipient_user_id, definition_id)
  where recipient_user_id is not null;
create index if not exists idx_skill_progress_family_user on public.skill_progress(family_id, user_id, status);
create index if not exists idx_skill_progress_node on public.skill_progress(node_id);
create index if not exists idx_skill_progress_user on public.skill_progress(user_id);
create index if not exists idx_recognitions_event on public.recognitions(related_event_id);
create index if not exists idx_recognitions_family_created on public.recognitions(family_id, created_at desc);
create index if not exists idx_recognitions_from on public.recognitions(from_user_id);
create index if not exists idx_recognitions_to on public.recognitions(to_user_id);
create index if not exists idx_age_seasons_family on public.age_seasons(family_id, subject_user_id, age_year);
create index if not exists idx_age_seasons_subject on public.age_seasons(subject_user_id);
create index if not exists idx_year_reviews_family on public.year_reviews(family_id, created_at desc);
create index if not exists idx_year_reviews_subject on public.year_reviews(subject_user_id);
create index if not exists idx_meetings_created_by on public.meetings(created_by);
create index if not exists idx_meetings_family_date on public.meetings(family_id, meeting_date) where status = 'planned';
create index if not exists idx_meeting_ideas_created_by on public.meeting_ideas(created_by);
create index if not exists idx_meeting_ideas_family on public.meeting_ideas(family_id);
create index if not exists idx_meeting_ideas_meeting on public.meeting_ideas(meeting_id, created_at);
create index if not exists idx_family_invites_created_by on private.family_invites(created_by);
create index if not exists idx_family_invites_used_by on private.family_invites(used_by);
create index if not exists idx_private_family_invites_expires on private.family_invites(expires_at) where used_at is null;
create index if not exists idx_private_family_invites_family on private.family_invites(family_id);
