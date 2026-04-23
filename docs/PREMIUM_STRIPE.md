# Premium subscription — Stripe setup

The web client never talks to Stripe directly. It calls two Supabase Edge
Functions, which own the Stripe secret key:

- `supabase/functions/create-checkout-session` → creates a Checkout session and
  returns the hosted URL the client redirects to.
- `supabase/functions/stripe-webhook` → receives Stripe webhook events and
  mirrors subscription state onto `profiles.is_premium` /
  `profiles.premium_expires_at`.

## 1. Create a Stripe account + product

1. Sign up / log in at https://dashboard.stripe.com.
2. **Product catalog → + Add product**. Name it e.g. "5PM Somewhere Premium".
3. Create a **recurring price** (e.g. $4.99 / month). Copy the price id
   (`price_123...`). This goes into `STRIPE_PRICE_ID`.
4. From **Developers → API keys**, copy the **Secret key** (`sk_test_...` in
   test mode, `sk_live_...` in live mode). This goes into
   `STRIPE_SECRET_KEY`.

## 2. Run the DB migration

Applies the new `profiles.stripe_customer_id`, `stripe_subscription_id`,
`premium_plan`, `premium_started_at`, `premium_expires_at` columns.

```bash
supabase db push
```

(Or apply `supabase/migrations/20260423120000_moment_priority_and_premium_fields.sql`
manually through the dashboard.)

## 3. Deploy the edge functions

```bash
# One-time: give the functions the Stripe / site secrets.
# Run each line in your shell (PowerShell users: use a normal terminal, not Cursor's).
supabase secrets set STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXX
supabase secrets set STRIPE_PRICE_ID=price_XXXXXXXXXXXXXXXX
supabase secrets set SITE_URL=https://your-production-domain.example

# Deploy (npm scripts wrap these):
npm run deploy:checkout-fn          # create-checkout-session
npm run deploy:stripe-webhook       # stripe-webhook (deployed with --no-verify-jwt)
```

## 4. Register the webhook in Stripe

1. Dashboard → **Developers → Webhooks → + Add endpoint**.
2. Endpoint URL: `https://<your-project-ref>.functions.supabase.co/stripe-webhook`.
3. Listen for these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing secret** (`whsec_...`). Save it to Supabase:

   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXX
   ```

5. Hit the **Send test webhook** button for `checkout.session.completed` and
   confirm `profiles.is_premium` flips on a test user.

## 5. Flow in the app

1. User taps **Upgrade** / **Go Premium**.
2. Client calls `startPremiumCheckout()` → Supabase function creates the
   session → client redirects to Stripe hosted checkout.
3. Stripe completes payment → redirects back to
   `SITE_URL/?checkout=success&session_id=...`.
4. In parallel, Stripe POSTs `checkout.session.completed` to the webhook
   function, which sets `is_premium = true` + `premium_expires_at`.
5. `useProfile` refetches on next mount; `App.tsx` surfaces a "Welcome to
   Premium" toast via `consumeCheckoutReturnStatus()`.

## 6. Local testing (recommended)

Use the Stripe CLI to forward events to your local edge function:

```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

Export `STRIPE_WEBHOOK_SECRET` from the `stripe listen` output when running
the function locally (`supabase functions serve stripe-webhook --env-file .env`).

## 7. Going to production

- Switch the dashboard from **Test mode** to **Live mode** and copy
  `sk_live_...` + the live-mode price id + the live-mode webhook secret.
- Update the three `supabase secrets set ...` calls accordingly.
- Re-deploy both functions.
- Deploy a new client build so `SITE_URL` redirects to the correct domain.

## 8. Apple / Google in-app purchase policy

If you distribute the native iOS / Android app through the stores **and**
premium unlocks digital content within the app, you are required to use
StoreKit (iOS) / Google Play Billing (Android) — Stripe is not allowed for
in-app subscriptions on mobile. Plan options:

- **Easiest**: keep premium purchases **web-only** (outside the native app)
  and render a "Manage subscription on the web" CTA in the native builds.
- **Full native**: swap the Capacitor `goPremium` flow for a native
  StoreKit/Billing plugin (e.g. `cordova-plugin-purchase`). The webhook will
  move from Stripe to App Store Server Notifications / Google Play RTDN —
  same concept, different inbound events.

Both options need separate work before submitting to the stores.
