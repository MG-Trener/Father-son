-- Harden growth/achievement write boundaries.
-- Missions and achievement awards are written through validated RPCs only.
-- Age seasons and year reviews keep direct writes but must stay inside the family graph.

revoke insert, update, delete on table public.missions from authenticated;
revoke insert, update, delete on table public.achievement_awards from authenticated;

drop policy if exists age_seasons_family_insert on public.age_seasons;
create policy age_seasons_family_insert
on public.age_seasons
for insert
to authenticated
with check (
  private.is_family_member(family_id)
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = age_seasons.family_id
      and fm.user_id = age_seasons.subject_user_id
  )
);

drop policy if exists year_reviews_family_insert on public.year_reviews;
create policy year_reviews_family_insert
on public.year_reviews
for insert
to authenticated
with check (
  private.is_family_member(family_id)
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = year_reviews.family_id
      and fm.user_id = year_reviews.subject_user_id
  )
  and exists (
    select 1
    from public.age_seasons s
    where s.id = year_reviews.season_id
      and s.family_id = year_reviews.family_id
      and s.subject_user_id = year_reviews.subject_user_id
  )
);
