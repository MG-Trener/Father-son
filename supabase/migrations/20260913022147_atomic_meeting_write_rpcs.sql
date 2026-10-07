create or replace function private.create_meeting_plan(
  p_family_id uuid,
  p_meeting_date date,
  p_title text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_title text := trim(coalesce(p_title, ''));
  v_note text := nullif(left(trim(coalesce(p_note, '')), 2000), '');
  v_timezone text;
  v_today date;
  v_meeting_id uuid;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_family_member(p_family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if char_length(v_title) not between 1 and 100 then raise exception 'INVALID_TITLE'; end if;

  select f.timezone into v_timezone from public.families f where f.id = p_family_id;
  v_today := (now() at time zone coalesce(v_timezone, 'Asia/Almaty'))::date;
  if p_meeting_date is null or p_meeting_date < v_today then raise exception 'INVALID_MEETING_DATE'; end if;

  insert into public.meetings(family_id, created_by, meeting_date, title, note, status)
  values (p_family_id, v_user_id, p_meeting_date, v_title, v_note, 'planned')
  returning id into v_meeting_id;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    p_family_id,
    v_user_id,
    'meeting_created',
    'together',
    jsonb_build_object('meeting_id', v_meeting_id, 'meeting_date', p_meeting_date, 'title', v_title)
  )
  returning id into v_event_id;

  return jsonb_build_object('meeting_id', v_meeting_id, 'event_id', v_event_id);
end;
$function$;

create or replace function public.create_meeting_plan(
  p_family_id uuid,
  p_meeting_date date,
  p_title text,
  p_note text default null
)
returns jsonb
language sql
set search_path to ''
as $function$
  select private.create_meeting_plan(p_family_id, p_meeting_date, p_title, p_note);
$function$;

create or replace function private.complete_meeting_plan(p_meeting_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_meeting public.meetings%rowtype;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_meeting
  from public.meetings m
  where m.id = p_meeting_id
  for update;

  if not found then raise exception 'MEETING_NOT_FOUND'; end if;
  if not private.is_family_member(v_meeting.family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;

  if v_meeting.status = 'completed' then
    return jsonb_build_object('meeting_id', v_meeting.id, 'already_completed', true, 'event_id', null);
  end if;
  if v_meeting.status <> 'planned' then raise exception 'MEETING_NOT_PLANNED'; end if;

  update public.meetings
  set status = 'completed', updated_at = now()
  where id = v_meeting.id;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    v_meeting.family_id,
    v_user_id,
    'meeting_completed',
    'together',
    jsonb_build_object('meeting_id', v_meeting.id, 'meeting_date', v_meeting.meeting_date, 'title', v_meeting.title)
  )
  returning id into v_event_id;

  return jsonb_build_object('meeting_id', v_meeting.id, 'already_completed', false, 'event_id', v_event_id);
end;
$function$;

create or replace function public.complete_meeting_plan(p_meeting_id uuid)
returns jsonb
language sql
set search_path to ''
as $function$
  select private.complete_meeting_plan(p_meeting_id);
$function$;

revoke all on function private.create_meeting_plan(uuid,date,text,text) from public, anon;
revoke all on function public.create_meeting_plan(uuid,date,text,text) from public, anon;
revoke all on function private.complete_meeting_plan(uuid) from public, anon;
revoke all on function public.complete_meeting_plan(uuid) from public, anon;

grant execute on function private.create_meeting_plan(uuid,date,text,text) to authenticated;
grant execute on function public.create_meeting_plan(uuid,date,text,text) to authenticated;
grant execute on function private.complete_meeting_plan(uuid) to authenticated;
grant execute on function public.complete_meeting_plan(uuid) to authenticated;
