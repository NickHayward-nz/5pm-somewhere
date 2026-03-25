// © 2026 Chromatic Productions Ltd. All rights reserved.
import { getSupabase } from './supabase'

export type StreamStatus =
  | { ok: true; url: string }
  | { ok: false; reason: 'missing_env' | 'not_found' | 'error' }

export async function getLiveStreamUrl(): Promise<StreamStatus> {
  // Option A: plain env var (fast path)
  const envUrl = import.meta.env.VITE_LIVE_STREAM_URL as string | undefined
  if (envUrl) return { ok: true, url: envUrl }

  // Option B: Supabase row (optional)
  const sb = getSupabase()
  if (!sb) return { ok: false, reason: 'missing_env' }

  try {
    const { data, error } = await sb
      .from('live_streams')
      .select('url,is_live')
      .eq('is_live', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { ok: false, reason: 'error' }
    if (!data?.url) return { ok: false, reason: 'not_found' }
    return { ok: true, url: data.url }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

