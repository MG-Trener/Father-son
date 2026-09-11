alter table public.family_members
  add column if not exists onboarding_completed_at timestamptz null;
