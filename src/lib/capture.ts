import { DateTime } from 'luxon'
import { getSupabase } from './supabase'
import { captureEvent } from './analytics'

export type CaptureWindowState = {
  active: boolean
  diffMinutes: number
  label: string
}

export function getUserTimezone(fallback = 'Pacific/Auckland'): string {
  try {
    const stored = localStorage.getItem('fivepm_tz')
    if (stored) return stored
  } catch {
    // ignore
  }
  return fallback
}

export function computeCaptureWindow(
  now: DateTime,
  userTz: string,
  isPremium: boolean,
): CaptureWindowState {
  const local = now.setZone(userTz)
  const diffMinutes = (local.hour - 17) * 60 + local.minute

  // We want the capture window to start exactly at 5:00 PM local time (diffMinutes >= 0),
  // and last for 5 minutes for free users and 8 minutes for premium users.
  const maxMinutes = isPremium ? 8 : 5
  const active = diffMinutes >= 0 && diffMinutes <= maxMinutes
  const label = isPremium ? '8 min premium window (from 5:00 PM)' : '5 min free window (from 5:00 PM)'
  return { active, diffMinutes, label }
}

/** Returns true if last_post_date is today in the user's timezone (Luxon). */
export function hasPostedToday(lastPostDate: string | null, userTz: string): boolean {
  if (!lastPostDate) return false
  const tz = userTz || 'Pacific/Auckland'
  const today = DateTime.now().setZone(tz).startOf('day')
  const last = DateTime.fromISO(lastPostDate, { zone: tz }).startOf('day')
  return last.equals(today)
}

export type ProfileStreak = {
  last_post_date: string | null
  current_streak: number
  longest_streak: number
}

/** Compute new streak after a post today in userTz. */
export function computeStreakAfterPost(
  userTz: string,
  previous: ProfileStreak,
): { last_post_date: string; current_streak: number; longest_streak: number } {
  const now = DateTime.now().setZone(userTz)
  const todayStr = now.toFormat('yyyy-MM-dd')
  const prevLast = previous.last_post_date
    ? DateTime.fromISO(previous.last_post_date, { zone: userTz }).startOf('day')
    : null
  const todayStart = now.startOf('day')
  let current = previous.current_streak
  if (!prevLast) {
    current = 1
  } else if (prevLast.equals(todayStart)) {
    current = previous.current_streak
  } else if (prevLast.plus({ days: 1 }).equals(todayStart)) {
    current = previous.current_streak + 1
  } else {
    current = 1
  }
  const longest = Math.max(previous.longest_streak, current)
  return { last_post_date: todayStr, current_streak: current, longest_streak: longest }
}

export async function updateProfileAfterUpload(
  userId: string,
  userTz: string,
  previous: ProfileStreak,
): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const next = computeStreakAfterPost(userTz, previous)
  await sb
    .from('profiles')
    .update({
      last_post_date: next.last_post_date,
      current_streak: next.current_streak,
      longest_streak: next.longest_streak,
    })
    .eq('id', userId)
}

export function trackCaptureStarted(metadata: Record<string, unknown>) {
  captureEvent('capture_started', metadata)
}

export function trackVideoUploaded(metadata: Record<string, unknown>) {
  captureEvent('video_uploaded', metadata)
}

export function trackDailyLimitHit(metadata: Record<string, unknown>) {
  captureEvent('daily_limit_hit', metadata)
}

