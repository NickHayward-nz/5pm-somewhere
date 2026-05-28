# 5PM Somewhere — Hermes Handover Report for Cursor

Date: 2026-05-28
Prepared by: Hermes / Helmet
Repo/worktree reviewed: `/mnt/c/Projects/5pm-source-of-truth-audit/integration-main-pc-recovery`
Live app: https://5pmsomewhere.live

## Important operating constraints

This handover is for Cursor continuation.

Hermes was working in a local integration/recovery worktree only.

Hermes did **not**:

- commit
- push
- deploy
- link a Supabase project
- access production Supabase
- access production Stripe
- make Stripe dashboard/API changes

The last requested action from the user was to produce this handover only and make no code changes beyond creating this markdown report.

## Critical source-of-truth warning

Persistent project memory says:

> For 5PM Somewhere, the laptop repo at `/mnt/c/Projects/5pm-somewhere` is an inspection copy copied from a hard drive, not currently the source of truth. Do not deploy from it or push it unless the user explicitly promotes it after comparing against the original Cursor/main PC repo and GitHub.

This handover concerns the integration/recovery worktree:

`/mnt/c/Projects/5pm-source-of-truth-audit/integration-main-pc-recovery`

Before Cursor commits/pushes/deploys anything, confirm this worktree has been reconciled against the true source-of-truth repo/main PC Cursor copy and GitHub.

---

# Executive summary

Hermes resumed a production-readiness review of the 5PM Somewhere app.

The app’s normal frontend checks were green after privacy fixes:

- TypeScript check passed
- ESLint passed
- production build passed
- PWA/service worker build passed

A final focused review identified and fixed two analytics privacy blockers in `src/lib/analytics.ts`:

1. Plausible was receiving stable user identifiers in event props.
2. Plausible manual pageviews were sending a path-only `u` value instead of a URL.

After patching, frontend verification passed.

Supabase Edge Function validation was then attempted locally with Deno. Deno was installed manually by the user. Hermes ran local Deno checks only, with no deploy/link/production access.

Deno results:

- 7 of 8 Edge Function `deno check` runs passed.
- `send-5pm-notifications/index.ts` failed local `deno check` because local Deno 2 could not resolve `npm:web-push@3.6.7` without Deno dependency config / node_modules handling.
- `deno fmt --check` failed because all Edge Function files are not formatted in Deno’s default style.
- `deno lint` failed mostly because Deno 2’s default linter rejects inline `https:` / `npm:` imports via `no-import-prefix`, and a few `deno-lint-ignore-file no-explicit-any` comments are now unused.

A recommended next cleanup pass was proposed: add a Supabase Edge Functions Deno validation config, decide how to handle `npm:web-push@3.6.7`, re-run Deno checks, then perform controlled npm dependency refresh. Hermes could not complete that pass because the local command approval layer repeatedly blocked even read-only inspection commands.

---

# Fixes performed by Hermes

## 1. Analytics privacy fixes

File modified:

- `src/lib/analytics.ts`

Issues fixed:

### A. Plausible event props were leaking stable identifiers

A focused privacy review found that Plausible was still receiving stable user identifiers via custom event properties, including values such as:

- `userId`
- `authUserId`
- potentially other ID/session/token-shaped keys

This was a privacy blocker because Plausible should receive privacy-safe aggregate growth events, not persistent user identifiers.

Fix implemented:

- Plausible props are now filtered before sending.
- The filter removes keys that look sensitive or identifying.

Filtered categories include:

- email-like keys
- exact `id`
- keys ending in `userId`
- distinct ID keys
- session ID keys
- token-like keys

The filter also only allows primitive Plausible-safe values:

- string
- number
- boolean

### B. Plausible manual pageviews used path-only URL

A focused review found manual Plausible pageviews were using a path-only value for `u`, but Plausible expects a URL.

Fix implemented:

- Manual Plausible pageviews now use a sanitized absolute URL.
- Query strings and hashes remain stripped.

So pageview URLs are now based on:

`window.location.origin + sanitized path`

not raw full URLs with query strings/hashes.

