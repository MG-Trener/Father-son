revoke all on function private.create_future_letter(uuid, uuid, text, text, timestamptz) from public, anon;
revoke all on function private.update_future_letter_draft(uuid, text, text, timestamptz, uuid) from public, anon;
revoke all on function private.seal_future_letter(uuid) from public, anon;
revoke all on function private.delete_future_letter_draft(uuid) from public, anon;
revoke all on function private.open_future_letter(uuid) from public, anon;

grant execute on function private.create_future_letter(uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function private.update_future_letter_draft(uuid, text, text, timestamptz, uuid) to authenticated;
grant execute on function private.seal_future_letter(uuid) to authenticated;
grant execute on function private.delete_future_letter_draft(uuid) to authenticated;
grant execute on function private.open_future_letter(uuid) to authenticated;
