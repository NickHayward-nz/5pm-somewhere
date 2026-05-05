// © 2026 Chromatic Productions Ltd. All rights reserved.
import { getSupabase } from './supabase'

export type ReachStats = {
  totalViews: number
  globalRank: number | null
}

type ReachStatsRow = {
  total_views: number | string | null
  global_rank: number | string | null
}

const EMPTY_REACH_STATS: ReachStats = {
  totalViews: 0,
  globalRank: null,
}

const VIEWER_KEY_STORAGE = 'fivepm_reach_viewer_key'

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  return 0
}

function createViewerKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

function getViewerKey(): string {
  if (typeof window === 'undefined') return createViewerKey()
  try {
    const existing = localStorage.getItem(VIEWER_KEY_STORAGE)
    if (existing) return existing
    const next = createViewerKey()
    localStorage.setItem(VIEWER_KEY_STORAGE, next)
    return next
  } catch {
    return createViewerKey()
  }
}

export function formatReachViews(totalViews: number): string {
  const formatted = new Intl.NumberFormat().format(totalViews)
  return totalViews === 1
    ? `${formatted} person has seen your moments`
    : `${formatted} people have seen your moments`
}

export async function incrementMomentView(momentId: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false

  const { data, error } = await sb.rpc('increment_moment_view', {
    p_moment_id: momentId,
    p_viewer_key: getViewerKey(),
  })
  if (error) {
    console.error('Failed to increment moment view:', error)
    return false
  }
  return data === true
}

export async function fetchMyReachStats(): Promise<ReachStats> {
  const sb = getSupabase()
  if (!sb) return EMPTY_REACH_STATS

  const { data, error } = await sb.rpc('get_my_reach_stats')
  if (error) {
    console.error('Failed to fetch reach stats:', error)
    return EMPTY_REACH_STATS
  }

  const row = Array.isArray(data) ? (data[0] as ReachStatsRow | undefined) : (data as ReachStatsRow | null)
  if (!row) return EMPTY_REACH_STATS

  const globalRank = row.global_rank == null ? null : toNumber(row.global_rank)
  return {
    totalViews: toNumber(row.total_views),
    globalRank: globalRank && globalRank > 0 ? globalRank : null,
  }
}
