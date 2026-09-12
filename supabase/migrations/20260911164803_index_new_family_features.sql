create index if not exists family_agreements_created_by_idx on public.family_agreements(created_by);
create index if not exists weekly_focuses_created_by_idx on public.weekly_focuses(created_by);
create index if not exists weekly_focuses_target_user_idx on public.weekly_focuses(target_user_id) where target_user_id is not null;
