# Implementation notes — 2026-04-23

Delivered in this change:

## 1. Live-stream queue priority formula

Implemented in `src/lib/capture.ts` as `computeLiveStreamPriority(streak, isPremium)`:

```
basePriority = 100
streakBonus  = currentStreak * 25
premiumBonus = isPremium ? 80 : 0
total        = base + streak + premium
```

Written onto every new `moments` row in `RecordMoment.upload()` as
`uploader_streak_priority`. `LiveStream.tsx` already orders by that column
descending, so premium + streak users naturally bubble to the top of the
queue. Old rows with legacy 0–4 priorities will rank below new uploads,
which is correct (they're also older).

The legacy `getStreakPriorityForUpload` is kept as a compile-time shim so
nothing else breaks.

## 2. Share button on success

After a successful upload, the success overlay now shows **Share this
moment 📤**. On tap:

- `src/lib/share.ts::prepareShareableVideo` takes the recorded WebM blob
  and, for **free users only**, re-encodes each frame through a canvas
  with a sunset gradient border baked in. Audio is preserved via
  `AudioContext → MediaStreamAudioDestinationNode`.
- Premium users skip the re-encode because the border is already baked
  into the recording (see §3).
- `shareVideoNatively` picks the best share surface:
  1. Capacitor native build → `@capacitor/share` (real iOS/Android share sheet).
  2. Web Share API with files → `navigator.share({ files })`.
  3. Web Share API without files → share caption + link, download file.
  4. No share API → download file, copy caption to clipboard.
- The caption always contains `Captured at 5PM Somewhere → <origin URL>`.

## 3. Premium benefits (audit)

| Benefit | Status | Location |
| --- | --- | --- |
| 3 daily uploads | Already implemented | `App.tsx` → `maxUploadsPerDay = isPremium ? 3 : …` |
| 5:00–5:07 recording window (+2 min over free) | Updated | `src/lib/capture.ts` → `baseMaxMinutes = isPremium ? 7 : 5` |
| 30s video length (10s longer) | Already implemented | `RecordMoment.tsx` → `MAX_SEC = isPremium ? 30 : 20` |
| Unlimited storage | Already implemented | `RecordMoment.tsx` → `pruneExcessMomentsForFreeUser` runs only for `!isPremium` |
| Live-stream priority +80 flat | Implemented | See §1 |
| Weekly + Monthly montages | Already implemented | `ProfileMenu.tsx` + `workers/montage-worker.mjs` |
| Thin sunset-gradient border on video | Implemented | `RecordMoment.tsx` `drawFrame()` calls `drawSunsetBorder` when `isPremium` |

## 4. Native iOS / Android app (Capacitor)

Scaffold in place. Already done:

- `capacitor.config.ts` (root).
- Capacitor dependencies installed.
- `cap:*` npm scripts wired up.
- `shareVideoNatively` now uses the Capacitor Share plugin when running
  inside a native build.

**Still to do (requires macOS/Android Studio/paid accounts):**

- Run `npm run cap:add:android` → commits the generated `android/` folder.
- Run `npm run cap:add:ios` **on a Mac** → commits `ios/`.
- Code-signing certificates (Apple Developer, Google Play).
- Store listings + screenshots + privacy forms.

See `docs/CAPACITOR_NATIVE_APPS.md` for the full runbook.

## 5. Premium payment (Stripe)

End-to-end flow built:

- `src/lib/premium.ts::startPremiumCheckout` — invokes the edge function,
  returns a Checkout URL.
- `src/lib/premium.ts::consumeCheckoutReturnStatus` — reads
  `?checkout=success|cancelled` off the URL after Stripe redirects back.
- `supabase/functions/create-checkout-session/index.ts` — creates (and
  caches) a Stripe customer, opens a Checkout session for the premium price.
- `supabase/functions/stripe-webhook/index.ts` — handles
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`. Writes
  `is_premium`, `premium_plan`, `premium_started_at`, `premium_expires_at`,
  `stripe_subscription_id` onto the matching profile.
- DB migration `20260423120000_moment_priority_and_premium_fields.sql`
  adds the Stripe/premium columns + `uploader_is_premium` on moments +
  priority index.
- `App.tsx` Upgrade button and `ProfileMenu.tsx` Premium button now call
  the real Stripe flow instead of the `?premium=1` localStorage hack.

**What you still need to do:**

1. Create a Stripe account + product + price (§1 of
   `docs/PREMIUM_STRIPE.md`).
2. Run the new migration (`supabase db push`).
3. Set secrets and deploy the functions:

   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   supabase secrets set STRIPE_PRICE_ID=price_...
   supabase secrets set SITE_URL=https://5pmsomewhere.app
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   npm run deploy:checkout-fn
   npm run deploy:stripe-webhook
   ```

4. Register the webhook endpoint in the Stripe dashboard.

See `docs/PREMIUM_STRIPE.md` for the full runbook and caveats (notably the
App Store/Play Store policy on in-app subscriptions).

## Files changed

- `src/lib/capture.ts` — new `computeLiveStreamPriority`, updated window logic.
- `src/lib/share.ts` — **new**, post-processing + share sheet.
- `src/lib/premium.ts` — **new**, Stripe client helpers.
- `src/components/RecordMoment.tsx` — share button, premium border, new priority.
- `src/components/ProfileMenu.tsx` — real Go Premium action.
- `src/App.tsx` — Upgrade button, checkout return toast.
- `capacitor.config.ts` — **new**.
- `package.json` — Capacitor deps + cap:/deploy: scripts.
- `.env.example` — Stripe env vars.
- `supabase/migrations/20260423120000_moment_priority_and_premium_fields.sql` — **new**.
- `supabase/functions/create-checkout-session/index.ts` — **new**.
- `supabase/functions/stripe-webhook/index.ts` — **new**.
- `docs/PREMIUM_STRIPE.md`, `docs/CAPACITOR_NATIVE_APPS.md` — **new**.
