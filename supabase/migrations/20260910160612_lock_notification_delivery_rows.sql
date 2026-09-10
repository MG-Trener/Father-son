create policy notification_deliveries_deny_client_select
on public.notification_deliveries for select
to authenticated
using (false);
