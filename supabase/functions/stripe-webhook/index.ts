// © 2026 Chromatic Productions Ltd. All rights reserved.
//
// Supabase Edge Function: stripe-webhook
// --------------------------------------
// Receives Stripe webhook events and mirrors subscription state onto the
// `profiles` table. Configure in the Stripe dashboard pointing at:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
// with the signing secret exposed to the function as STRIPE_WEBHOOK_SECRET.
//
// Events handled:
//   checkout.session.completed       → first activation, set is_premium = true
//   customer.subscription.updated    → refresh period end / reactivate
//   customer.subscription.deleted    → downgrade on cancel
//   invoice.payment_failed           → leave premium set but log for retry
//
// IMPORTANT: this function MUST be deployed with --no-verify-jwt so Stripe
// (which doesn't send a Supabase JWT) can call it:
//   supabase functions deploy stripe-webhook --no-verify-jwt

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
   
  console.error('stripe-webhook: missing required env vars')
}

const stripe = new Stripe(stripeKey ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const admin = createClient(supabaseUrl ?? '', serviceRoleKey ?? '', {
  auth: { autoRefreshToken: false, persistSession: false },
})

function iso(ts?: number | null): string | null {
  if (!ts) return null
  return new Date(ts * 1000).toISOString()
}

async function setPremiumByCustomer(
  customerId: string,
  userId: string | null,
  args: {
    isPremium: boolean
    subscriptionId?: string | null
    plan?: string | null
    startedAt?: string | null
    expiresAt?: string | null
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    is_premium: args.isPremium,
  }
  if (args.subscriptionId !== undefined) patch.stripe_subscription_id = args.subscriptionId
  if (args.plan !== undefined) patch.premium_plan = args.plan
  if (args.startedAt !== undefined) patch.premium_started_at = args.startedAt
  if (args.expiresAt !== undefined) patch.premium_expires_at = args.expiresAt

  const { data, error } = await admin
    .from('profiles')
    .update(patch)
    .eq('stripe_customer_id', customerId)
    .select('id')
    .maybeSingle()
  if (error && error.code !== 'PGRST116') {
     
    console.error('stripe-webhook: profile update failed', error, { customerId })
  }
  if (data || !userId) return

  const { error: fallbackError } = await admin
    .from('profiles')
    .update({ ...patch, stripe_customer_id: customerId })
    .eq('id', userId)
  if (fallbackError) {
     
    console.error('stripe-webhook: fallback profile update failed', fallbackError, { customerId, userId })
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('missing_signature', { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret ?? '',
    )
  } catch (err) {
     
    console.error('Webhook signature verification failed:', err)
    return new Response('invalid_signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id ?? null
        const userId = session.client_reference_id ?? null
        if (!customerId) break

        // Pull the subscription so we know the current period end.
        let expiresAt: string | null = null
        let plan: string | null = null
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          expiresAt = iso(sub.current_period_end)
          plan = sub.items.data[0]?.price.id ?? null
        }

        await setPremiumByCustomer(customerId, userId, {
          isPremium: true,
          subscriptionId,
          plan,
          startedAt: new Date().toISOString(),
          expiresAt,
        })
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const isActive = sub.status === 'active' || sub.status === 'trialing'
        await setPremiumByCustomer(customerId, sub.metadata.supabase_user_id ?? null, {
          isPremium: isActive,
          subscriptionId: sub.id,
          plan: sub.items.data[0]?.price.id ?? null,
          expiresAt: iso(sub.current_period_end),
        })
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        await setPremiumByCustomer(customerId, sub.metadata.supabase_user_id ?? null, {
          isPremium: false,
          subscriptionId: null,
          expiresAt: iso(sub.current_period_end),
        })
        break
      }
      case 'invoice.payment_failed': {
        // Leave premium state as-is; Stripe will retry and fire
        // customer.subscription.updated if things change. Log for ops.
        const invoice = event.data.object as Stripe.Invoice
         
        console.warn('invoice.payment_failed', { customer: invoice.customer })
        break
      }
      default:
        // Unhandled events return 200 so Stripe doesn't retry.
        break
    }
  } catch (err) {
     
    console.error('stripe-webhook handler error:', err)
    return new Response('handler_error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
