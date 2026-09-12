alter function private.create_family_agreement(uuid, text, text) set search_path = '';
alter function private.confirm_family_agreement(uuid) set search_path = '';
alter function private.archive_family_agreement(uuid) set search_path = '';

revoke execute on function private.create_family_agreement(uuid, text, text) from public, anon;
revoke execute on function private.confirm_family_agreement(uuid) from public, anon;
revoke execute on function private.archive_family_agreement(uuid) from public, anon;
grant execute on function private.create_family_agreement(uuid, text, text) to authenticated;
grant execute on function private.confirm_family_agreement(uuid) to authenticated;
grant execute on function private.archive_family_agreement(uuid) to authenticated;

revoke execute on function public.create_family_agreement(uuid, text, text) from public, anon;
revoke execute on function public.confirm_family_agreement(uuid) from public, anon;
revoke execute on function public.archive_family_agreement(uuid) from public, anon;
grant execute on function public.create_family_agreement(uuid, text, text) to authenticated;
grant execute on function public.confirm_family_agreement(uuid) to authenticated;
grant execute on function public.archive_family_agreement(uuid) to authenticated;
