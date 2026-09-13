do $$
begin
  if to_regprocedure('public.record_ritual_moment(uuid,date)') is null then
    raise exception 'RITUAL_INVARIANTS_FAILED: public.record_ritual_moment missing';
  end if;

  if to_regprocedure('private.record_ritual_moment(uuid,date)') is null then
    raise exception 'RITUAL_INVARIANTS_FAILED: private.record_ritual_moment missing';
  end if;

  if to_regclass('public.ritual_moments_one_per_ritual_day_idx') is null then
    raise exception 'RITUAL_INVARIANTS_FAILED: unique ritual/day index missing';
  end if;

  if has_function_privilege('anon', 'public.record_ritual_moment(uuid,date)', 'EXECUTE') then
    raise exception 'RITUAL_INVARIANTS_FAILED: anon can execute public ritual RPC';
  end if;

  if not has_function_privilege('authenticated', 'public.record_ritual_moment(uuid,date)', 'EXECUTE') then
    raise exception 'RITUAL_INVARIANTS_FAILED: authenticated cannot execute public ritual RPC';
  end if;

  if has_function_privilege('anon', 'private.record_ritual_moment(uuid,date)', 'EXECUTE') then
    raise exception 'RITUAL_INVARIANTS_FAILED: anon can execute private ritual function';
  end if;

  if exists (
    select 1
    from public.ritual_moments
    group by ritual_id, happened_on
    having count(*) > 1
  ) then
    raise exception 'RITUAL_INVARIANTS_FAILED: duplicate ritual/day rows found';
  end if;
end $$;

select 'ritual_invariants_ok' as result;
