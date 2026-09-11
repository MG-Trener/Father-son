create table if not exists public.weekly_focuses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid null references auth.users(id) on delete cascade,
  category text not null,
  title text not null,
  note text null,
  week_start date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_focuses_category_check check (category in ('school','football','chess','english','leadership','together')),
  constraint weekly_focuses_title_check check (char_length(title) between 1 and 120),
  constraint weekly_focuses_note_check check (note is null or char_length(note) <= 600),
  constraint weekly_focuses_week_start_monday_check check (extract(dow from week_start) = 1)
);

create unique index if not exists weekly_focuses_personal_week_uidx
  on public.weekly_focuses(family_id, week_start, target_user_id)
  where target_user_id is not null;

create unique index if not exists weekly_focuses_together_week_uidx
  on public.weekly_focuses(family_id, week_start)
  where target_user_id is null;

create index if not exists weekly_focuses_family_week_idx
  on public.weekly_focuses(family_id, week_start desc);

alter table public.weekly_focuses enable row level security;

create policy weekly_focuses_family_select
  on public.weekly_focuses
  for select
  to authenticated
  using (private.is_family_member(family_id));

create policy weekly_focuses_family_insert
  on public.weekly_focuses
  for insert
  to authenticated
  with check (
    private.is_family_member(family_id)
    and created_by = (select auth.uid())
    and (
      target_user_id is null
      or exists (
        select 1
        from public.family_members fm
        where fm.family_id = weekly_focuses.family_id
          and fm.user_id = weekly_focuses.target_user_id
      )
    )
  );

create policy weekly_focuses_family_update
  on public.weekly_focuses
  for update
  to authenticated
  using (
    private.is_family_member(family_id)
    and (
      target_user_id is null
      or target_user_id = (select auth.uid())
      or created_by = (select auth.uid())
    )
  )
  with check (
    private.is_family_member(family_id)
    and (
      target_user_id is null
      or target_user_id = (select auth.uid())
      or created_by = (select auth.uid())
    )
  );

create policy weekly_focuses_family_delete
  on public.weekly_focuses
  for delete
  to authenticated
  using (
    private.is_family_member(family_id)
    and (
      target_user_id is null
      or target_user_id = (select auth.uid())
      or created_by = (select auth.uid())
    )
  );

grant select, insert, delete on public.weekly_focuses to authenticated;
revoke update on public.weekly_focuses from authenticated;
grant update (category, title, note, updated_at) on public.weekly_focuses to authenticated;
