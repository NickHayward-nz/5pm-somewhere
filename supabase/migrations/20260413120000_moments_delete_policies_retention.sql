-- Allow authenticated users to delete their own capture rows and storage objects
-- so the client can enforce the free-tier cap (7 newest moments) after upload.
-- Montages live in `user_montages` + `montages` bucket + Mux; this does not affect those.

-- Own moment rows
drop policy if exists "Users delete own moments" on public.moments;
create policy "Users delete own moments"
  on public.moments for delete
  to authenticated
  using (auth.uid() = user_id);

-- Reactions on someone else's moment: allow moment owner to delete those rows when pruning
drop policy if exists "Moment owners delete reactions on their moments" on public.user_reactions;
create policy "Moment owners delete reactions on their moments"
  on public.user_reactions for delete
  to authenticated
  using (
    exists (
      select 1
      from public.moments m
      where m.id = user_reactions.moment_id
        and m.user_id = auth.uid()
    )
  );

-- Storage: first path segment is auth user id (see RecordMoment upload path)
drop policy if exists "Users delete own moment files" on storage.objects;
create policy "Users delete own moment files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'moments'
    and split_part(name, '/', 1) = auth.uid()::text
  );
