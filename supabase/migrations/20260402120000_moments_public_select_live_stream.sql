-- Live stream reads recent rows with the anon key; allow read without owning the row.
drop policy if exists "Public read moments for live stream" on public.moments;
create policy "Public read moments for live stream"
  on public.moments
  for select
  to anon, authenticated
  using (true);
