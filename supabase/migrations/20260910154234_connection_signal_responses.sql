create or replace function private.respond_connection_signal(
  p_signal_event_id uuid,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_signal public.activity_events%rowtype;
  v_response_event_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_response not in ('here', 'later') then raise exception 'INVALID_RESPONSE'; end if;

  select * into v_signal
  from public.activity_events ae
  where ae.id = p_signal_event_id
    and ae.event_type in ('five_minutes_ping', 'advice_requested');

  if not found then raise exception 'SIGNAL_NOT_FOUND'; end if;
  if not private.is_family_member(v_signal.family_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if v_signal.actor_user_id = v_user_id then raise exception 'CANNOT_RESPOND_TO_OWN_SIGNAL'; end if;

  select ae.id into v_response_event_id
  from public.activity_events ae
  where ae.family_id = v_signal.family_id
    and ae.actor_user_id = v_user_id
    and ae.event_type = 'connection_response'
    and ae.payload->>'signal_event_id' = p_signal_event_id::text
  order by ae.occurred_at desc
  limit 1;

  if v_response_event_id is not null then
    return jsonb_build_object('event_id', v_response_event_id, 'already_responded', true);
  end if;

  insert into public.activity_events(family_id, actor_user_id, event_type, category, payload)
  values (
    v_signal.family_id,
    v_user_id,
    'connection_response',
    'together',
    jsonb_build_object(
      'signal_event_id', p_signal_event_id,
      'response', p_response,
      'requester_user_id', v_signal.actor_user_id,
      'signal_type', case v_signal.event_type when 'five_minutes_ping' then 'five_minutes' else 'advice' end
    )
  )
  returning id into v_response_event_id;

  return jsonb_build_object('event_id', v_response_event_id, 'already_responded', false, 'response', p_response);
end;
$$;

create or replace function public.respond_connection_signal(
  p_signal_event_id uuid,
  p_response text
)
returns jsonb
language sql
set search_path = ''
as $$
  select private.respond_connection_signal(p_signal_event_id, p_response);
$$;

revoke execute on function public.respond_connection_signal(uuid, text) from public;
revoke execute on function public.respond_connection_signal(uuid, text) from anon;
grant execute on function public.respond_connection_signal(uuid, text) to authenticated;
