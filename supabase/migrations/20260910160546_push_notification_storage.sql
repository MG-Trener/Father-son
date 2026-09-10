create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_token_format check (char_length(expo_push_token) between 20 and 512)
);

create index push_devices_user_enabled_idx on public.push_devices(user_id, enabled);

alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon;
grant select, insert, update, delete on public.push_devices to authenticated;

create policy push_devices_select_self
on public.push_devices for select
to authenticated
using ((select auth.uid()) = user_id);

create policy push_devices_insert_self
on public.push_devices for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy push_devices_update_self
on public.push_devices for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy push_devices_delete_self
on public.push_devices for delete
to authenticated
using ((select auth.uid()) = user_id);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.activity_events(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'error', 'device_not_registered')),
  ticket_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, recipient_user_id, expo_push_token)
);

create index notification_deliveries_event_idx on public.notification_deliveries(event_id);
create index notification_deliveries_recipient_idx on public.notification_deliveries(recipient_user_id, created_at desc);

alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon, authenticated;
