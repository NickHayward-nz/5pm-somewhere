# 5PM Somewhere

**5PM Somewhere** is a daily global video ritual: people post one short video when it hits **5:00 PM where they are**, then watch real 5PM moments move around the world as each timezone reaches evening.

Production app: <https://5pmsomewhere.live>

## Product summary

Simple explanation:

> See what 5PM looks like around the world. Post one short video when it hits 5PM where you are, and watch the day move across the globe through real people's moments.

Core loop:

1. Visitor understands the ritual.
2. User signs in during their local 5PM window.
3. User records and uploads a short moment.
4. Their moment appears in the live stream.
5. The success screen nudges them to watch, share, and enable tomorrow's reminder.
6. Repeat uploads build streaks, reach, memories, and Premium montage value.

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind-style utility classes
- Hosting/PWA: Vercel + `vite-plugin-pwa`
- Auth/database/storage/functions: Supabase
- Payments: Stripe Checkout + Billing Portal via Supabase Edge Functions
- Email auth delivery: Supabase Auth SMTP via Resend
- Analytics/monitoring: PostHog, Plausible, Sentry
- Media: browser MediaRecorder/canvas capture, Supabase private `moments` bucket, signed video URLs

## Important production boundaries

This is a public video app, but the public surface is intentionally narrow:

- Public visitors may watch current public live-stream moments.
- Raw video storage is private.
- Browser playback uses signed URLs from `get-moment-video-url`.
- Public clients should not query the base `moments` table directly.
- Public clients should not be able to list storage objects.
- Reports go to `moment_reports` and are intended for admin/service-role review.

## Local development

Prerequisites:

- Node.js 22+
- npm
- Deno, for Supabase Edge Function checks
- Supabase CLI, for linked-project migrations/functions
- Vercel CLI, for preview/production deploy operations

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build locally:

```bash
npm run build
```

## Verification commands

Run before opening or merging PRs:

```bash
npm run lint
npm run build
```

Run when Supabase Edge Functions or migrations are touched:

```bash
npm run check:edge
```

Run a lightweight production smoke check after deploys:

```bash
npm run check:production-smoke
```

Run the fuller launch gate:

```bash
npm run check:launch
```

`check:launch` is intentionally practical rather than exhaustive: lint, build, Edge Function checks, and a production smoke check.

## Deployment notes

Vercel/GitHub integration deploys merged `main` changes to production. Manual production deploys are still possible with:

```bash
vercel --prod
```

Supabase migrations are **not** applied by a normal Vercel frontend deploy. Apply reviewed production migrations deliberately:

```bash
supabase db push
```

Deploy Edge Functions deliberately when changed, for example:

```bash
npm run deploy:get-moment-video-url
npm run deploy:send-5pm-notifications
npm run deploy:stripe
```

## Supabase functions

Current function scripts live in `supabase/functions/` and are type/lint checked by:

```bash
npm run check:edge
```

Notable functions:

- `get-moment-video-url` — signed video URL access boundary
- `save-push-subscription` — stores browser push subscription
- `send-5pm-notifications` — notification delivery
- `create-checkout-session` — Stripe Checkout
- `create-billing-portal-session` — Stripe Customer Portal
- `stripe-webhook` — Stripe subscription entitlement sync
- `montage-cron` / `get-montage-download-url` — montage flow

## Launch readiness checklist

See [`docs/LAUNCH_READINESS_CHECKLIST.md`](docs/LAUNCH_READINESS_CHECKLIST.md).

## Approval/safety guardrails

Treat these as production-sensitive and review deliberately:

- production database/RLS/storage migrations
- Supabase function deploys
- Stripe products, prices, webhooks, secrets, refunds, subscriptions, portal config
- auth/SMTP/DNS changes
- destructive data cleanup
- public launch/publishing decisions
- dependency auto-fixes such as `npm audit fix`

## Project knowledge base

Durable project notes live in Nick's Obsidian vault:

```text
/mnt/c/Vaults/HermesVault/research/projects/5pm-somewhere/
```

Key notes include current state, roadmap, security hardening, payment readiness, onboarding/retention strategy, and operating workflow.
