// © 2026 Chromatic Productions Ltd. All rights reserved.
//
// Supabase Edge Function: create-checkout-session
// ------------------------------------------------
// Creates a Stripe Checkout session for the authenticated user and returns
// the hosted-checkout URL. The client redirects the browser to that URL;
// on completion Stripe sends a `checkout.session.completed` event to the
// `stripe-webhook` function, which flips `profiles.is_premium`.
//
// Expected secrets (set via `supabase secrets set ...`):
//   STRIPE_SECRET_KEY              Stripe API secret key (sk_live_... or sk_test_...)
//   STRIPE_PRICE_ID                The price id for the premium subscription
//   SITE_URL                       Public URL of the web app (success/cancel redirect)
//   SUPABASE_URL                   Already provided by the Edge runtime
//   SUPABASE_SERVICE_ROLE_KEY      Already provided by the Edge runtime
//
// Invoked from the client:
//   await supabase.functions.invoke('create-checkout-session')
// Requires the user to be authenticated (Authorization header forwarded
// automatically by supabase-js).

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const priceId = Deno.env.get('STRIPE_PRICE_ID')
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://5pmsomewhere.app'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeKey || !priceId || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: 'Server not configured (missing Stripe or Supabase env).' },
      500,
    )
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) {
    return jsonResponse({ error: 'Missing auth token.' }, 401)
  }

  // Validate the caller and load their profile. The service-role client
  // is used so we can read/write the profile without RLS friction.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) {
    return jsonResponse({ error: 'Invalid session.' }, 401)
  }
  const user = userData.user

  // Look up (or create) the Stripe customer. We cache the customer id on
  // the profile so repeat purchases don't create duplicate customers.
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, is_premium')
    .eq('id', user.id)
    .maybeSingle()

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  let customerId = profile?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    // Propagate the supabase user id through to the webhook so we can
    // flip the right row when the session completes.
    client_reference_id: user.id,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    success_url: `${siteUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/?checkout=cancelled`,
  })

  return jsonResponse({ url: session.url })
})
