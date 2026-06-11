-- Expand step for private moments storage:
-- - add a durable storage_path column for new uploads
-- - backfill old rows from the historical public video_url shape
-- - keep the bucket public for now so current production remains safe while
--   frontend playback moves to signed URLs

alter table public.moments
  add column if not exists storage_path text;

update public.moments
set storage_path = split_part(video_url, '/storage/v1/object/public/moments/', 2)
where storage_path is null
  and video_url like '%/storage/v1/object/public/moments/%';

-- Keep the narrow public read view focused on display data. The signed URL edge
-- function reads storage_path server-side by moment id when it is allowed.
notify pgrst, 'reload schema';
