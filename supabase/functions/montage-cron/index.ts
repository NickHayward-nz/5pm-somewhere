// Thin trigger: validate CRON_SECRET, forward job to Vercel worker with MONTAGE_WORKER_SECRET.
// Schedule: Supabase pg_cron (or external cron) POSTs here with Authorization: Bearer CRON_SECRET
// Body or ?type= weekly | monthly | both

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const cronSecret = Deno.env.get('CRON_SECRET')
  const auth = req.headers.get('Authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const workerUrl = Deno.env.get('VERCEL_MONTAGE_WORKER_URL')
  const workerSecret = Deno.env.get('MONTAGE_WORKER_SECRET')
  if (!workerUrl || !workerSecret) {
    return new Response(
      JSON.stringify({ error: 'Missing VERCEL_MONTAGE_WORKER_URL or MONTAGE_WORKER_SECRET' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let type: 'weekly' | 'monthly' | 'both' = 'weekly'
  try {
    const body = await req.json()
    if (body?.type === 'monthly' || body?.type === 'both' || body?.type === 'weekly') {
      type = body.type
    }
  } catch {
    /* ignore */
  }
  const q = new URL(req.url).searchParams.get('type')
  if (q === 'monthly' || q === 'both' || q === 'weekly') type = q

  const r = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type }),
  })
  const text = await r.text()
  return new Response(text, {
    status: r.status,
    headers: { 'Content-Type': 'application/json' },
  })
})
