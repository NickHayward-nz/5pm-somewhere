// © 2026 Chromatic Productions Ltd. All rights reserved.
import type { SupabaseClient } from '@supabase/supabase-js'

/** Max capture moments kept for non‑premium users (newest wins). */
export const FREE_USER_MOMENT_LIMIT = 7

/** Extract storage object path from a Supabase public URL for the `moments` bucket. */
export function momentsStoragePathFromPublicUrl(videoUrl: string): string | null {
  try {
    const u = new URL(videoUrl)
    const marker = '/object/public/moments/'
    const i = u.pathname.indexOf(marker)
    if (i === -1) return null
    return decodeURIComponent(u.pathname.slice(i + marker.length))
  } catch {
    return null
  }
}

/**
 * For free users only: keep the newest FREE_USER_MOMENT_LIMIT rows; remove older files and DB rows.
 * Does not touch `user_montages` or the `montages` bucket (premium montage outputs).
 */
export async function pruneExcessMomentsForFreeUser(
  sb: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: rows, error: selErr } = await sb
    .from('moments')
    .select('id, video_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (selErr || !rows?.length || rows.length <= FREE_USER_MOMENT_LIMIT) return

  const excess = rows.slice(FREE_USER_MOMENT_LIMIT)
  const ids = excess.map((r) => r.id)
  const paths = excess
    .map((r) => momentsStoragePathFromPublicUrl(r.video_url))
    .filter((p): p is string => Boolean(p))

  const { error: rxErr } = await sb.from('user_reactions').delete().in('moment_id', ids)
  if (rxErr) {
     
    console.warn('momentsRetention: user_reactions delete', rxErr.message)
  }

  if (paths.length > 0) {
    const { error: stErr } = await sb.storage.from('moments').remove(paths)
    if (stErr) {
       
      console.warn('momentsRetention: storage remove', stErr.message)
    }
  }

  const { error: delErr } = await sb.from('moments').delete().in('id', ids)
  if (delErr) {
     
    console.warn('momentsRetention: moments delete', delErr.message)
  }
}
