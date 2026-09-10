drop policy if exists voice_stories_insert_own on public.voice_stories;
drop policy if exists voice_stories_update_own on public.voice_stories;
drop policy if exists voice_stories_delete_own on public.voice_stories;

revoke insert, update, delete on public.voice_stories from authenticated;
grant select on public.voice_stories to authenticated;
