-- user_reactions: one row per user per moment per reaction type (pretty, funny, cheers)
-- Enables cross-device reaction sync for logged-in users.
create table if not exists public.user_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  moment_id uuid not null,
  reaction_type text not null check (reaction_type in ('pretty', 'funny', 'cheers')),
  created_at timestamptz not null default now(),
  unique (user_id, moment_id, reaction_type)
);

create index if not exists idx_user_reactions_user_moment
  on public.user_reactions (user_id, moment_id);

alter table public.user_reactions enable row level security;

create policy "Users can insert own reactions"
  on public.user_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can select own reactions"
  on public.user_reactions for select
  using (auth.uid() = user_id);

create policy "Users can delete own reactions"
  on public.user_reactions for delete
  using (auth.uid() = user_id);