## 2. Analytics behaviour already present/confirmed after fixes

`src/lib/analytics.ts` now has/uses:

- PostHog initialization guarded by `VITE_POSTHOG_KEY`
- Plausible initialization guarded by `VITE_PLAUSIBLE_DOMAIN`
- PostHog autocapture off by default unless `VITE_POSTHOG_AUTOCAPTURE === 'true'`
- email omitted from analytics by default unless `VITE_ANALYTICS_INCLUDE_EMAIL === 'true'`
- explicit `capturePageView`
- explicit `identifyUser`
- explicit `resetAnalytics`
- Sentry/monitoring user integration via `setMonitoringUser` / `clearMonitoringUser`

---

# Checks Hermes ran

## Frontend checks after analytics patch

Hermes reported these checks passed after the analytics privacy patch:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Results:

- TypeScript passed
- ESLint passed
- production build passed
- PWA/service worker build passed

## Production build rerun during bundle-warning assessment

Hermes later reran:

```bash
npm run build
```

Result: passed.

Build output included:

```text
vite v7.3.1 building client environment for production...
✓ 422 modules transformed.
rendering chunks...
computing gzip size...
dist/manifest.webmanifest                            0.32 kB
dist/index.html                                      1.51 kB │ gzip:   0.62 kB
dist/assets/index-DyczGIYl.css                      41.96 kB │ gzip:   8.27 kB
dist/assets/workbox-window.prod.es5-BIl4cyR9.js      5.76 kB │ gzip:   2.37 kB
dist/assets/hls-D1fSjlvU.js                        523.08 kB │ gzip: 162.11 kB
dist/assets/index-BgCu1sQY.js                    1,086.77 kB │ gzip: 307.96 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 11.62s

PWA v0.20.5
Building src/sw.ts service worker ("es" format)...
✓ built in 534ms
PWA v0.20.5
mode      injectManifest
format:   es
precache  7 entries (1620.19 KiB)
files generated
  dist/sw.js
```

## Deno environment check

Ran:

```bash
deno --version
```

Result:

```text
deno 2.8.1 (stable, release, x86_64-unknown-linux-gnu)
v8 14.9.207.2-rusty
typescript 6.0.3
```

## Edge Function files detected

Hermes detected these Edge Function TypeScript files:

- `supabase/functions/_shared/stripeCustomer.ts`
- `supabase/functions/create-billing-portal-session/index.ts`
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/get-montage-download-url/index.ts`
- `supabase/functions/montage-cron/index.ts`
- `supabase/functions/save-push-subscription/index.ts`
- `supabase/functions/send-5pm-notifications/index.ts`
- `supabase/functions/stripe-webhook/index.ts`

## Deno format check

Ran:

```bash
deno fmt --check <all supabase/functions .ts files>
```

Result: failed.

Reason:

All 8 function files were not formatted according to Deno’s default formatter.

Observed style differences included:

- Deno wants double quotes instead of single quotes.
- Deno wants semicolons.
- Deno wants some long lines wrapped differently.

Example:

Current:

```ts
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
```

Deno default:

```ts
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
```

Assessment:

- Production risk: low.
- This is mostly style/formatter mismatch.
- It does not prove functions are broken.

## Deno lint

Ran:

```bash
deno lint <all supabase/functions .ts files>
```

Result: failed.

Main problems:

### A. `no-import-prefix`

Deno 2’s default lint rule dislikes inline `https:`, `jsr:`, or `npm:` imports unless dependencies are declared in `deno.json` / `package.json` and referenced by bare specifiers.

The Supabase functions currently use direct imports such as:

```ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import webpush from 'npm:web-push@3.6.7'
```

This caused most lint errors.

### B. `ban-unused-ignore`

Some files include:

```ts
// deno-lint-ignore-file no-explicit-any
```

Deno says some of those ignores are no longer needed.

Total lint problems observed:

- 21 problems across 8 files

Assessment:

- Production risk: low to medium.
- Mostly lint configuration mismatch with modern Deno 2.
- Supabase Edge Functions commonly use remote URL imports, so `no-import-prefix` may be inappropriate for this codebase unless imports are intentionally migrated to an import map.

## Deno type checks

Hermes ran `deno check` function-by-function.

Passed:

```bash
deno check supabase/functions/_shared/stripeCustomer.ts
deno check supabase/functions/create-billing-portal-session/index.ts
deno check supabase/functions/create-checkout-session/index.ts
deno check supabase/functions/get-montage-download-url/index.ts
deno check supabase/functions/montage-cron/index.ts
deno check supabase/functions/save-push-subscription/index.ts
deno check supabase/functions/stripe-webhook/index.ts
```

Failed:

```bash
deno check supabase/functions/send-5pm-notifications/index.ts
```

Failure:

```text
error: Could not find a matching package for 'npm:web-push@3.6.7' in the node_modules directory. Ensure you have all your JSR and npm dependencies listed in your deno.json or package.json, then run `deno install`. Alternatively, turn on auto-install by specifying `"nodeModulesDir": "auto"` in your deno.json file.
    at file:///mnt/c/Projects/5pm-source-of-truth-audit/integration-main-pc-recovery/supabase/functions/send-5pm-notifications/index.ts:7:21
