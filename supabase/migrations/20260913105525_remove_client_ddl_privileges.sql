-- Mobile clients only need Data API CRUD privileges explicitly granted by the
-- application migrations. TRUNCATE/REFERENCES/TRIGGER are not used by the app
-- and should never be inherited by anon/authenticated roles.

revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke truncate, references, trigger on all tables in schema public from anon;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon;
