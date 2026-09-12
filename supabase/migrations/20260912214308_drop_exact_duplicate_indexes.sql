-- Remove only indexes that are exact non-unique duplicates of surviving unique indexes.
-- The covering unique indexes continue to support lookups and foreign-key checks.

drop index if exists public.idx_family_members_user;
drop index if exists public.idx_age_seasons_family;
