// © 2026 Chromatic Productions Ltd. All rights reserved.
//
// Client-side helpers for the premium subscription flow.
//
// The web client never talks to Stripe directly: it calls the
// `create-checkout-session` Supabase Edge Function, which owns the Stripe
// secret key. The function returns a Checkout URL; the client just
// redirects. After payment Stripe calls `stripe-webhook`, which flips
// `profiles.is_premium`, and the user is redirected back to the app with
// `?checkout=success`.

import { getSupabase } from './supabase'

export type StartCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

/**
 * Create a Stripe Checkout session via the edge function and return the
 * hosted-checkout URL. The caller is expected to set
 * `window.location.href` to that URL.
 */
export async function startPremiumCheckout(): Promise<StartCheckoutResult> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Supabase client is not configured.' }

  const { data: sessionData } = await sb.auth.getSession()
  if (!sessionData.session) {
    return { ok: false, error: 'You need to sign in before upgrading to premium.' }
  }

  const { data, error } = await sb.functions.invoke<{ url?: string; error?: string }>(
    'create-checkout-session',
    { body: {} },
  )

  if (error) {
    return { ok: false, error: error.message ?? 'Checkout failed to start.' }
  }
  if (!data?.url) {
    return { ok: false, error: data?.error ?? 'Checkout did not return a URL.' }
  }
  return { ok: true, url: data.url }
}

/**
 * Create a Stripe Billing Portal session via the edge function and return the
 * hosted portal URL. Premium users can manage payment details and cancellation
 * from Stripe's hosted UI.
 */
export async function startBillingPortal(): Promise<StartCheckoutResult> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Supabase client is not configured.' }

  const { data: sessionData } = await sb.auth.getSession()
  if (!sessionData.session) {
    return { ok: false, error: 'You need to sign in before managing your subscription.' }
  }

  const { data, error } = await sb.functions.invoke<{ url?: string; error?: string }>(
    'create-billing-portal-session',
    { body: {} },
  )

  if (error) {
    return { ok: false, error: error.message ?? 'Billing portal failed to open.' }
  }
  if (!data?.url) {
    return { ok: false, error: data?.error ?? 'Billing portal did not return a URL.' }
  }
  return { ok: true, url: data.url }
}

export type CheckoutReturnStatus = 'success' | 'cancelled' | null

/**
 * Read `?checkout=success|cancelled` off the current URL (populated by the
 * Stripe redirect) and strip the params so refreshes don't re-trigger.
 */
export function consumeCheckoutReturnStatus(): CheckoutReturnStatus {
  if (typeof window === 'undefined') return null
  try {
    const url = new URL(window.location.href)
    const status = url.searchParams.get('checkout')
    if (status !== 'success' && status !== 'cancelled') return null

    url.searchParams.delete('checkout')
    url.searchParams.delete('session_id')
    window.history.replaceState({}, '', url.toString())
    return status
  } catch {
    return null
  }
}
