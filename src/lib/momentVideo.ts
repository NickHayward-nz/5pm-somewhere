// © 2026 Chromatic Productions Ltd. All rights reserved.
import type { SupabaseClient } from '@supabase/supabase-js'

type SignedMomentVideoResponse = {
  signedUrl?: string
  expiresIn?: number
  error?: string
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export function clearMomentVideoUrlCache(momentId?: string): void {
  if (momentId) {
    signedUrlCache.delete(momentId)
    return
  }
  signedUrlCache.clear()
}

export async function getSignedMomentVideoUrl(
  sb: SupabaseClient,
  momentId: string,
): Promise<string> {
  const cached = signedUrlCache.get(momentId)
  // Refresh one minute before expiry so playback/share fetches do not race an
  // expiring URL.
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url
  }

  const { data, error } = await sb.functions.invoke<SignedMomentVideoResponse>(
    'get-moment-video-url',
    { body: { momentId } },
  )

  if (error) throw error
  if (!data?.signedUrl) {
    throw new Error(data?.error || 'Could not create video link.')
  }

  const ttlMs = Math.max(60, data.expiresIn ?? 600) * 1000
  signedUrlCache.set(momentId, {
    url: data.signedUrl,
    expiresAt: Date.now() + ttlMs,
  })
  return data.signedUrl
}

export async function getPlayableMomentVideoUrl(params: {
  sb: SupabaseClient | null
  momentId: string
  fallbackUrl?: string | null
}): Promise<string> {
  const { sb, momentId, fallbackUrl } = params
  if (sb) {
    try {
      return await getSignedMomentVideoUrl(sb, momentId)
    } catch (error) {
      console.error('Failed to get signed moment video URL:', error)
    }
  }
  if (fallbackUrl) return fallbackUrl
  throw new Error('Moment video is unavailable.')
}
