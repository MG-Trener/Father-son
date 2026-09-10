create table public.voice_stories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  prompt text,
  storage_path text not null,
  duration_ms integer not null,
  status text not null default 'ready',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_stories_title_len check (title is null or char_length(title) <= 120),
  constraint voice_stories_prompt_len check (prompt is null or char_length(prompt) <= 500),
  constraint voice_stories_path_len check (char_length(storage_path) between 10 and 1024),
  constraint voice_stories_duration check (duration_ms between 500 and 1200000),
  constraint voice_stories_status check (status in ('ready', 'failed', 'archived')),
  unique (storage_path)
);

create index voice_stories_family_recorded_idx on public.voice_stories(family_id, recorded_at desc);
create index voice_stories_author_recorded_idx on public.voice_stories(author_user_id, recorded_at desc);

alter table public.voice_stories enable row level security;

create policy voice_stories_select_family on public.voice_stories
for select to authenticated
using (private.is_family_member(family_id));

create policy voice_stories_insert_own on public.voice_stories
for insert to authenticated
with check (author_user_id = (select auth.uid()) and private.is_family_member(family_id));

create policy voice_stories_update_own on public.voice_stories
for update to authenticated
using (author_user_id = (select auth.uid()) and private.is_family_member(family_id))
with check (author_user_id = (select auth.uid()) and private.is_family_member(family_id));

create policy voice_stories_delete_own on public.voice_stories
for delete to authenticated
using (author_user_id = (select auth.uid()) and private.is_family_member(family_id));

create or replace function private.register_voice_story(
  p_family_id uuid,
  p_storage_path text,
  p_duration_ms integer,
  p_title text default null,
  p_prompt text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_path text := trim(coalesce(p_storage_path, ''));
  v_title text := nullif(left(trim(coalesce(p_title, '')), 120), '');
  v_prompt text := nullif(left(trim(coalesce(p_prompt, '')), 500), '');
  v_expected_prefix text;
  v_story_id uuid;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_family_member(p_family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if p_duration_ms not between 500 and 1200000 then raise exception 'INVALID_DURATION'; end if;

  v_expected_prefix := p_family_id::text || '/' || v_user_id::text || '/';
  if v_path not like v_expected_prefix || '%' then
    raise exception 'INVALID_STORAGE_PATH';
  end if;

  insert into public.voice_stories(family_id, author_user_id, title, prompt, storage_path, duration_ms, status)
  values (p_family_id, v_user_id, v_title, v_prompt, v_path, p_duration_ms, 'ready')
  returning id into v_story_id;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    p_family_id,
    v_user_id,
    'voice_story_added',
    'together',
    jsonb_strip_nulls(jsonb_build_object(
      'voice_story_id', v_story_id,
      'title', v_title,
      'prompt', v_prompt,
      'duration_ms', p_duration_ms
    ))
  )
  returning id into v_event_id;

  return jsonb_build_object('voice_story_id', v_story_id, 'event_id', v_event_id);
end;
$$;

create or replace function public.register_voice_story(
  p_family_id uuid,
  p_storage_path text,
  p_duration_ms integer,
  p_title text default null,
  p_prompt text default null
)
returns jsonb
language sql
set search_path = ''
as $$
  select private.register_voice_story(p_family_id, p_storage_path, p_duration_ms, p_title, p_prompt);
$$;

revoke execute on function public.register_voice_story(uuid, text, integer, text, text) from public;
revoke execute on function public.register_voice_story(uuid, text, integer, text, text) from anon;
grant execute on function public.register_voice_story(uuid, text, integer, text, text) to authenticated;
