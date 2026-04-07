-- Montage outputs (weekly / monthly) for premium users; playback via Mux.
-- Music rotation state for fair track selection under music/{pretty,funny,cheers}/

create table if not exists public.user_montages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('weekly', 'monthly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  title text,
  mux_asset_id text,
  mux_playback_id text,
  playback_url text,
  duration_sec numeric,
  dominant_reaction text check (dominant_reaction in ('pretty', 'funny', 'cheers')),
  music_track_path text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, period_start)
);

create index if not exists user_montages_user_id_created_at_idx
  on public.user_montages (user_id, created_at desc);

comment on table public.user_montages is
  'Premium montage jobs; rows are written by the Vercel worker (service role).';

alter table public.user_montages enable row level security;

create policy "Users can read own montages"
  on public.user_montages for select
  using (auth.uid() = user_id);

-- Inserts/updates only via service role (no policy for authenticated insert/update)

create table if not exists public.montage_music_rotation (
  folder text primary key check (folder in ('pretty', 'funny', 'cheers')),
  next_index int not null default 0
);

insert into public.montage_music_rotation (folder)
  values ('pretty'), ('funny'), ('cheers')
  on conflict (folder) do nothing;

alter table public.montage_music_rotation enable row level security;
-- No user-facing policies; worker uses service role only.

-- Storage: montages (final MP4s for Mux ingest) and music (Suno tracks)
insert into storage.buckets (id, name, public)
  values ('montages', 'montages', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('music', 'music', false)
  on conflict (id) do nothing;
