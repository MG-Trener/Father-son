create or replace function public.create_family_agreement(
  p_family_id uuid,
  p_title text,
  p_note text default null
) returns jsonb
language sql
set search_path = ''
as $$ select private.create_family_agreement(p_family_id, p_title, p_note); $$;

create or replace function public.confirm_family_agreement(p_agreement_id uuid)
returns jsonb
language sql
set search_path = ''
as $$ select private.confirm_family_agreement(p_agreement_id); $$;

create or replace function public.archive_family_agreement(p_agreement_id uuid)
returns jsonb
language sql
set search_path = ''
as $$ select private.archive_family_agreement(p_agreement_id); $$;

grant execute on function public.create_family_agreement(uuid, text, text) to authenticated;
grant execute on function public.confirm_family_agreement(uuid) to authenticated;
grant execute on function public.archive_family_agreement(uuid) to authenticated;
