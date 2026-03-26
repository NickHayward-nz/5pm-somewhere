// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { CopyrightFooter } from './CopyrightFooter'

export type MomentRow = {
  id: string
  created_at: string
  timezone: string
  city: string
  country: string
  video_url: string
  caption: string | null
  duration: number
  pretty_count: number
  funny_count: number
  cheers_count: number
  uploader_streak_days?: number | null
  uploader_streak_priority?: number | null
  visibility_boost_expires_at?: string | null
}

const FETCH_LIMIT = 20
const PRELOAD_NEXT = 3
/** How far back (from now) uploads stay eligible for the live stream queue */
const LIVE_WINDOW_MINUTES = 90

const REACTION_FIELD_TO_TYPE: Record<'pretty_count' | 'funny_count' | 'cheers_count', 'pretty' | 'funny' | 'cheers'> = {
  pretty_count: 'pretty',
  funny_count: 'funny',
  cheers_count: 'cheers',
}

type Props = {
  open: boolean
  onClose: () => void
  userId?: string | null
}

const POSTER_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const REACTION_STORAGE_PREFIX = 'fivepm_react_'

function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'unknown'
  const parts = [
    navigator.userAgent,
    `${window.screen.width}x${window.screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ]
  const str = parts.join('|')
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return `fp_${h.toString(36)}`
}

function getReactionStorageKey(momentId: string, field: string): string {
  return `${REACTION_STORAGE_PREFIX}${momentId}_${field}_${getDeviceFingerprint()}`
}

function hasReacted(momentId: string, field: string): boolean {
  try {
    return localStorage.getItem(getReactionStorageKey(momentId, field)) === '1'
  } catch {
    return false
  }
}

export function LiveStream({ open, onClose, userId }: Props) {
  const [queue, setQueue] = useState<MomentRow[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null)
  const [prettyCount, setPrettyCount] = useState(0)
  const [funnyCount, setFunnyCount] = useState(0)
  const [cheersCount, setCheersCount] = useState(0)
  const [userReactions, setUserReactions] = useState({
    pretty: false,
    funny: false,
    cheers: false,
  })
  const [fetchFrozenUntil, setFetchFrozenUntil] = useState(0)
  const [lastReactionTime, setLastReactionTime] = useState(0)
  const currentVideoIdRef = useRef<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)
  const previousBlobUrlRef = useRef<string | null>(null)
  const urlToRevokeAfterLoadRef = useRef<string | null>(null)

  const fetchMore = useCallback(async () => {
    const sb = getSupabase()
    if (!sb || loadingMoreRef.current) return []
    loadingMoreRef.current = true
    const cutoff = new Date(Date.now() - LIVE_WINDOW_MINUTES * 60 * 1000).toISOString()
    const { data: videos, error } = await sb
      .from('moments')
      .select('*')
      .gte('created_at', cutoff)
      .order('uploader_streak_priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT)
    loadingMoreRef.current = false
    const list = (videos ?? []) as MomentRow[]
    // eslint-disable-next-line no-console
    console.log('Stream query returned:', list.length, 'videos')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Stream query error:', error)
      return []
    }
    if (list.length === 0) {
      // eslint-disable-next-line no-console
      console.log('No moments in the last', LIVE_WINDOW_MINUTES, 'minutes')
    }
    return list
  }, [])

  useEffect(() => {
    if (!open) return
    setQueue([])
    setCurrentIndex(0)
    setError(null)
    setLoading(true)
    fetchMore().then((rows) => {
      setQueue(rows)
      setLoading(false)
      if (rows.length === 0) {
        setError(
          `No moments in the last ${LIVE_WINDOW_MINUTES} minutes (1.5 hours) — check back soon.`,
        )
      }
    })
  }, [open, fetchMore])

  useEffect(() => {
    if (!open || queue.length === 0) return
    const nearEnd = currentIndex >= queue.length - 2
    if (nearEnd) {
      fetchMore().then((extra) => {
        if (extra.length > 0)
          setQueue((q) => {
            const ids = new Set(q.map((m) => m.id))
            const newOnes = extra.filter((m) => !ids.has(m.id))
            return newOnes.length ? [...q, ...newOnes] : q
          })
      })
    }
  }, [open, queue.length, currentIndex, fetchMore])

  const current = queue[currentIndex]
  const hasNext = currentIndex < queue.length - 1
  const hasPrev = currentIndex > 0

  const fetchReactionCounts = useCallback(
    async (momentId: string, options?: { force?: boolean }) => {
      // Skip normal fetches for a window after a recent reaction so we don't overwrite optimistic counts with stale data.
      // When navigating between videos, pass { force: true } so counts always sync from the server.
      if (
        !options?.force &&
        (Date.now() < fetchFrozenUntil || Date.now() - lastReactionTime < 15000)
      ) {
        // eslint-disable-next-line no-console
        console.log(
          'Fetch skipped - reaction freeze active until',
          new Date(
            Math.max(fetchFrozenUntil, lastReactionTime + 15000),
          ).toLocaleTimeString(),
        )
        return
      }
      const sb = getSupabase()
      if (!sb) return
      try {
        const { data, error } = await sb
          .from('moments')
          .select('pretty_count, funny_count, cheers_count')
          .eq('id', momentId)
          .single()
        // #region agent log
        fetch('http://127.0.0.1:7306/ingest/4ef3a4f4-1ac2-4982-a81c-532fdf430f25', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '75762d' },
          body: JSON.stringify({
            sessionId: '75762d',
            location: 'LiveStream.tsx:fetchReactionCounts',
            message: 'moments select reaction columns',
            data: {
              momentId,
              errCode: error?.code ?? null,
              errMsg: error?.message ?? null,
              rowKeys: data ? Object.keys(data as Record<string, unknown>) : [],
              pretty_count: (data as { pretty_count?: number } | null)?.pretty_count,
              funny_count: (data as { funny_count?: number } | null)?.funny_count,
              cheers_count: (data as { cheers_count?: number } | null)?.cheers_count,
            },
            timestamp: Date.now(),
            hypothesisId: 'H1',
          }),
        }).catch(() => {})
        // #endregion
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch reaction counts:', error)
          return
        }
        if (!data) {
          // eslint-disable-next-line no-console
          console.log('No moment row found for id:', momentId)
          try {
            await sb
              .from('moments')
              .insert({ id: momentId, pretty_count: 0, funny_count: 0, cheers_count: 0 })
            // eslint-disable-next-line no-console
            console.log('Inserted new moment row with initial counts')
          } catch (insertErr) {
            // eslint-disable-next-line no-console
            console.error('Failed to insert initial moment row:', insertErr)
          }
          return
        }
        setQueue((prevQueue) =>
          prevQueue.map((mom) =>
            mom.id === momentId
              ? {
                  ...mom,
                  pretty_count: data.pretty_count ?? mom.pretty_count,
                  funny_count: data.funny_count ?? mom.funny_count,
                  cheers_count: data.cheers_count ?? mom.cheers_count,
                }
              : mom,
          ),
        )
        if (currentVideoIdRef.current === momentId) {
          setPrettyCount(data.pretty_count ?? 0)
          setFunnyCount(data.funny_count ?? 0)
          setCheersCount(data.cheers_count ?? 0)
          if (userId) {
            const { data: myReactions } = await sb
              .from('user_reactions')
              .select('reaction_type')
              .eq('user_id', userId)
              .eq('moment_id', momentId)
            const types = new Set((myReactions ?? []).map((r: { reaction_type: string }) => r.reaction_type))
            setUserReactions({
              pretty: types.has('pretty'),
              funny: types.has('funny'),
              cheers: types.has('cheers'),
            })
          } else {
            setUserReactions({
              pretty: hasReacted(momentId, 'pretty_count'),
              funny: hasReacted(momentId, 'funny_count'),
              cheers: hasReacted(momentId, 'cheers_count'),
            })
          }
        }
        // eslint-disable-next-line no-console
        console.log('Normal fetch counts:', data)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch reaction counts:', e)
      }
    },
    [fetchFrozenUntil, lastReactionTime, userId],
  )

  const toggleReaction = useCallback(
    async (momentId: string, field: 'pretty_count' | 'funny_count' | 'cheers_count') => {
      const key = getReactionStorageKey(momentId, field)
      const sb = getSupabase()
      if (!sb) return

      const currentVideoId = current?.id
      if (momentId !== currentVideoId) return
      // #region agent log
      fetch('http://127.0.0.1:7306/ingest/4ef3a4f4-1ac2-4982-a81c-532fdf430f25', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '75762d' },
        body: JSON.stringify({
          sessionId: '75762d',
          location: 'LiveStream.tsx:toggleReaction:start',
          message: 'toggle reaction',
          data: { momentId, field, hasUserId: !!userId },
          timestamp: Date.now(),
          hypothesisId: 'H2',
        }),
      }).catch(() => {})
      // #endregion

      let alreadyReacted: boolean
      if (userId) {
        const reactionType = REACTION_FIELD_TO_TYPE[field]
        const { data } = await sb
          .from('user_reactions')
          .select('id')
          .eq('user_id', userId)
          .eq('moment_id', momentId)
          .eq('reaction_type', reactionType)
          .maybeSingle()
        alreadyReacted = !!data
      } else {
        try {
          alreadyReacted = localStorage.getItem(key) === '1'
        } catch {
          alreadyReacted = false
        }
      }

      if (alreadyReacted) {
        // Undo: decrement
        const newCount = Math.max(
          0,
          field === 'pretty_count' ? prettyCount - 1 : field === 'funny_count' ? funnyCount - 1 : cheersCount - 1,
        )
        setQueue((prevQueue) =>
          prevQueue.map((mom) =>
            mom.id === momentId ? { ...mom, [field]: newCount } : mom,
          ),
        )
        setPrettyCount(field === 'pretty_count' ? newCount : prettyCount)
        setFunnyCount(field === 'funny_count' ? newCount : funnyCount)
        setCheersCount(field === 'cheers_count' ? newCount : cheersCount)
        setUserReactions((u) => ({
          ...u,
          pretty: field === 'pretty_count' ? false : u.pretty,
          funny: field === 'funny_count' ? false : u.funny,
          cheers: field === 'cheers_count' ? false : u.cheers,
        }))
        if (!userId) {
          try {
            localStorage.removeItem(key)
          } catch {
            // ignore
          }
        }
        if (userId) {
          const { error: delErr } = await sb
            .from('user_reactions')
            .delete()
            .eq('user_id', userId)
            .eq('moment_id', momentId)
            .eq('reaction_type', REACTION_FIELD_TO_TYPE[field])
          if (delErr) {
            // eslint-disable-next-line no-console
            console.error('user_reactions delete (undo) failed:', delErr)
            const prevCount =
              field === 'pretty_count' ? prettyCount : field === 'funny_count' ? funnyCount : cheersCount
            setQueue((prevQueue) =>
              prevQueue.map((mom) =>
                mom.id === momentId ? { ...mom, [field]: prevCount } : mom,
              ),
            )
            setPrettyCount(field === 'pretty_count' ? prevCount : prettyCount)
            setFunnyCount(field === 'funny_count' ? prevCount : funnyCount)
            setCheersCount(field === 'cheers_count' ? prevCount : cheersCount)
            setUserReactions((u) => ({
              ...u,
              pretty: field === 'pretty_count' ? true : u.pretty,
              funny: field === 'funny_count' ? true : u.funny,
              cheers: field === 'cheers_count' ? true : u.cheers,
            }))
            return
          }
        }
      try {
        const { error } = await sb.from('moments').update({ [field]: newCount }).eq('id', momentId)
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Supabase reaction update (undo) failed:', error)
          if (userId) {
            await sb
              .from('user_reactions')
              .insert({
                user_id: userId,
                moment_id: momentId,
                reaction_type: REACTION_FIELD_TO_TYPE[field],
              })
          }
          const prevCount =
            field === 'pretty_count' ? prettyCount : field === 'funny_count' ? funnyCount : cheersCount
          setQueue((prevQueue) =>
            prevQueue.map((mom) =>
              mom.id === momentId ? { ...mom, [field]: prevCount } : mom,
            ),
          )
          setPrettyCount(field === 'pretty_count' ? prevCount : prettyCount)
          setFunnyCount(field === 'funny_count' ? prevCount : funnyCount)
          setCheersCount(field === 'cheers_count' ? prevCount : cheersCount)
          setUserReactions((u) => ({
            ...u,
            pretty: field === 'pretty_count' ? true : u.pretty,
            funny: field === 'funny_count' ? true : u.funny,
            cheers: field === 'cheers_count' ? true : u.cheers,
          }))
          if (!userId) {
            try {
              localStorage.setItem(key, '1')
            } catch {
              // ignore
            }
          }
          return
        }
        const freezeEnd = Date.now() + 5000
        setFetchFrozenUntil(freezeEnd)
        // eslint-disable-next-line no-console
        console.log('Reaction updated - fetch frozen until:', new Date(freezeEnd).toLocaleTimeString())
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Reaction remove failed:', e)
          if (userId) {
            await sb
              .from('user_reactions')
              .insert({
                user_id: userId,
                moment_id: momentId,
                reaction_type: REACTION_FIELD_TO_TYPE[field],
              })
          }
          const prevCount =
            field === 'pretty_count' ? prettyCount : field === 'funny_count' ? funnyCount : cheersCount
          setQueue((prevQueue) =>
            prevQueue.map((mom) =>
              mom.id === momentId ? { ...mom, [field]: prevCount } : mom,
            ),
          )
          setPrettyCount(field === 'pretty_count' ? prevCount : prettyCount)
          setFunnyCount(field === 'funny_count' ? prevCount : funnyCount)
          setCheersCount(field === 'cheers_count' ? prevCount : cheersCount)
          setUserReactions((u) => ({
            ...u,
            pretty: field === 'pretty_count' ? true : u.pretty,
            funny: field === 'funny_count' ? true : u.funny,
            cheers: field === 'cheers_count' ? true : u.cheers,
          }))
          if (!userId) {
            try {
              localStorage.setItem(key, '1')
            } catch {
              // ignore
            }
          }
        }
        return
      }

      // Add reaction: optimistic +1
      const optimisticCount =
        field === 'pretty_count' ? prettyCount + 1 : field === 'funny_count' ? funnyCount + 1 : cheersCount + 1
      setQueue((prevQueue) =>
        prevQueue.map((mom) =>
          mom.id === momentId ? { ...mom, [field]: optimisticCount } : mom,
        ),
      )
      setPrettyCount(field === 'pretty_count' ? optimisticCount : prettyCount)
      setFunnyCount(field === 'funny_count' ? optimisticCount : funnyCount)
      setCheersCount(field === 'cheers_count' ? optimisticCount : cheersCount)
      setUserReactions((u) => ({
        ...u,
        pretty: field === 'pretty_count' ? true : u.pretty,
        funny: field === 'funny_count' ? true : u.funny,
        cheers: field === 'cheers_count' ? true : u.cheers,
      }))
      if (!userId) {
        try {
          localStorage.setItem(key, '1')
        } catch {
          // ignore
        }
      }
      if (userId) {
        const { error: insertErr } = await sb.from('user_reactions').insert({
          user_id: userId,
          moment_id: momentId,
          reaction_type: REACTION_FIELD_TO_TYPE[field],
        })
        // #region agent log
        fetch('http://127.0.0.1:7306/ingest/4ef3a4f4-1ac2-4982-a81c-532fdf430f25', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '75762d' },
          body: JSON.stringify({
            sessionId: '75762d',
            location: 'LiveStream.tsx:user_reactions insert',
            message: insertErr ? 'insert failed' : 'insert ok',
            data: {
              field,
              errCode: insertErr?.code ?? null,
              errMsg: insertErr?.message ?? null,
              reactionType: REACTION_FIELD_TO_TYPE[field],
            },
            timestamp: Date.now(),
            hypothesisId: 'H3',
          }),
        }).catch(() => {})
        // #endregion
        if (insertErr) {
          // eslint-disable-next-line no-console
          console.error('user_reactions insert failed:', insertErr)
          const prevCount =
            field === 'pretty_count' ? prettyCount : field === 'funny_count' ? funnyCount : cheersCount
          setQueue((prevQueue) =>
            prevQueue.map((mom) =>
              mom.id === momentId ? { ...mom, [field]: prevCount } : mom,
            ),
          )
          setPrettyCount(field === 'pretty_count' ? prevCount : prettyCount)
          setFunnyCount(field === 'funny_count' ? prevCount : funnyCount)
          setCheersCount(field === 'cheers_count' ? prevCount : cheersCount)
          setUserReactions((u) => ({
            ...u,
            pretty: field === 'pretty_count' ? false : u.pretty,
            funny: field === 'funny_count' ? false : u.funny,
            cheers: field === 'cheers_count' ? false : u.cheers,
          }))
          return
        }
      }
      try {
        const { error } = await sb.from('moments').update({ [field]: optimisticCount }).eq('id', momentId)
        // #region agent log
        fetch('http://127.0.0.1:7306/ingest/4ef3a4f4-1ac2-4982-a81c-532fdf430f25', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '75762d' },
          body: JSON.stringify({
            sessionId: '75762d',
            location: 'LiveStream.tsx:moments.update add',
            message: error ? 'moments update failed' : 'moments update ok',
            data: {
              field,
              optimisticCount,
              errCode: error?.code ?? null,
              errMsg: error?.message ?? null,
              errDetails: error?.details ?? null,
              errHint: error?.hint ?? null,
            },
            timestamp: Date.now(),
            hypothesisId: 'H4',
          }),
        }).catch(() => {})
        // #endregion
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Supabase reaction update failed:', error)
          if (userId) {
            await sb
              .from('user_reactions')
              .delete()
              .eq('user_id', userId)
              .eq('moment_id', momentId)
              .eq('reaction_type', REACTION_FIELD_TO_TYPE[field])
          }
          const prevCount =
            field === 'pretty_count' ? prettyCount : field === 'funny_count' ? funnyCount : cheersCount
          setQueue((prevQueue) =>
            prevQueue.map((mom) =>
              mom.id === momentId ? { ...mom, [field]: prevCount } : mom,
            ),
          )
          setPrettyCount(field === 'pretty_count' ? prevCount : prettyCount)
          setFunnyCount(field === 'funny_count' ? prevCount : funnyCount)
          setCheersCount(field === 'cheers_count' ? prevCount : cheersCount)
          setUserReactions((u) => ({
            ...u,
            pretty: field === 'pretty_count' ? false : u.pretty,
            funny: field === 'funny_count' ? false : u.funny,
            cheers: field === 'cheers_count' ? false : u.cheers,
          }))
          if (!userId) {
            try {
              localStorage.removeItem(key)
            } catch {
              // ignore
            }
          }
          return
        }
        // eslint-disable-next-line no-console
        console.log('Supabase reaction update succeeded for field:', field, 'value:', optimisticCount)
        const now = Date.now()
        const freezeEnd = now + 5000
        setFetchFrozenUntil(freezeEnd)
        setLastReactionTime(now)
        // eslint-disable-next-line no-console
        console.log(
          'Reaction updated - reaction freeze active until',
          new Date(freezeEnd).toLocaleTimeString(),
        )
        // Force a one-time sync after 12s and never let the count drop below the optimistic value
        setTimeout(async () => {
          const sbInner = getSupabase()
          if (!sbInner) return
          try {
            const { data } = await sbInner
              .from('moments')
              .select('pretty_count, funny_count, cheers_count')
              .eq('id', momentId)
              .single()
            if (!data) return
            if (momentId !== current?.id) return
            if (field === 'pretty_count') {
              const synced = data.pretty_count ?? 0
              setPrettyCount(Math.max(synced, optimisticCount))
              // eslint-disable-next-line no-console
              console.log(
                'Final 12s sync count (pretty):',
                synced,
                'using max:',
                Math.max(synced, optimisticCount),
              )
            } else if (field === 'funny_count') {
              const synced = data.funny_count ?? 0
              setFunnyCount(Math.max(synced, optimisticCount))
            } else if (field === 'cheers_count') {
              const synced = data.cheers_count ?? 0
              setCheersCount(Math.max(synced, optimisticCount))
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Final 12s sync failed:', e)
          }
        }, 12000)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Reaction update failed:', e)
        if (userId) {
          await sb
            .from('user_reactions')
            .delete()
            .eq('user_id', userId)
            .eq('moment_id', momentId)
            .eq('reaction_type', REACTION_FIELD_TO_TYPE[field])
        }
        setQueue((prevQueue) =>
          prevQueue.map((mom) =>
            mom.id === momentId
              ? { ...mom, [field]: field === 'pretty_count' ? prettyCount : field === 'funny_count' ? funnyCount : cheersCount }
              : mom,
          ),
        )
        setPrettyCount(field === 'pretty_count' ? prettyCount : prettyCount)
        setFunnyCount(field === 'funny_count' ? funnyCount : funnyCount)
        setCheersCount(field === 'cheers_count' ? cheersCount : cheersCount)
        setUserReactions((u) => ({
          ...u,
          pretty: field === 'pretty_count' ? false : u.pretty,
          funny: field === 'funny_count' ? false : u.funny,
          cheers: field === 'cheers_count' ? false : u.cheers,
        }))
        if (!userId) {
          try {
            localStorage.removeItem(key)
          } catch {
            // ignore
          }
        }
      }
    },
    [prettyCount, funnyCount, cheersCount, current?.id, fetchReactionCounts, userId],
  )

  // When current video changes (skip, return, initial load), fetch latest reaction counts from Supabase
  useEffect(() => {
    if (!current?.id) return
    currentVideoIdRef.current = current.id
    setPrettyCount(current.pretty_count ?? 0)
    setFunnyCount(current.funny_count ?? 0)
    setCheersCount(current.cheers_count ?? 0)
    setUserReactions(
      userId
        ? { pretty: false, funny: false, cheers: false }
        : {
            pretty: hasReacted(current.id, 'pretty_count'),
            funny: hasReacted(current.id, 'funny_count'),
            cheers: hasReacted(current.id, 'cheers_count'),
          },
    )
    fetchReactionCounts(current.id, { force: true })
  }, [current?.id, fetchReactionCounts, userId])

  // Realtime: when logged in, sync user_reactions for current moment across devices/tabs
  useEffect(() => {
    if (!userId || !current?.id) return
    const sb = getSupabase()
    if (!sb) return
    const momentId = current.id
    const channel = sb
      .channel(`user_reactions:${userId}:${momentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_reactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { moment_id?: string; reaction_type?: string } | undefined
          const oldRow = payload.old as { moment_id?: string; reaction_type?: string } | undefined
          const mid = row?.moment_id ?? oldRow?.moment_id
          const type = row?.reaction_type ?? oldRow?.reaction_type
          if (mid !== momentId || !type) return
          if (payload.eventType === 'INSERT') {
            setUserReactions((u) => ({
              ...u,
              pretty: type === 'pretty' ? true : u.pretty,
              funny: type === 'funny' ? true : u.funny,
              cheers: type === 'cheers' ? true : u.cheers,
            }))
          } else if (payload.eventType === 'DELETE') {
            setUserReactions((u) => ({
              ...u,
              pretty: type === 'pretty' ? false : u.pretty,
              funny: type === 'funny' ? false : u.funny,
              cheers: type === 'cheers' ? false : u.cheers,
            }))
          }
          // Refetch global counts so this client sees latest
          fetchReactionCounts(momentId, { force: true })
        },
      )
      .subscribe()
    return () => {
      sb.removeChannel(channel)
    }
  }, [userId, current?.id, fetchReactionCounts])

  // Load current video as blob URL; revoke previous only after new one loads (in onCanPlay)
  useEffect(() => {
    if (!current?.video_url) {
      setCurrentBlobUrl(null)
      return
    }
    setCurrentBlobUrl(null)
    let cancelled = false
    fetch(current.video_url)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return
        if (previousBlobUrlRef.current) {
          urlToRevokeAfterLoadRef.current = previousBlobUrlRef.current
          previousBlobUrlRef.current = null
        }
        const blobUrl = URL.createObjectURL(blob)
        previousBlobUrlRef.current = blobUrl
        setCurrentBlobUrl(blobUrl)
      })
      .catch((err) => {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error('Stream blob fetch failed:', err)
          setCurrentBlobUrl(current.video_url)
        }
      })
    return () => {
      cancelled = true
    }
  }, [current?.id, current?.video_url])

  useEffect(() => {
    return () => {
      if (previousBlobUrlRef.current) {
        URL.revokeObjectURL(previousBlobUrlRef.current)
        previousBlobUrlRef.current = null
      }
      if (urlToRevokeAfterLoadRef.current) {
        URL.revokeObjectURL(urlToRevokeAfterLoadRef.current)
        urlToRevokeAfterLoadRef.current = null
      }
    }
  }, [])

  // Force video dimensions on orientation change or window resize so frame renders in all modes
  useEffect(() => {
    const handleResize = () => {
      if (videoRef.current && containerRef.current) {
        videoRef.current.style.width = '100%'
        videoRef.current.style.height = 'auto'
        videoRef.current.style.maxHeight = '100%'
      }
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  // On blob URL ready: reset then set new src so video renders (fixes black frame)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentBlobUrl) return
    video.pause()
    video.src = ''
    video.load()
    video.style.display = 'block'
    video.style.visibility = 'visible'
    video.style.opacity = '1'
    video.src = currentBlobUrl
    video.load()
    setTimeout(() => {
      video.play().catch((e) => {
        // eslint-disable-next-line no-console
        console.error('Play failed:', e)
      })
    }, 50)
  }, [currentBlobUrl])

  const goNext = useCallback(() => {
    setTransitioning(true)
    const video = videoRef.current
    if (video) {
      video.pause()
    }
    if (hasNext) {
      setCurrentIndex((i) => i + 1)
    } else {
      fetchMore().then((rows) => {
        if (rows.length > 0) {
          setQueue(rows)
          setCurrentIndex(0)
        }
        setTransitioning(false)
      })
    }
  }, [hasNext, fetchMore])

  const goPrev = useCallback(() => {
    setTransitioning(true)
    const video = videoRef.current
    if (video) {
      video.pause()
    }
    setCurrentIndex((i) => {
      if (i <= 0) return 0
      return i - 1
    })
    setTransitioning(false)
  }, [])

  const handleEnded = useCallback(() => {
    goNext()
  }, [goNext])

  const handlePlay = useCallback(() => {
    setTransitioning(false)
    const video = videoRef.current
    if (video) {
      // eslint-disable-next-line no-console
      console.log('Video onplay - currentSrc:', video.currentSrc)
    }
    if (current) {
      // eslint-disable-next-line no-console
      console.log('Playing video:', current.id)
    }
  }, [current])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (video) {
      // eslint-disable-next-line no-console
      console.log('Video element dimensions:', video.clientWidth, video.clientHeight)
    }
  }, [])

  const handleCanPlay = useCallback(() => {
    const video = videoRef.current
    if (video) {
      // eslint-disable-next-line no-console
      console.log('Video canplay - should render frames')
    }
    if (urlToRevokeAfterLoadRef.current) {
      URL.revokeObjectURL(urlToRevokeAfterLoadRef.current)
      urlToRevokeAfterLoadRef.current = null
    }
  }, [])

  const handlePlaying = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('Video playing event - frames should show')
  }, [])

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
      // eslint-disable-next-line no-console
      console.error('Video element error:', e)
      goNext()
    },
    [goNext],
  )

  const currentVideoKey = `${current?.id ?? 'video'}-${currentIndex}`

  const handleLoadedData = useCallback(() => {
    const video = videoRef.current
    if (video) {
      // eslint-disable-next-line no-console
      console.log('Video loaded - readyState:', video.readyState)
    }
  }, [])

  const handleWaiting = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('Video waiting/buffering')
  }, [])

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line no-console
      console.log('Live stream cleaned: no bottom text, shrunk & centered video, no top bar')
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(to bottom, #3b82f6, #a855f7, #ec4899, #f97316)',
        backgroundSize: 'cover',
      }}
    >
      <img
        src="/Logo.png"
        alt="5PM Somewhere"
        className="absolute top-4 left-4 h-20 w-auto sm:h-24 md:h-28 lg:h-32 z-30"
      />

      {/* Video container: centered, slightly shrunk so gradient shows around edges */}
      <div
        ref={containerRef}
        className="relative w-full h-full"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        <div
          className="absolute flex flex-col"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '92%',
            maxWidth: '92vw',
            height: '82%',
            maxHeight: '82vh',
          }}
        >
          {loading && queue.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-sunset-400 border-t-transparent" />
              <span className="text-sm text-sunset-200/80">Loading recent 5PM moments…</span>
            </div>
          )}
          {error && queue.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <p className="text-sunset-200/90">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="btn-glow-muted min-h-[48px] px-6"
              >
                Close
              </button>
            </div>
          )}
          {current && !loading && (
            <>
              <div className="flex-1 min-h-0 relative">
                <video
                  ref={videoRef}
                  key={currentVideoKey}
                  src={currentBlobUrl || current.video_url}
                  poster={POSTER_PLACEHOLDER}
                  autoPlay
                  playsInline
                  muted={false}
                  controls={false}
                  preload="auto"
                  loop={false}
                  className="z-[1] block w-full h-full max-h-full object-contain"
                  style={{
                    width: '100%',
                    height: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    zIndex: 1,
                    visibility: 'visible',
                    opacity: 1,
                    background: 'transparent',
                  }}
                  onEnded={handleEnded}
                  onPlay={handlePlay}
                  onCanPlay={handleCanPlay}
                  onPlaying={handlePlaying}
                  onLoadedData={handleLoadedData}
                  onLoadedMetadata={handleLoadedMetadata}
                  onError={handleError}
                  onWaiting={handleWaiting}
                />
                {queue
                  .slice(currentIndex + 1, currentIndex + 1 + PRELOAD_NEXT)
                  .map((m) => (
                    <video
                      key={`preload-${m.id}`}
                      src={m.video_url}
                      preload="auto"
                      className="hidden"
                      aria-hidden
                    />
                  ))}
                {transitioning && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-midnight-900/80">
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-sunset-400 border-t-transparent" />
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center justify-center gap-2 sm:gap-3 py-2 px-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => current && toggleReaction(current.id, 'pretty_count')}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-all duration-200 ${
                    userReactions.pretty
                      ? 'scale-125 border-sunset-400 bg-amber-500/90 text-midnight-900 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                      : 'scale-100 border-sunset-500/40 bg-midnight-700/80 text-sunset-100 hover:bg-midnight-600/90'
                  }`}
                >
                  🌅 {prettyCount || 0}
                </button>
                <button
                  type="button"
                  onClick={() => current && toggleReaction(current.id, 'funny_count')}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-all duration-200 ${
                    userReactions.funny
                      ? 'scale-125 border-sunset-400 bg-amber-500/90 text-midnight-900 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                      : 'scale-100 border-sunset-500/40 bg-midnight-700/80 text-sunset-100 hover:bg-midnight-600/90'
                  }`}
                >
                  😂 {funnyCount || 0}
                </button>
                <button
                  type="button"
                  onClick={() => current && toggleReaction(current.id, 'cheers_count')}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-all duration-200 ${
                    userReactions.cheers
                      ? 'scale-125 border-sunset-400 bg-amber-500/90 text-midnight-900 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                      : 'scale-100 border-sunset-500/40 bg-midnight-700/80 text-sunset-100 hover:bg-midnight-600/90'
                  }`}
                >
                  🍻 {cheersCount || 0}
                </button>
              </div>
            </>
          )}
          {current && queue.length > 0 && (
            <>
              {hasPrev && (
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous video"
                  className="fixed flex items-center justify-center rounded-full border-2 border-sunset-400/80 bg-sunset-500 text-midnight-900 shadow-lg hover:bg-sunset-400"
                  style={{
                    position: 'fixed',
                    bottom: 30,
                    left: 20,
                    zIndex: 30,
                    width: 56,
                    height: 56,
                    fontSize: '1.5rem',
                    backgroundColor: 'rgb(251 191 36)',
                    borderRadius: '9999px',
                  }}
                >
                  ←
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                aria-label="Next video"
                className="fixed flex items-center justify-center rounded-full border-2 border-sunset-400/80 bg-sunset-500 text-midnight-900 shadow-lg hover:bg-sunset-400"
                style={{
                  position: 'fixed',
                  bottom: 30,
                  right: 20,
                  zIndex: 30,
                  width: 56,
                  height: 56,
                  fontSize: '1.5rem',
                  backgroundColor: 'rgb(251 191 36)',
                  borderRadius: '9999px',
                }}
              >
                →
              </button>
            </>
          )}
        </div>

        {/* Close button moved to corner without top bar */}
        <button
          type="button"
          onClick={onClose}
          className="fixed top-4 right-4 z-[10000] rounded-full bg-black/50 px-3 py-1.5 text-xs text-sunset-100 hover:bg-black/70 sm:px-4 sm:py-2 sm:text-sm"
        >
          Close
        </button>
      </div>
      <CopyrightFooter variant="overlay" />
    </div>
  )
}
