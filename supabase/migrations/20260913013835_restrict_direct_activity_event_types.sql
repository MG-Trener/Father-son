drop policy if exists events_family_insert on public.activity_events;
create policy events_family_insert
on public.activity_events
for insert
to authenticated
with check (
  private.is_family_member(family_id)
  and actor_user_id = (select auth.uid())
  and event_type in (
    'ritual_moment_added',
    'weekly_focus_added',
    'mood_shared',
    'meeting_created',
    'recognition_added'
  )
);
