revoke execute on function private.create_reflection_entry(uuid, text, text) from public, anon;
revoke execute on function private.register_push_device(text, text) from public, anon;
revoke execute on function private.register_voice_story(uuid, text, integer, text, text) from public, anon;
revoke execute on function private.respond_connection_signal(uuid, text) from public, anon;
revoke execute on function private.send_connection_signal(uuid, text, text) from public, anon;
revoke execute on function private.unregister_all_push_devices() from public, anon;
revoke execute on function private.unregister_push_device(text) from public, anon;

grant execute on function private.create_reflection_entry(uuid, text, text) to authenticated;
grant execute on function private.register_push_device(text, text) to authenticated;
grant execute on function private.register_voice_story(uuid, text, integer, text, text) to authenticated;
grant execute on function private.respond_connection_signal(uuid, text) to authenticated;
grant execute on function private.send_connection_signal(uuid, text, text) to authenticated;
grant execute on function private.unregister_all_push_devices() to authenticated;
grant execute on function private.unregister_push_device(text) to authenticated;
