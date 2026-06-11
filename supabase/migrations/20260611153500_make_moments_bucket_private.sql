-- Contract step for private moments storage:
-- - stop direct public reads/listing of the raw moments bucket
-- - keep signed-in uploads/removals scoped to each user's own folder
-- - signed playback now goes through get-moment-video-url using service-role signing

update storage.buckets
set public = false
where id = 'moments';

-- Remove the broad public object read/list policy from the audit finding.
drop policy if exists "public can read moments" on storage.objects;

-- Tighten uploads from "any authenticated user can upload anywhere in bucket"
-- to "authenticated users can upload only under their own uid prefix".
drop policy if exists "authenticated users can upload moments" on storage.objects;
create policy "Users upload own moment files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'moments'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Keep delete-own policy idempotent.
drop policy if exists "Users delete own moment files" on storage.objects;
create policy "Users delete own moment files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'moments'
    and split_part(name, '/', 1) = auth.uid()::text
  );
