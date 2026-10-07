-- Remove authenticated object privileges for operations that have no matching
-- authenticated RLS policy. Those operations were already denied by RLS, so
-- this is defense-in-depth and does not remove a successful client flow.

revoke insert, update, delete on table public.achievement_definitions from authenticated;
revoke update on table public.activity_event_reads from authenticated;
revoke update, delete on table public.activity_events from authenticated;
revoke delete on table public.age_seasons from authenticated;
revoke delete on table public.families from authenticated;
revoke delete on table public.family_members from authenticated;
revoke delete on table public.moods from authenticated;
revoke update, delete on table public.recognitions from authenticated;
revoke delete on table public.reflections from authenticated;
revoke update on table public.ritual_moments from authenticated;
revoke insert, update, delete on table public.skill_nodes from authenticated;
revoke insert, update, delete on table public.skill_paths from authenticated;
revoke delete on table public.year_reviews from authenticated;
