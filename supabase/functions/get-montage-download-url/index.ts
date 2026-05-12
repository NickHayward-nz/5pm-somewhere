// © 2026 Chromatic Productions Ltd. All rights reserved.
// Returns a short-lived signed MP4 URL for a ready montage owned by the signed-in user.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type Body = {
  montageId?: unknown
}

type MontageRow = {
  id: string
  user_id: string
  kind: 'weekly' | 'monthly'
  period_start: string
  status: string
  storage_path: string | null
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function fallbackStoragePath(row: MontageRow): string {
  const periodDate = new Date(row.period_start).toISOString().slice(0, 10)
  return `${row.user_id}/${row.kind}-${periodDate}-${row.id.slice(0, 8)}.mp4`
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

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return jsonResponse({ error: 'Invalid JSON.' }, 400)
  }

  if (typeof body.montageId !== 'string' || !body.montageId) {
    return jsonResponse({ error: 'Missing montageId.' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Invalid session.' }, 401)
  }

  const { data: row, error: rowError } = await admin
    .from('user_montages')
    .select('id, user_id, kind, period_start, status, storage_path')
    .eq('id', body.montageId)
    .eq('user_id', userData.user.id)
    .maybeSingle<MontageRow>()

  if (rowError) {
    console.error('get-montage-download-url: montage lookup failed', rowError)
    return jsonResponse({ error: 'Could not load montage.' }, 500)
  }
  if (!row) return jsonResponse({ error: 'Montage not found.' }, 404)
  if (row.status !== 'ready') return jsonResponse({ error: 'Montage is not ready yet.' }, 409)

  const storagePath = row.storage_path || fallbackStoragePath(row)
  const { data: signed, error: signError } = await admin.storage
    .from('montages')
    .createSignedUrl(storagePath, 10 * 60, {
      download: `5pm-${row.kind}-montage-${row.period_start.slice(0, 10)}.mp4`,
    })

  if (signError || !signed?.signedUrl) {
    console.error('get-montage-download-url: signed URL failed', signError, { storagePath })
    return jsonResponse({ error: 'Could not create download link.' }, 500)
  }

  return jsonResponse({
    signedUrl: signed.signedUrl,
    expiresIn: 10 * 60,
    filename: `5pm-${row.kind}-montage-${row.period_start.slice(0, 10)}.mp4`,
  })
})
