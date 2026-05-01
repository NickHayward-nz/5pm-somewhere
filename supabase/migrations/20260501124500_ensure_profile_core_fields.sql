-- Repair projects where migration history was marked applied after some
-- profile columns had already drifted from the local schema.
alter table public.profiles
  add column if not exists timezone text not null default 'Pacific/Auckland',
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists last_post_date date,
  add column if not exists upload_terms_accepted_at timestamptz;

notify pgrst, 'reload schema';

