-- Legal/account acceptance metadata for launch readiness.
-- Existing upload_terms_accepted_at remains the content-upload licence consent gate.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_policy_accepted_at timestamptz,
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists legal_terms_version text,
  add column if not exists upload_terms_version text;

comment on column public.profiles.terms_accepted_at is
  'When the user actively accepted the account Terms of Service before sign-in/account use.';

comment on column public.profiles.privacy_policy_accepted_at is
  'When the user actively accepted the Privacy Policy before sign-in/account use.';

comment on column public.profiles.age_confirmed_at is
  'When the user confirmed they are at least 13 and have guardian consent if required.';

comment on column public.profiles.legal_terms_version is
  'Terms/Privacy version accepted for account use.';

comment on column public.profiles.upload_terms_version is
  'Upload/content licence terms version accepted before first 5PM Moment capture.';
