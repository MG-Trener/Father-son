insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-releases',
  'app-releases',
  false,
  209715200,
  array['application/vnd.android.package-archive','application/octet-stream']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.app_releases
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists sha256 text,
  add column if not exists size_bytes bigint;

update public.app_releases
set storage_bucket = 'app-releases'
where storage_bucket is null;

alter table public.app_releases
  alter column storage_bucket set default 'app-releases';

drop policy if exists "Authenticated can read app release files" on storage.objects;
create policy "Authenticated can read app release files"
on storage.objects
for select
to authenticated
using (bucket_id = 'app-releases');

drop function public.get_latest_app_release(text,text);

create function public.get_latest_app_release(
  p_platform text default 'android',
  p_channel text default 'preview'
)
returns table(
  version_name text,
  version_code integer,
  minimum_supported_code integer,
  title text,
  notes text,
  download_url text,
  storage_bucket text,
  storage_path text,
  sha256 text,
  size_bytes bigint,
  published_at timestamptz
)
language sql
stable
set search_path = pg_catalog, public
as $$
  select
    r.version_name,
    r.version_code,
    r.minimum_supported_code,
    r.title,
    r.notes,
    r.download_url,
    r.storage_bucket,
    r.storage_path,
    r.sha256,
    r.size_bytes,
    r.published_at
  from public.app_releases r
  where r.platform = p_platform
    and r.channel = p_channel
    and r.is_enabled = true
  order by r.version_code desc
  limit 1;
$$;

revoke all on function public.get_latest_app_release(text,text) from public;
grant execute on function public.get_latest_app_release(text,text) to anon, authenticated, service_role;
