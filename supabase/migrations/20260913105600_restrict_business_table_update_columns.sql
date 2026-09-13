revoke update on table public.families from authenticated;
grant update (name, timezone) on table public.families to authenticated;

revoke update on table public.moods from authenticated;
grant update (mood, note) on table public.moods to authenticated;

revoke update on table public.reflections from authenticated;
grant update (category, prompt, body, visibility) on table public.reflections to authenticated;

revoke update on table public.age_seasons from authenticated;
grant update (title, started_on, ended_on, status) on table public.age_seasons to authenticated;

revoke update on table public.year_reviews from authenticated;
grant update (highlights, generated_summary, finalized_at) on table public.year_reviews to authenticated;

revoke update on table public.meetings from authenticated;
grant update (meeting_date, title, note, status, updated_at) on table public.meetings to authenticated;

revoke update on table public.meeting_ideas from authenticated;
grant update (title, reaction) on table public.meeting_ideas to authenticated;

revoke update on table public.family_rituals from authenticated;
grant update (title, description, symbol, cadence, cadence_value, active, updated_at)
  on table public.family_rituals
  to authenticated;

revoke all on table public.push_devices from authenticated;
