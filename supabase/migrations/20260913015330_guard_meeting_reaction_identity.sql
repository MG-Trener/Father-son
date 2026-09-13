create or replace function private.guard_meeting_idea_reaction_identity()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.id is distinct from old.id
     or new.idea_id is distinct from old.idea_id
     or new.family_id is distinct from old.family_id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'REACTION_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$function$;

revoke all on function private.guard_meeting_idea_reaction_identity() from public, anon, authenticated;

drop trigger if exists guard_meeting_idea_reaction_identity on public.meeting_idea_reactions;
create trigger guard_meeting_idea_reaction_identity
before update on public.meeting_idea_reactions
for each row
execute function private.guard_meeting_idea_reaction_identity();
