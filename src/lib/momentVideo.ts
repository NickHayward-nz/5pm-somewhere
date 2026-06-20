// © 2026 Chromatic Productions Ltd. All rights reserved.
import type { SupabaseClient } from '@supabase/supabase-js'

type SignedMomentVideoResponse = {
  signedUrl?: string
  expiresIn?: number
  contentType?: string | null
  usedPlaybackRendition?: boolean
  error?: string
}

type PlaybackRenditionPreferenceOptions = {
  preferPlayback?: boolean
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

function cacheKey(momentId: string, preferPlayback: boolean): string {
  return `${momentId}:${preferPlayback ? 'playback' : 'original'}`
}

export function shouldPreferPlaybackRendition(nav: Pick<Navigator, 'userAgent' | 'vendor'> | null | undefined): boolean {
  if (!nav) return false
  const userAgent = nav.userAgent || ''
  const vendor = nav.vendor || ''
  const isiOS = /iPad|iPhone|iPod/.test(userAgent)
  const isIPadOS = /Macintosh/.test(userAgent) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1
  const isSafari = /Safari/.test(userAgent) && !/Chrome|Chromium|Android|Edg|OPR|Firefox|FxiOS/.test(userAgent)
  const isAppleVendor = /Apple/i.test(vendor)

  return isiOS || isIPadOS || (isSafari && isAppleVendor)
}

export function clearMomentVideoUrlCache(momentId?: string): void {
  if (momentId) {
    signedUrlCache.delete(cacheKey(momentId, false))
    signedUrlCache.delete(cacheKey(momentId, true))
    return
  }
  signedUrlCache.clear()
}

export async function getSignedMomentVideoUrl(
  sb: SupabaseClient,
  momentId: string,
  options: PlaybackRenditionPreferenceOptions = {},
): Promise<string> {
  const preferPlayback = options.preferPlayback === true
  const key = cacheKey(momentId, preferPlayback)
  const cached = signedUrlCache.get(key)
  // Refresh one minute before expiry so playback/share fetches do not race an
  // expiring URL.
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url
  }

  const { data, error } = await sb.functions.invoke<SignedMomentVideoResponse>(
    'get-moment-video-url',
    { body: { momentId, preferPlayback } },
  )

  if (error) throw error
  if (!data?.signedUrl) {
    throw new Error(data?.error || 'Could not create video link.')
  }

  const ttlMs = Math.max(60, data.expiresIn ?? 600) * 1000
  signedUrlCache.set(key, {
    url: data.signedUrl,
    expiresAt: Date.now() + ttlMs,
  })
  return data.signedUrl
}

export async function getPlayableMomentVideoUrl(params: {
  sb: SupabaseClient | null
  momentId: string
  fallbackUrl?: string | null
  preferPlayback?: boolean
}): Promise<string> {
  const { sb, momentId, fallbackUrl, preferPlayback = false } = params
  if (sb) {
    try {
      return await getSignedMomentVideoUrl(sb, momentId, { preferPlayback })
    } catch (error) {
      console.error('Failed to get signed moment video URL:', error)
    }
  }
  if (fallbackUrl) return fallbackUrl
  throw new Error('Moment video is unavailable.')
}
