-- Security hardening after external audit:
-- - Keep the public live-stream product behaviour, but stop exposing the full
--   moments table directly to anon users.
-- - Serve public live-stream reads through a narrow view with only fields the UI
--   needs.
-- - Remove direct anonymous reaction/view-count mutation surfaces until they can
--   be reintroduced through rate-limited server-side endpoints.

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

-- Remove broad direct read policies on the base table. Authenticated users keep
-- the existing owner-read policy for My Moments/profile flows.
drop policy if exists "Enable read access for all users" on public.moments;
drop policy if exists "Public can read all moments" on public.moments;
drop policy if exists "Public read moments for live stream" on public.moments;

-- Make the owner-read policy explicit and idempotent for authenticated users.
drop policy if exists "Users can read own moments" on public.moments;
create policy "Users can read own moments"
  on public.moments
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Anonymous reactions were easy to stuff/sabotage through repeated direct RPC
-- calls. Logged-in reactions still use user_reactions with a uniqueness
-- constraint and trigger-maintained counts.
revoke execute on function public.bump_moment_reaction_for_anon(uuid, text, int) from anon;

-- Direct client-side view counting trusted a browser-provided viewer key. Disable
-- direct RPC access until a server-side/rate-limited path is added.
revoke execute on function public.increment_moment_view(uuid, text) from anon, authenticated;
