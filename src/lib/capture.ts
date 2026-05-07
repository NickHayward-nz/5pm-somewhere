// © 2026 Chromatic Productions Ltd. All rights reserved.
import { DateTime } from 'luxon'
import { getSupabase } from './supabase'
import { captureEvent } from './analytics'

export type CaptureWindowState = {
  active: boolean
  diffMinutes: number
  label: string
}

export type StreakTier = {
  minDays: number
  name: string
  perks: string[]
  visibilityBoost:
    | 'none'
    | 'small'
    | 'medium'
    | 'large'
    | 'very_large'
    | 'permanent_medium'
  extraWindowMinutes?: number
  extraDailyUploads?: number
  boostHours?: number
  badge?: string
  grantPremiumDays?: number
}

export const STREAK_TIERS: StreakTier[] = [
  {
    minDays: 3,
    name: '3 days',
    perks: ['Small visibility boost', 'Slight priority in the live stream queue'],
    visibilityBoost: 'small',
    boostHours: 24,
  },
  {
    minDays: 7,
    name: '7 days',
    perks: ['Medium visibility boost', 'Moderate priority in the live stream queue (24h)'],
    visibilityBoost: 'medium',
    boostHours: 24,
  },
  {
    minDays: 14,
    name: '14 days',
    perks: [
      'Larger visibility boost',
      'Significant queue priority',
      'Unlock +2 minutes recording window (5:00 PM–5:07 PM)',
    ],
    visibilityBoost: 'large',
    extraWindowMinutes: 2,
    boostHours: 24,
  },
  {
    minDays: 30,
    name: '30 days',
    perks: [
      'Permanent extra daily upload (2 uploads/day for free users)',
      'Big visibility boost for the next 48 hours',
    ],
    visibilityBoost: 'very_large',
    extraDailyUploads: 1,
    boostHours: 48,
  },
  {
    minDays: 60,
    name: '60 days',
    perks: [
      'Even larger visibility boost',
      'Major queue priority boost (near the top of the stream for 48 hours)',
    ],
    visibilityBoost: 'very_large',
    boostHours: 48,
  },
  {
    minDays: 90,
    name: '90 days – Quarter Master',
    perks: ['Special badge', 'Exclusive frame/border on profile and moments'],
    visibilityBoost: 'very_large',
    badge: 'Quarter Master',
    boostHours: 72,
  },
  {
    minDays: 180,
    name: '180 days – Half-Year Hero',
    perks: ['Permanent medium queue priority boost', 'Special badge'],
    visibilityBoost: 'permanent_medium',
    badge: 'Half-Year Hero',
  },
  {
    minDays: 365,
    name: '365 days – Full Year Legend',
    perks: ['Lifetime prestige badge', 'One-time 30 days of Premium'],
    visibilityBoost: 'permanent_medium',
    badge: 'Full Year Legend',
    grantPremiumDays: 30,
  },
]

export function getStreakTier(currentStreak: number | null | undefined): StreakTier | null {
  if (!currentStreak || currentStreak <= 0) return null
  const eligible = STREAK_TIERS.filter((t) => currentStreak >= t.minDays)
  if (!eligible.length) return null
  return eligible.sort((a, b) => b.minDays - a.minDays)[0]
}

/**
 * Compute the live-stream queue priority for an upload.
 *
 * Formula (per spec):
 *   basePriority = 100
 *   streakBonus  = currentStreak * 25     // +25 per consecutive day
 *   premiumBonus = isPremium ? 80 : 0     // flat premium boost
 *   firstUploadBonus = 5000/3000/1500     // uploads 1/2/3 get a big launch boost
 *   total        = base + streak + premium + firstUploadBonus
 *
 * The returned value is stored on `moments.uploader_streak_priority` at insert time
 * and used as the primary sort key in LiveStream's queue query.
 *
 * Also returns `boostHours` from the legacy tier system so existing freshness logic
 * (visibility_boost_expires_at) keeps working. For users with no tier, boost is
 * undefined (queue priority still applies for the standard LIVE_WINDOW_MINUTES).
 */
export function computeLiveStreamPriority(
  currentStreak: number | null | undefined,
  isPremium: boolean,
  totalUploadsBeforeCurrent?: number | null,
): { days: number; priority: number; boostHours?: number } {
  const streak = Math.max(0, currentStreak ?? 0)
  const totalUploads = Math.max(0, totalUploadsBeforeCurrent ?? 0)
  const basePriority = 100
  const streakBonus = streak * 25
  const premiumBonus = isPremium ? 80 : 0
  const newUploaderBonus = totalUploads === 0 ? 5000 : totalUploads === 1 ? 3000 : totalUploads === 2 ? 1500 : 0
  const priority = basePriority + streakBonus + premiumBonus + newUploaderBonus

  const tier = getStreakTier(streak)
  return {
    days: tier?.minDays ?? streak,
    priority,
    boostHours: tier?.boostHours,
  }
}

/** @deprecated Use {@link computeLiveStreamPriority}. Kept as a shim so older call sites keep compiling. */
export function getStreakPriorityForUpload(
  currentStreak: number | null | undefined,
): { days: number; priority: number; boostHours?: number } | null {
  if (!currentStreak || currentStreak <= 0) return null
  return computeLiveStreamPriority(currentStreak, false)
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
  currentStreak: number | null | undefined,
): CaptureWindowState {
  const local = now.setZone(userTz)
  const diffMinutes = (local.hour - 17) * 60 + local.minute

  // Base capture windows (minutes after 5:00 PM local time):
  //   Free users    → 5 min  (5:00–5:05)
  //   Premium users → 7 min  (5:00–5:07), a flat +2 minutes over free per spec
  // Streak tiers may add additional minutes on top of the base window.
  const baseMaxMinutes = isPremium ? 7 : 5
  const tier = getStreakTier(currentStreak)
  const extra = tier?.extraWindowMinutes ?? 0
  const maxMinutes = baseMaxMinutes + extra
  const active = diffMinutes >= 0 && diffMinutes <= maxMinutes
  const label = isPremium
    ? `${maxMinutes} min premium window (from 5:00 PM${extra ? ' • streak bonus' : ''})`
    : `${maxMinutes} min free window (from 5:00 PM${extra ? ' • streak bonus' : ''})`
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
  total_uploads: number
}

function getDailyUploadKey(userId: string, userTz: string): string {
  const tz = userTz || 'Pacific/Auckland'
  const today = DateTime.now().setZone(tz).toFormat('yyyy-LL-dd')
  return `fivepm_uploads_${userId}_${today}`
}

export function getUploadsToday(userId: string | null, userTz: string): number {
  if (!userId) return 0
  const key = getDailyUploadKey(userId, userTz)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return 0
    const parsed = Number.parseInt(raw, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  } catch {
    return 0
  }
}

export function incrementUploadsToday(userId: string | null, userTz: string): void {
  if (!userId) return
  const key = getDailyUploadKey(userId, userTz)
  try {
    const current = getUploadsToday(userId, userTz)
    localStorage.setItem(key, String(current + 1))
  } catch {
    // ignore
  }
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
      total_uploads: Math.max(0, previous.total_uploads ?? 0) + 1,
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

