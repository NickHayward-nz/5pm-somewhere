// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '../lib/supabase'
import type { Profile } from '../types/profile'

type ProfileRow = {
  id: string
  is_premium?: boolean | null
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
      const { data, error: e } = await sb
        .from('profiles')
        .select('id, is_premium')
        .eq('id', userId)
        .single<ProfileRow>()
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
          await sb.from('profiles').upsert(
            { id: userId, is_premium: false },
            { onConflict: 'id' },
          )
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
        timezone: 'Pacific/Auckland',
        current_streak: 0,
        longest_streak: 0,
        last_post_date: null,
        upload_terms_accepted_at: null,
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