```

Assessment:

- This is a local Deno 2 dependency-resolution issue.
- It is not proof that the Supabase runtime function is broken.
- However, it means Hermes did not obtain local type-validation proof for the push notification function.

---

# Files modified by Hermes during review

Known modified by Hermes:

- `src/lib/analytics.ts`

Observed dirty files at one point in the worktree, according to `git status --short` output captured before the approval layer started blocking:

```text
 M .env.example
 M docs/PREMIUM_STRIPE.md
 M package-lock.json
 M package.json
 M src/App.tsx
 M src/components/LiveStream.tsx
 M src/components/MyMoments.tsx
 M src/components/ProfileMenu.tsx
 M src/components/RecordMoment.tsx
 M src/components/SignInModal.tsx
 M src/lib/almostFiveReminder.ts
 M src/lib/analytics.ts
 M src/lib/capture.ts
 M src/lib/premium.ts
 M src/lib/time.ts
 M src/main.tsx
 M supabase/functions/create-billing-portal-session/index.ts
 M supabase/functions/create-checkout-session/index.ts
?? deno.lock
?? docs/ANALYTICS_TAXONOMY.md
?? docs/METRICS.md
?? docs/STRIPE_GO_LIVE.md
?? docs/WAREHOUSE_EXPORT.md
?? src/lib/monitoring.ts
?? supabase/functions/_shared/
```

Important notes:

- Not all of the above were necessarily modified by Hermes in the final resumed session. Some were already dirty from the broader integration/recovery work before context compaction.
- Hermes explicitly removed the transient `deno.lock` after Deno validation created it, so it should not remain unless recreated later.
- Cursor should inspect the full diff before deciding what to keep.

---

# Files created by Hermes / present as new files

Known created/present as untracked during review:

- `docs/ANALYTICS_TAXONOMY.md`
- `docs/METRICS.md`
- `docs/STRIPE_GO_LIVE.md`
- `docs/WAREHOUSE_EXPORT.md`
- `src/lib/monitoring.ts`
- `supabase/functions/_shared/stripeCustomer.ts`
- `5PM-SOMEWHERE-HERMES-HANDOVER.md` — this handover document

Transient file:

- `deno.lock` was created by Deno validation but removed by Hermes afterwards.

Again, Cursor should verify actual current state with:

```bash
git status --short
git diff --stat
git diff
```

---

# Detailed findings

## 1. Analytics / privacy

### Finding: Plausible custom props needed stricter scrubbing

Status: fixed in `src/lib/analytics.ts`.

Risk before fix:

- Plausible could receive stable identifiers, which weakens its privacy-preserving role.

Current status:

- Plausible props are filtered to remove email/id/session/token-like keys.
- Only string/number/boolean props are sent.

Remaining concern:

- Review event callsites to ensure no sensitive values are sent under unusual key names not caught by the current filter.
- Consider maintaining a whitelist of allowed Plausible props for maximum safety.

### Finding: Plausible pageview URL format was wrong

Status: fixed in `src/lib/analytics.ts`.

Risk before fix:

- Plausible manual pageviews might not be interpreted correctly.

Current status:

- `u` now receives a sanitized absolute URL.
- Query strings and hashes are stripped.

### Finding: PostHog autocapture is a privacy risk if enabled casually

Status: mitigated by default.

Current status:

- PostHog autocapture is disabled by default.
- It only enables when `VITE_POSTHOG_AUTOCAPTURE === 'true'`.

Recommendation:

- Keep autocapture off for launch unless PostHog masking rules are verified in staging.
- Treat `VITE_ANALYTICS_INCLUDE_EMAIL=true` as a deliberate explicit decision, not a default.

## 2. Monitoring / Sentry

`src/lib/monitoring.ts` exists as a new file in the dirty worktree.

Known from `src/lib/analytics.ts` diff:

- `identifyUser` calls `setMonitoringUser`.
- `resetAnalytics` calls `clearMonitoringUser`.
- Email is only passed into monitoring when `VITE_ANALYTICS_INCLUDE_EMAIL === 'true'`.

Recommendation:

- Cursor should inspect `src/lib/monitoring.ts` and confirm:
  - DSN is environment-gated.
  - PII behaviour is acceptable.
  - source maps / release config are understood before production.

## 3. Stripe / Premium billing

Files involved include:

- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/create-billing-portal-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/_shared/stripeCustomer.ts`
- `docs/PREMIUM_STRIPE.md`
- `docs/STRIPE_GO_LIVE.md`

