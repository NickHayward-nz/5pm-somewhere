// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '../lib/supabase'
import type { Profile } from '../types/profile'

type ProfileRow = {
  id: string
  is_premium?: boolean | null
  timezone?: string | null
  current_streak?: number | null
  longest_streak?: number | null
  last_post_date?: string | null
  upload_terms_accepted_at?: string | null
}

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(!!userId)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const sb = getSupabase()
    if (!sb) {
      setProfile(null)
      setLoading(false)
      return
    }
    try {
      let data: ProfileRow | null = null
      let e: any = null
      const selectAttempts = [
        'id, is_premium, timezone, current_streak, longest_streak, last_post_date, upload_terms_accepted_at',
        'id, is_premium, timezone, current_streak, longest_streak, last_post_date',
        'id, is_premium',
        'id',
      ]

      for (const select of selectAttempts) {
        const result = await sb.from('profiles').select(select).eq('id', userId).single()
        if (!result.error) {
          data = result.data as unknown as ProfileRow
          e = null
          break
        }
        e = result.error
        // eslint-disable-next-line no-console
        console.warn('Profile query failed:', { select, error: result.error })
        if (result.error.code === 'PGRST116') break
      }

      if (e) {
        if (e.code === 'PGRST116') {
          const defaultProfile: Profile = {
            id: userId,
            is_premium: false,
            timezone: 'Pacific/Auckland',
            current_streak: 0,
            longest_streak: 0,
            last_post_date: null,
            upload_terms_accepted_at: null,
          }
          await sb.from('profiles').upsert(defaultProfile, { onConflict: 'id' })
          setProfile(defaultProfile)
          return
        }
        throw e
      }
      if (!data) {
        throw new Error('No profile data')
      }
      setProfile({
        id: data.id,
        is_premium: Boolean(data.is_premium),
        timezone: (data.timezone as string) ?? 'Pacific/Auckland',
        current_streak: Number(data.current_streak) ?? 0,
        longest_streak: Number(data.longest_streak) ?? 0,
        last_post_date: (data.last_post_date as string | null) ?? null,
        upload_terms_accepted_at: (data.upload_terms_accepted_at as string | null) ?? null,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load profile'))
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { profile, loading, error, refetch }
}
