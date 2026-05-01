// © 2026 Chromatic Productions Ltd. All rights reserved.
//
// Supabase Edge Function: create-billing-portal-session
// ------------------------------------------------------
// Creates a Stripe Billing Portal session for the authenticated premium user
// and returns the hosted portal URL. The client redirects the browser there so
// users can manage payment methods, invoices, and cancellation.

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
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://5pmsomewhere.app'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeKey || !supabaseUrl || !serviceRoleKey) {
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) {
    return jsonResponse({ error: 'Invalid session.' }, 401)
  }

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileErr) {
    return jsonResponse({ error: 'Could not load billing profile.' }, 500)
  }
  if (!profile?.stripe_customer_id) {
    return jsonResponse({ error: 'No Stripe customer is linked to this account yet.' }, 404)
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: siteUrl,
  })

  return jsonResponse({ url: session.url })
})