Observed improvements in Edge Function code:

- `create-checkout-session` now imports `getValidStripeCustomerId` from shared helper.
- Existing stored Stripe customer IDs are validated before reuse.
- If a stored Stripe customer ID is not found in the configured Stripe account/mode, checkout returns a support-review error instead of silently creating a duplicate or mismatched state.
- New customer creation persists `stripe_customer_id` back to `profiles` and handles failure.

Important production-readiness note:

- Static/type checks are not enough for payments.
- Stripe checkout, billing portal, and webhook flows need controlled test-mode smoke testing before production.

Suggested Stripe smoke test checklist:

1. Create/confirm test Stripe price ID.
2. Set test secrets only in a staging/non-production Supabase environment.
3. Start checkout as authenticated user.
4. Complete checkout with Stripe test card.
5. Confirm webhook updates `profiles.is_premium`.
6. Confirm `stripe_customer_id`, `stripe_subscription_id`, `premium_plan`, `premium_started_at`, `premium_expires_at` fields are correct.
7. Open billing portal as same user.
8. Cancel subscription in Stripe test mode.
9. Confirm webhook downgrade path works.
10. Confirm repeated checkout does not create bad duplicate customer state.

## 4. Supabase Edge Functions / Deno validation

Current state:

- Most functions type-check locally under Deno.
- Deno lint/fmt is not clean.
- Push notification function cannot be locally type-checked without config/dependency handling for `npm:web-push@3.6.7`.

Risk:

- Medium for `send-5pm-notifications` until local validation or staging runtime validation is clean.
- Low/medium for lint/fmt config mismatch.

Recommended fix path:

Add a Supabase Edge Functions Deno validation config.

Likely location:

- `supabase/functions/deno.json`

A minimal config to make local validation less noisy could start with:

```json
{
  "nodeModulesDir": "auto",
  "lint": {
    "rules": {
      "exclude": ["no-import-prefix", "ban-unused-ignore"]
    }
  }
}
```

Notes:

- `nodeModulesDir: "auto"` addresses the local `npm:web-push@3.6.7` resolution issue without manually installing from Hermes.
- Excluding `no-import-prefix` is reasonable if the project intends to keep Supabase-style direct URL imports.
- Excluding `ban-unused-ignore` is optional. Better long-term: remove unused ignore comments.
- If Cursor prefers stricter Deno 2 style, migrate imports into a proper import map instead of excluding `no-import-prefix`.

