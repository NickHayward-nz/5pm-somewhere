-- Expand-only security hardening step:
-- Add a narrow public read surface for the live stream without removing the
-- existing moments policies yet. This keeps the current production frontend
-- working while the new frontend rolls out.

-- A narrow public read surface for the live stream. This intentionally excludes
-- user_id, uploader premium flags, and other internal/account fields.
drop view if exists public.public_live_moments;
create view public.public_live_moments as
select
  id,
  created_at,
  timezone,
  city,
  country,
  video_url,
  caption,
  duration,
  pretty_count,
  funny_count,
  cheers_count,
  uploader_streak_days,
  uploader_streak_priority,
  visibility_boost_expires_at
from public.moments;

grant select on public.public_live_moments to anon, authenticated;

notify pgrst, 'reload schema';
