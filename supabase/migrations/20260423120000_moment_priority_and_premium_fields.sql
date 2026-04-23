-- Live-stream queue priority: store the computed priority + premium flag per upload
-- so the LiveStream query (`order by uploader_streak_priority desc`) naturally
-- surfaces premium and longer-streak uploads first.
--
-- Priority formula (client-side in src/lib/capture.ts → computeLiveStreamPriority):
--   basePriority = 100
--   streakBonus  = currentStreak * 25
--   premiumBonus = isPremium ? 80 : 0
--   total        = base + streak + premium
--
-- Adds: uploader_is_premium (bool), plus indexes for fast ordering.

alter table public.moments
  add column if not exists uploader_is_premium boolean not null default false;

-- Backfill: any existing rows default to false (free) — correct for historical data.

-- Stripe / payment columns on profiles so the webhook can mark users premium
-- and downgrade them at period end. The actual is_premium flag is already
-- present from the create_profiles migration.
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists premium_plan text,
  add column if not exists premium_started_at timestamptz,
  add column if not exists premium_expires_at timestamptz;

-- Keep the live-stream query fast: an index on priority + created_at means
-- Postgres can walk the top of the queue without a full scan.
create index if not exists moments_priority_created_at_idx
  on public.moments (uploader_streak_priority desc, created_at desc);

-- Lookup by customer id for webhook mutations (service role only).
create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id);