After adding config, from `supabase/functions`, rerun:

```bash
deno fmt --check .
deno lint .
deno check _shared/stripeCustomer.ts
deno check create-billing-portal-session/index.ts
deno check create-checkout-session/index.ts
deno check get-montage-download-url/index.ts
deno check montage-cron/index.ts
deno check save-push-subscription/index.ts
deno check send-5pm-notifications/index.ts
deno check stripe-webhook/index.ts
```

If choosing to accept Deno formatting, run:

```bash
deno fmt .
```

Then review the diff carefully. This will likely be a large style-only diff.

## 5. Push notifications

File:

- `supabase/functions/send-5pm-notifications/index.ts`

Local Deno issue:

- `npm:web-push@3.6.7` could not be resolved by local Deno 2 without config.

Production concerns:

- Confirm Supabase Edge Runtime supports the current `npm:web-push` package path and APIs.
- Confirm VAPID keys are configured in the target environment.
- Confirm `CRON_SECRET` is set and strong.
- Confirm function is deployed with the correct JWT verification mode. Package scripts indicate:

```json
"deploy:send-5pm-notifications": "supabase functions deploy send-5pm-notifications --no-verify-jwt"
```

- Confirm only the cron caller can invoke it due to bearer secret check.
- Confirm `notification_delivery_log` uniqueness/idempotency constraints prevent duplicate sends.
- Confirm old/invalid subscriptions are deactivated on 404/410.

## 6. Bundle size / performance

Production build passes but has large chunk warnings:

- `hls-D1fSjlvU.js` — 523.08 kB minified, 162.11 kB gzip
- `index-BgCu1sQY.js` — 1,086.77 kB minified, 307.96 kB gzip

Assessment:

- Not a launch blocker by itself.
- Risk is performance/first-load, especially mobile.

Known good:

- `hls.js` is already dynamically imported in `src/components/ProfileMenu.tsx`:

```ts
import('hls.js')
```

Likely next optimization:

- Lazy-load the Globe / Three.js path.

Reason:

`src/App.tsx` statically imports:

```ts
import { Globe } from './components/Globe'
```

