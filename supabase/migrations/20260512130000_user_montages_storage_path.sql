-- Store the private Storage object path for generated montage MP4s.
alter table public.user_montages
  add column if not exists storage_path text;
