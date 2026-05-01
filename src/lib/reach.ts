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

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  return 0
}

export async function incrementMomentView(momentId: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.rpc('increment_moment_view', {
    p_moment_id: momentId,
  })
  if (error) {
    console.error('Failed to increment moment view:', error)
  }
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
