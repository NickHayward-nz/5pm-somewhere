# Warehouse Export Runbook

The goal is to keep buyer-grade historical data outside any single analytics UI. BigQuery is the recommended first warehouse because it is widely understood, cheap at this scale, and easy to share with diligence teams.

## Recommended Destination

Start with one BigQuery dataset:

- Project: company-controlled Google Cloud project.
- Dataset: `fivepm_analytics`.
- Location: choose once and keep it consistent with privacy/data-residency needs.
- Tables:
  - `posthog_events`
  - `supabase_profiles_snapshot`
  - `supabase_moments_snapshot`
  - `supabase_user_montages_snapshot`
  - `stripe_subscriptions_snapshot`
  - `stripe_invoices_snapshot`
  - `monthly_kpi_snapshot`

## Monthly Export Cadence

Run this on the first day of each month for the previous calendar month:

1. Export PostHog events and persons for the month.
2. Export Supabase profile/content snapshots.
3. Export Stripe subscription/invoice/customer data.
4. Recompute the monthly KPI snapshot from raw tables.
5. Store CSV files in a dated folder, then load them into BigQuery.
6. Keep dashboard screenshots only as supporting evidence, not the source of truth.

Suggested archive layout:

```text
exports/
  2026-05/
    posthog_events.csv
    posthog_persons.csv
    supabase_profiles.csv
    supabase_moments.csv
    supabase_user_montages.csv
    stripe_subscriptions.csv
    stripe_invoices.csv
    monthly_kpi_snapshot.csv
```

## Supabase Exports

Export these columns at minimum.

### Profiles

```sql
select
  id,
  created_at,
  timezone,
  is_premium,
  premium_plan,
  premium_started_at,
  premium_expires_at,
  current_streak,
  longest_streak,
  total_uploads,
  last_post_date,
  upload_terms_accepted_at,
  stripe_customer_id,
  stripe_subscription_id
from profiles;
```

### Moments

```sql
select
  id,
  user_id,
  created_at,
  timezone,
  city,
  country,
  duration,
  pretty_count,
  funny_count,
  cheers_count,
  view_count,
  uploader_streak_days,
  uploader_streak_priority,
  visibility_boost_expires_at,
  uploader_is_premium
from moments;
```

### Montages

```sql
select
  id,
  user_id,
  kind,
  status,
  period_start,
  period_end,
  created_at,
  storage_path,
  error_message
from user_montages;
```

## PostHog Exports

Use PostHog Data Pipelines or scheduled exports to BigQuery when available. If using CSV manually, export:

- `event`
- `timestamp`
- `distinct_id`
- all event properties from `docs/ANALYTICS_TAXONOMY.md`
- person id / user id mapping

Join keys:

| PostHog field | Warehouse join |
| --- | --- |
| `distinct_id` after identify | `profiles.id` |
| `moment_id` | `moments.id` |
| `montage_id` | `user_montages.id` |

## Stripe Exports

Prefer Stripe Data Pipeline or Sigma into BigQuery. Manual CSV is acceptable early if retained monthly.

Minimum tables:

- customers
- subscriptions
- invoices
- invoice line items
- checkout sessions
- refunds / balance transactions

Join keys:

| Stripe field | Supabase field |
| --- | --- |
| `customer.id` | `profiles.stripe_customer_id` |
| `subscription.id` | `profiles.stripe_subscription_id` |

## Monthly KPI Snapshot

Create a monthly row with:

- period start/end
- visitors
- signups
- active users
- activated users
- moments created
- uploads per active user
- share rate
- premium subscribers
- MRR
- churn
- crash-free sessions
- frontend error rate

The definitions in `docs/METRICS.md` are authoritative.
