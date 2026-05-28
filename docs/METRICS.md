# Metric Definitions

This is the buyer-facing one-pager for 5PM Somewhere metrics. Use these definitions consistently in dashboards, monthly investor updates, and acquisition diligence.

## Sources Of Truth

| Area | Source of truth | Supporting tools |
| --- | --- | --- |
| Users and profiles | Supabase `profiles` + Supabase Auth | PostHog identity/cohorts |
| Content | Supabase `moments`, Storage, `user_montages` | PostHog behavior events |
| Revenue | Stripe subscriptions, invoices, refunds | Supabase premium fields, PostHog checkout behavior |
| Acquisition | Plausible | PostHog page/events, campaign tags |
| Reliability | Sentry | Browser console/logs during development |

## Core Growth Metrics

| Metric | Definition |
| --- | --- |
| Visitor | A Plausible visitor to the site in the selected period. |
| Signed-up user | A Supabase Auth user who reaches `auth_signed_in` and has a Supabase user id. |
| Active user | A signed-in user with at least one meaningful product event in the period: capture intent, upload, live stream open, reaction, share, montage open, or premium action. |
| DAU / WAU / MAU | Count of active users by day, rolling 7 days, or rolling 30 days. |
| Activation | A signed-up user who uploads at least one moment (`video_upload_succeeded`) or has `profiles.total_uploads >= 1`. |
| D1 retention | Activated users who have any active-user event on the next calendar day in their profile timezone. |
| D7 retention | Activated users who have any active-user event 7 days after activation, plus/minus one day. |
| Capture intent rate | `capture_intent` users / active users. |
| Upload success rate | `video_upload_succeeded` / `video_upload_started`. |
| Share rate | Users with `video_share_result` / users with `video_upload_succeeded`. |

## Content And Engagement

| Metric | Definition |
| --- | --- |
| Moments created | Count of rows inserted into `moments`. Use Supabase as truth. |
| Uploads per active user | `moments` rows / active users in the same period. |
| Live stream opens | Count of `live_stream_opened`. |
| Moment views | Count from `moments.view_count` / reach counters when available. PostHog `moment_viewed` explains viewer behavior. |
| Reaction count | Sum of `pretty_count`, `funny_count`, and `cheers_count` from `moments`. |
| Reaction rate | Users with `moment_reaction_toggled` / users with `live_stream_opened`. |
| Streak distribution | Distribution of `profiles.current_streak`. |
| Montage readiness | Count of `user_montages.status = 'ready'` by week/month. |
| Montage share rate | Users with `montage_share_result` / users with ready montages viewed. |

## Revenue

| Metric | Definition |
| --- | --- |
| Premium subscriber | Stripe active subscription mapped to `profiles.stripe_subscription_id`, reflected in `profiles.is_premium = true`. |
| MRR | Stripe subscription monthly recurring revenue, net of discounts and excluding one-off charges. |
| ARR | MRR * 12. |
| ARPU | Total revenue / active users in the period. |
| ARPPU | Total revenue / paying users in the period. |
| Free-to-paid conversion | Users with first active Stripe subscription / activated users. |
| Checkout conversion | Stripe checkout completions / `premium_checkout_started`. Stripe is truth for completion; PostHog explains drop-off. |
| Churn | Subscriptions cancelled or ended in period / active subscriptions at period start. |
| Refund rate | Refunded payment amount / gross payment amount. |

## Reliability And Quality

| Metric | Definition |
| --- | --- |
| Crash-free sessions | Sentry sessions without unhandled errors / total Sentry sessions. |
| Frontend error rate | Sentry issue/error events / sessions. |
| Capture failure rate | `camera_permission_failed` + `video_upload_failed` / `capture_intent`. |
| Median upload completion time | Time between `video_upload_started` and `video_upload_succeeded` when both events are present. |
| Montage failure rate | `user_montages.status = 'failed'` / all montage jobs in period. |

## Buyer Diligence Notes

- Prefer Supabase and Stripe for final financial/content claims.
- Use PostHog for funnel, cohort, and behavioral explanations.
- Use Plausible for acquisition trendlines and campaign performance.
- Export monthly snapshots so a future buyer can reproduce headline metrics without relying on dashboard screenshots.
