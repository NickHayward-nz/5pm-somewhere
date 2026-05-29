# Stripe — go live checklist

Use this when moving from **test mode** to **live** payments. The app code does not embed Stripe keys; everything runs through Supabase Edge Function secrets.

**Your Supabase project ref:** `wegnktslfdcdfpglkqka`  
**Live webhook URL (register in Stripe *live* mode):**

```text
https://wegnktslfdcdfpglkqka.functions.supabase.co/stripe-webhook
```

---

## Part A — Your steps (Stripe Dashboard + secrets)

### 1. Finish Stripe account activation

1. Open [Stripe Dashboard](https://dashboard.stripe.com).
2. Complete **Settings → Business** (identity, bank account, payout details) until Stripe shows your account can accept live payments.

### 2. Create the live product and price

1. Toggle the dashboard from **Test mode** to **Live mode** (top-right).
2. **Product catalog → + Add product** — e.g. “5PM Somewhere Premium”.
3. Add a **recurring** price (same amount/interval you used in test).
4. Copy the **live** price id (`price_...`). It is different from your test price id.

### 3. Copy live API keys

1. **Developers → API keys** (still in **Live mode**).
2. Copy the **Secret key** (`sk_live_...`). Do not paste it into git or the frontend.

### 4. Configure the live Customer Portal

1. **Settings → Billing → Customer portal** (Live mode).
2. Enable cancellation / payment-method updates to match your policy (see `PolicyLegalContent`).

### 5. Register a **live** webhook endpoint

Test and live webhooks are separate. In **Live mode**:

1. **Developers → Webhooks → + Add endpoint**.
2. URL: `https://wegnktslfdcdfpglkqka.functions.supabase.co/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing secret** (`whsec_...`) for the **live** endpoint only.

You can leave the old **test** webhook in place for local/dev; production Supabase secrets must use the **live** signing secret.

### 6. Update Supabase secrets (live values)

From a terminal in this repo (PowerShell is fine):

```powershell
cd c:\Users\OEM\5pm-somewhere

supabase secrets set STRIPE_SECRET_KEY=sk_live_REPLACE_ME
supabase secrets set STRIPE_PRICE_ID=price_REPLACE_ME
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
supabase secrets set SITE_URL=https://5pmsomewhere.live
```

Replace the three `REPLACE_ME` values with your live Stripe values.

### 7. Redeploy Stripe Edge Functions

After secrets are set:

```powershell
npm run deploy:stripe
```

### 8. Smoke-test with a real card

1. Open https://5pmsomewhere.live (signed in with a test account).
2. Start **Upgrade / Go Premium** — Checkout should show **live** mode (no “Test mode” banner in Stripe).
3. Complete payment with a real card (you can cancel in the Billing Portal afterward).
4. Confirm:
   - Redirect back with “Welcome to Premium”.
   - In Supabase **Table Editor → profiles**, your row has `is_premium = true` and live `stripe_customer_id` / `stripe_subscription_id`.
   - In Stripe **Live → Customers**, the customer and subscription appear.

### 9. (Optional) Clear test-only premium rows

Test checkouts do not entitle live premium. The checkout function auto-clears stale test `stripe_customer_id` when someone upgrades again. To reset everyone at once before launch:

```sql
-- Run in Supabase SQL Editor once, before or right after go-live:
update public.profiles
set
  stripe_customer_id = null,
  stripe_subscription_id = null,
  is_premium = false,
  premium_plan = null,
  premium_started_at = null,
  premium_expires_at = null
where stripe_customer_id is not null;
```

Only run this if you are sure no one has a **live** subscription yet.

---

## Part B — Already handled in the repo

| Item | Notes |
|------|--------|
| No Stripe keys in the client | Checkout uses `create-checkout-session` only. |
| Stale test customer ids | Checkout clears invalid ids and creates a live customer. |
| `?premium=1` dev bypass | Disabled in production builds (`import.meta.env.DEV` only). |
| Deploy script | `npm run deploy:stripe` deploys all three Stripe functions. |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Checkout 500 / “not configured” | Missing `STRIPE_SECRET_KEY` or `STRIPE_PRICE_ID` in Supabase secrets. |
| Webhook 400 `invalid_signature` | `STRIPE_WEBHOOK_SECRET` does not match the **live** endpoint signing secret. |
| Paid in Checkout but not premium | Live webhook not registered or failing — check Stripe **Developers → Webhooks →** endpoint logs. |
| “No such customer” on upgrade | Old test `stripe_customer_id`; fixed on next checkout after deploy (or run SQL above). |
| Billing portal fails | User has no live Stripe customer yet — complete checkout once. |

See also `docs/PREMIUM_STRIPE.md` for architecture and local testing.
