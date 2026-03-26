-- When the user accepted upload/stream terms before their first 5PM moment capture.
alter table public.profiles
  add column if not exists upload_terms_accepted_at timestamptz null;

comment on column public.profiles.upload_terms_accepted_at is
  'Timestamp when the user accepted Terms/Privacy for uploading; null means not yet accepted.';
