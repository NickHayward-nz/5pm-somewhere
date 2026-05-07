// © 2026 Chromatic Productions Ltd. All rights reserved.
// Supabase Edge Function: save-push-subscription
// Authenticated clients call this after PushManager.subscribe().

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type SavePushBody = {
  subscription?: {
    endpoint?: unknown
    keys?: {
      p256dh?: unknown
      auth?: unknown
    }
  }
  userAgent?: unknown
}

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
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server not configured.' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonResponse({ error: 'Missing auth token.' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Invalid session.' }, 401)
  }

  let body: SavePushBody
  try {
    body = (await req.json()) as SavePushBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON.' }, 400)
  }

  const subscription = body?.subscription
  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const authSecret = subscription?.keys?.auth

  if (
    typeof endpoint !== 'string' ||
    typeof p256dh !== 'string' ||
    typeof authSecret !== 'string'
  ) {
    return jsonResponse({ error: 'Invalid push subscription.' }, 400)
  }

  const { data, error } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userData.user.id,
        endpoint,
        p256dh,
        auth_secret: authSecret,
        user_agent: typeof body?.userAgent === 'string' ? body.userAgent : null,
        active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
    .select('id')
    .single()

  if (error) {
    console.error('save-push-subscription: upsert failed', error)
    return jsonResponse({ error: 'Could not save push subscription.' }, 500)
  }

  return jsonResponse({ ok: true, id: data.id })
})
