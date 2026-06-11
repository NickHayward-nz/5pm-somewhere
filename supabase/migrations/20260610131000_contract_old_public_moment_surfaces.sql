-- Contract step after the frontend has moved to public.public_live_moments:
-- Remove broad direct base-table reads and direct browser-callable metric/reaction
-- mutation surfaces that were identified in the external audit.
--
-- Deploy only after the expand/frontend-switch PR is live and smoke-tested.

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

notify pgrst, 'reload schema';
