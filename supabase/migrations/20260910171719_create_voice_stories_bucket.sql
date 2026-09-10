insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-stories',
  'voice-stories',
  false,
  26214400,
  array['audio/mp4','audio/m4a','audio/x-m4a','audio/aac']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();
