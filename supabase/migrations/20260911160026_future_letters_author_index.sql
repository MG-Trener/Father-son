create index if not exists future_letters_author_unlock_idx
  on public.future_letters(author_user_id, unlock_at desc);
