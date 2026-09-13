revoke update on table public.family_members from authenticated;
grant update (display_name, birth_date, onboarding_completed_at)
  on table public.family_members
  to authenticated;
