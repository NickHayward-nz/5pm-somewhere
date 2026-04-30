-- Some deployed projects predate the original profiles migration shape.
-- Stripe/webhook and the app both depend on this flag being present.
alter table public.profiles
  add column if not exists is_premium boolean not null default false;

notify pgrst, 'reload schema';

