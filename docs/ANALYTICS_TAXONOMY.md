# Analytics Taxonomy

This document defines the product analytics contract for 5PM Somewhere. Keep it current whenever a new event is added, renamed, or removed.

## Principles

- PostHog is the primary product analytics system for behavior, funnels, cohorts, and retention.
- Plausible is the lightweight growth analytics system for traffic, pageviews, and top-of-funnel conversion events.
- Supabase Postgres and Stripe remain the source of truth for content, users, subscriptions, payments, and revenue.
- Sentry is the source of truth for client-side reliability, frontend errors, performance, and replay-on-error.
- Do not send raw video, captions, access tokens, payment data, or secrets to analytics tools.
- User identity should be the Supabase user id. Email is excluded by default unless `VITE_ANALYTICS_INCLUDE_EMAIL=true`.

## Identity

`identifyUser()` is called after Supabase auth/profile state is available.

Standard user traits:

| Trait | Meaning |
| --- | --- |
| `is_premium` | Current premium status from `profiles.is_premium`. |
| `timezone` | Current profile timezone or local fallback. |
| `current_streak` | Current streak from `profiles.current_streak`. |
| `total_uploads` | Lifetime uploads from `profiles.total_uploads`. |

On sign-out, `resetAnalytics()` clears PostHog and Sentry identity.

## Event Naming

Use snake_case event names and snake_case property names. Include ids for joins where useful:

- `userId` or identified PostHog distinct id joins to `profiles.id`.
- `moment_id` joins to `moments.id`.
- `montage_id` joins to `user_montages.id`.

## Event Dictionary

### Page And Acquisition

| Event | Trigger | Key properties |
| --- | --- | --- |
| `page_view` | Main app, `/share`, or `/how-it-works` page view (PostHog). Plausible receives manual `pageview` with sanitized absolute `u` (no query/hash). | `path`, `url` (PostHog only; Plausible props exclude identifiers) |
| `profile_share_result` | User shares the profile/share landing link. | `result` |

### Auth

| Event | Trigger | Key properties |
| --- | --- | --- |
| `auth_sign_in_started` | Google OAuth flow starts. | `provider` |
| `auth_sign_in_failed` | Google OAuth start fails. | `provider` |
| `auth_magic_link_requested` | Email magic link requested. | `provider` |
| `auth_magic_link_failed` | Email magic link request fails. | `provider` |
| `auth_signed_in` | Supabase auth state becomes signed in. | `auth_event` |
| `auth_signed_out` | Supabase auth state becomes signed out. | none |

### Capture And Upload

| Event | Trigger | Key properties |
| --- | --- | --- |
| `capture_intent` | User taps Capture. | `active_window`, `is_premium`, `uploads_today`, `max_uploads_per_day`, `streak_days` |
| `capture_blocked` | Capture cannot proceed. | `reason`, `diff_minutes`, `timezone` |
| `capture_modal_opened` | Recording modal opens. | `is_premium`, `timezone` |
| `upload_terms_accepted` | First upload terms are accepted. | `userId` |
| `camera_permission_requested` | Camera/mic permission requested. | `is_premium`, `timezone` |
| `camera_permission_granted` | Camera/mic permission granted. | `is_premium`, `timezone` |
| `camera_permission_failed` | Camera/mic permission fails. | `error_name`, `is_premium`, `timezone` |
| `capture_started` | MediaRecorder begins recording. | `userId`, `isPremium`, `tz`, `city`, `country` |
| `recording_too_short` | User stops before minimum duration. | `duration_sec`, `min_sec`, `is_premium` |
| `recording_stopped` | User stops recording successfully. | `duration_sec`, `is_premium` |
| `video_upload_started` | Upload begins. | `duration_sec`, `is_premium`, `timezone`, `city`, `country` |
| `video_storage_uploaded` | Storage upload succeeds. | `duration_sec`, `is_premium` |
| `video_uploaded` | Existing legacy upload success event. | `userId`, `durationSec`, `isPremium`, `tz` |
| `video_upload_succeeded` | End-to-end upload succeeds. | `duration_sec`, `is_premium`, `timezone`, `city`, `country`, `streak_days_before_upload`, `total_uploads_before_upload` |
| `video_upload_failed` | Upload flow fails. | `error_name`, `duration_sec`, `is_premium` |
| `daily_limit_hit` | User hits daily upload cap. | `userId`, `tz`, `uploads_today`, `max_uploads_per_day` |

### Live Stream And Reactions

| Event | Trigger | Key properties |
| --- | --- | --- |
| `live_stream_opened` | Live stream opens and queue loads. | `queue_size`, `current_streak` |
| `moment_viewed` | Non-owner plays a moment. | `moment_id`, `owner_user_id`, `viewer_signed_in` |
| `moment_reaction_toggled` | User adds/removes a reaction. | `moment_id`, `reaction_type`, `state`, `signed_in` |

### Sharing

| Event | Trigger | Key properties |
| --- | --- | --- |
| `video_share_started` | User starts sharing a moment. | `surface`, `moment_id`, `city`, `is_premium` |
| `video_share_result` | Share completes or falls back. | `surface`, `result`, `moment_id`, `is_premium` |
| `video_share_failed` | Share preparation fails. | `surface`, `error_name` |

### Premium And Billing

| Event | Trigger | Key properties |
| --- | --- | --- |
| `premium_checkout_cta_clicked` | User clicks a Premium upgrade CTA. | `surface` |
| `premium_checkout_started` | Checkout helper starts. | none |
| `premium_checkout_failed` | Checkout helper fails. | `reason` |
| `premium_checkout_session_created` | Checkout session URL is returned. | none |
| `premium_checkout_returned` | User returns from Stripe Checkout. | `status` |
| `billing_portal_cta_clicked` | User clicks Manage subscription. | `surface` |
| `billing_portal_started` | Billing portal helper starts. | none |
| `billing_portal_failed` | Billing portal helper fails. | `reason` |
| `billing_portal_session_created` | Billing portal URL is returned. | none |

### Montages

| Event | Trigger | Key properties |
| --- | --- | --- |
| `montage_opened` | User opens weekly/monthly montage modal. | `kind` |
| `montage_load_result` | Montage query resolves. | `kind`, `result`, `montage_id`, `montage_status` |
| `montage_share_started` | Montage share starts. | `kind`, `montage_id` |
| `montage_share_result` | Montage share completes or falls back. | `kind`, `montage_id`, `result` |
| `montage_share_failed` | Montage share fails. | `kind`, `montage_id`, `error_name` |

## Plausible Growth Events

Plausible's script records pageviews/visitors directly. Only selected conversion events are forwarded as custom goals:

- `auth_sign_in_started`
- `auth_magic_link_requested`
- `auth_signed_in`
- `capture_intent`
- `capture_started`
- `video_uploaded`
- `video_share_result`
- `profile_share_result`
- `premium_checkout_started`
- `premium_checkout_returned`
