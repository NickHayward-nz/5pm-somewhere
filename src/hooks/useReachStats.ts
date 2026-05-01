// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useCallback, useEffect, useState } from 'react'
import { fetchMyReachStats, type ReachStats } from '../lib/reach'

const EMPTY_REACH_STATS: ReachStats = {
  totalViews: 0,
  globalRank: null,
}

export function useReachStats(userId: string | null) {
  const [stats, setStats] = useState<ReachStats>(EMPTY_REACH_STATS)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!userId) {
      setStats(EMPTY_REACH_STATS)
      return
    }

    setLoading(true)
    const nextStats = await fetchMyReachStats()
    setStats(nextStats)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!userId) return

    const handleFocus = () => {
      void refetch()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [refetch, userId])

  return { stats, loading, refetch }
}
