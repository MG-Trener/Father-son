drop policy if exists recognitions_insert_author on public.recognitions;
create policy recognitions_insert_author
on public.recognitions
for insert
to authenticated
with check (
  private.is_family_member(family_id)
  and from_user_id = (select auth.uid())
  and to_user_id <> from_user_id
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = recognitions.family_id
      and fm.user_id = recognitions.to_user_id
  )
);
