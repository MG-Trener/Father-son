-- Family identity fields are security boundaries and must not be client-editable.
-- Members may only edit profile/onboarding fields on their own row; RLS still
-- enforces which row is eligible for update.

revoke update on table public.family_members from authenticated;
grant update (display_name, birth_date, onboarding_completed_at)
  on table public.family_members
  to authenticated;
