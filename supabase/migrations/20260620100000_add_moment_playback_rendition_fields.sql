-- Expand step for iOS/Safari-friendly playback renditions.
--
-- Original uploads stay untouched in storage_path/video_url. These optional
-- fields let a worker add an MP4/H.264/AAC playback copy later, and let the
-- signed-URL edge function prefer it only when it is ready.

alter table public.moments
  add column if not exists playback_storage_path text,
  add column if not exists playback_content_type text,
  add column if not exists playback_status text not null default 'none',
  add column if not exists playback_error text,
  add column if not exists playback_generated_at timestamptz;

alter table public.moments
  drop constraint if exists moments_playback_status_check;

alter table public.moments
  add constraint moments_playback_status_check
  check (playback_status in ('none', 'pending', 'ready', 'failed'));

create index if not exists moments_playback_status_idx
  on public.moments (playback_status)
  where playback_status <> 'none';

notify pgrst, 'reload schema';
