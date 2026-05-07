-- Reliable 5PM Web Push notifications for local and selected-city reminders.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  device_label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.notification_city_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  city_id text not null,
  city_name text not null,
  country_code text not null,
  timezone text not null,
  reminder_offsets integer[] not null default array[10, 0],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_city_preferences_offsets_valid
    check (
      array_length(reminder_offsets, 1) is not null
      and reminder_offsets <@ array[60, 30, 15, 10, 5, 0]
    ),
  constraint notification_city_preferences_user_city_unique unique (user_id, city_id)
);

create table if not exists public.notification_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  preference_id uuid references public.notification_city_preferences (id) on delete cascade,
  city_id text not null,
  local_date date not null,
  offset_minutes integer not null,
  sent_at timestamptz not null default now(),
  constraint notification_delivery_log_unique unique (
    user_id,
    subscription_id,
    city_id,
    local_date,
    offset_minutes
  )
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, active);

create index if not exists notification_city_preferences_due_idx
  on public.notification_city_preferences (active, timezone);

create index if not exists notification_delivery_log_sent_at_idx
  on public.notification_delivery_log (sent_at);

alter table public.push_subscriptions enable row level security;
alter table public.notification_city_preferences enable row level security;
alter table public.notification_delivery_log enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own notification preferences" on public.notification_city_preferences;
create policy "Users manage own notification preferences"
  on public.notification_city_preferences
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users read own notification delivery log" on public.notification_delivery_log;
create policy "Users read own notification delivery log"
  on public.notification_delivery_log
  for select
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists notification_city_preferences_updated_at on public.notification_city_preferences;
create trigger notification_city_preferences_updated_at
  before update on public.notification_city_preferences
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
