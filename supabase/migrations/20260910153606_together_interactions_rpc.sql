create or replace function private.send_connection_signal(
  p_family_id uuid,
  p_signal_type text,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_event_type text;
  v_message text := nullif(left(trim(coalesce(p_message, '')), 500), '');
  v_event_id uuid;
  v_now timestamptz := now();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_family_member(p_family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;

  v_event_type := case p_signal_type
    when 'five_minutes' then 'five_minutes_ping'
    when 'advice' then 'advice_requested'
    else null
  end;
  if v_event_type is null then raise exception 'INVALID_SIGNAL_TYPE'; end if;

  if exists (
    select 1
    from public.activity_events ae
    where ae.family_id = p_family_id
      and ae.actor_user_id = v_user_id
      and ae.event_type = v_event_type
      and ae.occurred_at > v_now - interval '45 seconds'
  ) then
    raise exception 'SIGNAL_TOO_SOON';
  end if;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload, occurred_at)
  values (
    p_family_id,
    v_user_id,
    v_event_type,
    'together',
    jsonb_strip_nulls(jsonb_build_object('signal_type', p_signal_type, 'message', v_message)),
    v_now
  )
  returning id into v_event_id;

  return jsonb_build_object('event_id', v_event_id, 'event_type', v_event_type, 'sent_at', v_now);
end;
$$;

create or replace function public.send_connection_signal(
  p_family_id uuid,
  p_signal_type text,
  p_message text default null
)
returns jsonb
language sql
set search_path = ''
as $$
  select private.send_connection_signal(p_family_id, p_signal_type, p_message);
$$;

revoke execute on function public.send_connection_signal(uuid, text, text) from public;
revoke execute on function public.send_connection_signal(uuid, text, text) from anon;
grant execute on function public.send_connection_signal(uuid, text, text) to authenticated;

create or replace function private.create_reflection_entry(
  p_family_id uuid,
  p_body text,
  p_prompt text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_body text := trim(coalesce(p_body, ''));
  v_prompt text := nullif(left(trim(coalesce(p_prompt, '')), 500), '');
  v_reflection_id uuid;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_family_member(p_family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if char_length(v_body) not between 1 and 4000 then raise exception 'INVALID_BODY'; end if;

  insert into public.reflections(family_id, author_user_id, category, prompt, body, visibility)
  values (p_family_id, v_user_id, 'together', v_prompt, v_body, 'family')
  returning id into v_reflection_id;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    p_family_id,
    v_user_id,
    'reflection_added',
    'together',
    jsonb_strip_nulls(jsonb_build_object(
      'reflection_id', v_reflection_id,
      'prompt', v_prompt,
      'preview', left(v_body, 140)
    ))
  )
  returning id into v_event_id;

  return jsonb_build_object('reflection_id', v_reflection_id, 'event_id', v_event_id);
end;
$$;

create or replace function public.create_reflection_entry(
  p_family_id uuid,
  p_body text,
  p_prompt text default null
)
returns jsonb
language sql
set search_path = ''
as $$
  select private.create_reflection_entry(p_family_id, p_body, p_prompt);
$$;

revoke execute on function public.create_reflection_entry(uuid, text, text) from public;
revoke execute on function public.create_reflection_entry(uuid, text, text) from anon;
grant execute on function public.create_reflection_entry(uuid, text, text) to authenticated;
