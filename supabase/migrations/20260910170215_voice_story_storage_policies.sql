create or replace function private.can_access_voice_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.user_id = (select auth.uid())
      and fm.family_id::text = split_part(coalesce(p_name, ''), '/', 1)
  );
$$;

create or replace function private.owns_voice_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.can_access_voice_object(p_name)
    and split_part(coalesce(p_name, ''), '/', 2) = coalesce((select auth.uid())::text, '');
$$;

revoke execute on function private.can_access_voice_object(text) from public;
revoke execute on function private.owns_voice_object(text) from public;
grant execute on function private.can_access_voice_object(text) to authenticated;
grant execute on function private.owns_voice_object(text) to authenticated;

create policy voice_stories_objects_select_family
on storage.objects
for select
to authenticated
using (
  bucket_id = 'voice-stories'
  and private.can_access_voice_object(name)
);

create policy voice_stories_objects_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'voice-stories'
  and private.owns_voice_object(name)
);

create policy voice_stories_objects_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'voice-stories'
  and private.owns_voice_object(name)
)
with check (
  bucket_id = 'voice-stories'
  and private.owns_voice_object(name)
);

create policy voice_stories_objects_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'voice-stories'
  and private.owns_voice_object(name)
);