`src/components/Globe.tsx` imports heavy Three.js dependencies:

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
```

Recommendation:

- Defer this unless doing a focused performance pass.
- If patched, use `React.lazy` / dynamic import for Globe and visually test all layouts.

## 7. npm audit / dependency risk

Hermes reviewed npm audit findings but did not run `npm audit fix`.

There were 15 npm audit issues.

Practical risk split:

### More production-relevant

#### `posthog-js` dependency chain

Includes:

- `protobufjs` critical/high issues
- `dompurify` moderate XSS-related issues

This is the most relevant because `posthog-js` is bundled into the client app.

#### `@supabase/supabase-js` dependency chain

Includes:

- `ws` moderate issue

This is likely more Node/runtime relevant than browser-bundle exploitable, but still should be refreshed.

### Mostly dev/build tooling

- `vite`
- `postcss`
- `vite-plugin-pwa` / `workbox-build`
- `eslint`
- `picomatch`
- `brace-expansion`
- `serialize-javascript`
- `lodash`
- `fast-uri`
- `flatted`

Recommendation:

Do a controlled dependency refresh, not blind `npm audit fix`.

Suggested order:

1. `posthog-js`
2. `@supabase/supabase-js`
3. `vite`
4. `postcss`
5. `eslint`
6. `typescript-eslint`
7. `vite-plugin-pwa` separately because the current package has a Vite peer range issue and a larger jump may be required.

Known package versions from current `package.json`/lock observed during review:

- `@supabase/supabase-js`: `^2.49.1`
- `posthog-js`: `^1.357.1`
- `vite`: `^7.3.1`
- `vite-plugin-pwa`: `^0.20.5`
- package-lock showed installed `vite-plugin-pwa` `0.20.5` with peer dependency range around Vite 3/4/5, while project uses Vite 7. This should be reviewed.

Recommended commands for Cursor, read-only first:

```bash
npm audit
npm outdated
npm ls vite vite-plugin-pwa @supabase/supabase-js posthog-js
```

Then update deliberately, rerunning after each meaningful batch:

```bash
npm run lint
npm run build
```

Also rerun app smoke tests.

---

# Launch blockers

These are the items Hermes considers launch blockers or near-blockers before a serious production launch.

## Blocker 1: Source-of-truth reconciliation

Do not deploy/push from the laptop/integration worktree until it is reconciled with:

- original Cursor/main PC repo
- GitHub remote
- any production deployment source

Risk:

- Accidentally deploying stale/integration code.

## Blocker 2: Stripe/Premium real smoke test not completed

Static checks passed for much of the code, but payment systems need real test-mode end-to-end validation.

Risk:

- Users pay but premium state is not updated.
- Billing portal fails.
- Webhook verification/deployment mode wrong.
- Customer IDs mismatch between test/live modes.

## Blocker 3: `send-5pm-notifications` not locally type-validated

The function failed local `deno check` because of `npm:web-push@3.6.7` resolution.

Risk:

- Notification cron function may fail at deployment/runtime if Supabase Edge Runtime cannot handle that package as written.

## Blocker 4: Dependency/security refresh not complete

15 npm audit issues remain.

Risk:

- Some production-bundled dependencies, especially PostHog chain, have relevant security concerns.

## Blocker 5: Deno/Supabase validation config missing

Deno validation currently requires manual interpretation because lint/fmt/check are not configured for the project’s Edge Function style.

Risk:

- Future function changes may ship without reliable local validation.

---

# Production-readiness concerns

## Security/privacy

- Keep PostHog autocapture disabled unless deliberately approved after staging verification.
- Keep analytics email inclusion disabled unless deliberately approved.
- Re-review Plausible event props for privacy-safe whitelist.
- Confirm Sentry PII behaviour in `src/lib/monitoring.ts`.
- Confirm all public env vars are safe to expose.
- Confirm no service-role keys appear in frontend code or committed files.
- Confirm Supabase RLS policies are correct for profiles, moments, notification preferences, push subscriptions, delivery logs, and any premium-only data.

## Payments

- Test-mode Stripe checkout must be completed end-to-end.
- Webhook must be deployed with correct JWT verification setting.
- Webhook signing secret must be correct.
- Test/live mode customer ID mismatch must be handled. The shared `getValidStripeCustomerId` helper appears intended to mitigate this.
- Billing portal must be tested.
- Subscription cancellation/downgrade path must be tested.

## Supabase Edge Functions

- Add Deno validation config.
- Validate all functions cleanly.
- Confirm deploy flags:
  - `stripe-webhook` should use `--no-verify-jwt` because Stripe cannot send Supabase JWT.
  - `send-5pm-notifications` currently uses `--no-verify-jwt` and relies on `CRON_SECRET` bearer auth.
  - `get-montage-download-url` uses `--no-verify-jwt` according to package scripts; confirm internal auth logic is sufficient.
  - Checkout/billing functions scripts show `--no-verify-jwt`; code validates caller via forwarded auth token. Confirm this is deliberate and safe.

## Performance

- Main JS bundle is large.
- Lazy-load Globe/Three.js in a focused performance pass.
- Test mobile first load.
- Ensure PWA precache size is acceptable.

## PWA/service worker

- Build passes.
- Need browser smoke test after deployment:
  - first install
  - update flow
  - offline/fallback behaviour
  - service worker cache refresh after new deploy

## Notifications

- Validate VAPID keys.
- Validate browser permission flow.
- Validate subscription save function.
- Validate delivery cron with test data.
- Validate duplicate prevention through `notification_delivery_log`.
- Validate inactive subscription cleanup.

## Observability

- Confirm Sentry DSN/environment/release setup.
- Confirm analytics taxonomy docs match implementation.
- Confirm expected dashboards/events are available before launch.

---

# Recommended next steps for Cursor

## Step 1: Inspect current dirty state

From the integration worktree:

```bash
cd /mnt/c/Projects/5pm-source-of-truth-audit/integration-main-pc-recovery
git status --short
git diff --stat
git diff
```

Confirm which changes came from the integration pass and which should be kept.

## Step 2: Add Edge Function Deno validation config

Create:

`supabase/functions/deno.json`

Recommended starting point:

```json
{
  "nodeModulesDir": "auto",
  "lint": {
    "rules": {
      "exclude": ["no-import-prefix", "ban-unused-ignore"]
    }
  }
}
```

Alternative stricter path:

- Use imports/importMap in `deno.json`.
- Migrate direct URL imports to mapped specifiers.
- Remove unused lint ignores.

## Step 3: Re-run Deno validation

From `supabase/functions`:

```bash
deno fmt --check .
deno lint .
deno check _shared/stripeCustomer.ts
deno check create-billing-portal-session/index.ts
deno check create-checkout-session/index.ts
deno check get-montage-download-url/index.ts
deno check montage-cron/index.ts
deno check save-push-subscription/index.ts
deno check send-5pm-notifications/index.ts
deno check stripe-webhook/index.ts
```

If `send-5pm-notifications` still fails, investigate `npm:web-push@3.6.7` compatibility with Supabase Edge Runtime.

## Step 4: Decide whether to apply Deno formatting

Option A: Defer formatting to avoid noisy diff before source-of-truth reconciliation.

Option B: Run:

```bash
deno fmt .
```

Then review the resulting style-only diff.

## Step 5: Controlled dependency refresh

Do not use blind `npm audit fix` first.

Start with read-only assessment:

```bash
npm audit
npm outdated
npm ls posthog-js @supabase/supabase-js vite vite-plugin-pwa postcss eslint typescript-eslint
```

Then update in controlled batches, rerunning:

```bash
npm run lint
npm run build
```

Suggested priority:

1. `posthog-js`
2. `@supabase/supabase-js`
3. `vite`
4. `postcss`
5. `eslint` / `typescript-eslint`
6. `vite-plugin-pwa` separately and carefully

## Step 6: Stripe test-mode smoke test

Only after source-of-truth is settled and staging/test env is confirmed.

Do not use live Stripe until test-mode flow is proven.

## Step 7: Production launch checklist

Before launch:

- source-of-truth repo confirmed
- all intended diffs reviewed
- frontend typecheck/lint/build pass
- Deno function checks pass or exceptions documented
- npm audit risk accepted or fixed
- Stripe test-mode smoke passed
- Supabase RLS reviewed
- production secrets configured
- analytics privacy settings confirmed
- Sentry/monitoring confirmed
- PWA/browser smoke test passed
- deployment rollback plan ready

---

# Suggested Cursor prompt

If using Cursor to continue, paste something like:

```text
We are continuing the 5PM Somewhere production-readiness recovery work from Hermes.

