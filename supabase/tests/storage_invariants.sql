-- Storage regression checks for private APK and voice-story buckets.
-- Assertions only; safe to run against production.

do $$
declare
  voice_public boolean;
  voice_limit bigint;
  voice_mimes text[];
  release_public boolean;
begin
  select public, file_size_limit, allowed_mime_types
    into voice_public, voice_limit, voice_mimes
  from storage.buckets
  where id = 'voice-stories';

  if voice_public is null then
    raise exception 'STORAGE_INVARIANT_FAILED: voice-stories bucket is missing';
  end if;
  if voice_public then
    raise exception 'STORAGE_INVARIANT_FAILED: voice-stories bucket must be private';
  end if;
  if voice_limit is null or voice_limit > 26214400 then
    raise exception 'STORAGE_INVARIANT_FAILED: voice-stories file-size limit is missing or too large';
  end if;
  if voice_mimes is null
     or not ('audio/mp4' = any(voice_mimes))
     or not ('audio/m4a' = any(voice_mimes)) then
    raise exception 'STORAGE_INVARIANT_FAILED: voice-stories MIME allowlist is incomplete';
  end if;

  select public into release_public
  from storage.buckets
  where id = 'app-releases';
  if release_public is null then
    raise exception 'STORAGE_INVARIANT_FAILED: app-releases bucket is missing';
  end if;
  if release_public then
    raise exception 'STORAGE_INVARIANT_FAILED: app-releases bucket must remain private';
  end if;
end $$;

do $$
declare
  insert_check text;
  select_check text;
  update_using text;
  update_check text;
  delete_using text;
begin
  select with_check into insert_check
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'voice_stories_objects_insert_own';

  select qual into select_check
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'voice_stories_objects_select_family';

  select qual, with_check into update_using, update_check
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'voice_stories_objects_update_own';

  select qual into delete_using
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'voice_stories_objects_delete_unused';

  if insert_check is null or position('owns_voice_object' in insert_check) = 0 then
    raise exception 'STORAGE_INVARIANT_FAILED: voice insert is not ownership-restricted';
  end if;
  if select_check is null or position('can_access_voice_object' in select_check) = 0 then
    raise exception 'STORAGE_INVARIANT_FAILED: voice select is not family-restricted';
  end if;
  if update_using is not null or update_check is not null then
    raise exception 'STORAGE_INVARIANT_FAILED: voice overwrite must be forbidden';
  end if;
  if delete_using is null or position('can_delete_unused_voice' in delete_using) = 0 then
    raise exception 'STORAGE_INVARIANT_FAILED: referenced voice objects must be protected';
  end if;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'register_voice_story';

  if definition is null
     or position('storage.objects' in definition) = 0
     or position('VOICE_OBJECT_NOT_FOUND' in definition) = 0 then
    raise exception 'STORAGE_INVARIANT_FAILED: voice registration does not verify uploaded object';
  end if;

  if not has_function_privilege('authenticated', 'private.register_voice_story(uuid,text,integer,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'private.register_voice_story(uuid,text,integer,text,text)', 'EXECUTE')
     or has_function_privilege('public', 'private.register_voice_story(uuid,text,integer,text,text)', 'EXECUTE') then
    raise exception 'STORAGE_INVARIANT_FAILED: register_voice_story ACL is unsafe';
  end if;
end $$;

select 'storage_invariants_ok' as result;