Please read 5PM-SOMEWHERE-HERMES-HANDOVER.md first.

Constraints:
- Do not commit, push, deploy, link Supabase, access production, or change Stripe unless I explicitly approve.
- First inspect git status/diff and identify all dirty files.
- Add a Supabase Edge Functions Deno validation config if appropriate.
- Re-run Deno fmt/lint/check locally.
- Resolve the local npm:web-push@3.6.7 Deno validation issue if possible.
- Then perform read-only npm audit/outdated assessment and propose a controlled dependency refresh plan.
- Keep analytics privacy fixes intact.
- Treat source-of-truth reconciliation as a blocker before any deploy/push.
```

---

# Final status from Hermes

Completed:

- Analytics privacy blockers fixed.
- Frontend checks passed after analytics fixes.
- Production build/PWA build passed.
- Supabase Edge Functions locally checked with Deno where possible.
- Bundle warning assessed and recommended to defer.
- Dependency/security risk reviewed at high level.
- This handover report created.

Not completed:

- Edge Function Deno validation cleanup config.
- Clean Deno fmt/lint/check pass.
- Local type validation for `send-5pm-notifications`.
- Controlled dependency refresh.
- Stripe test-mode end-to-end smoke test.
- Source-of-truth reconciliation.
- Any commit/push/deploy.
