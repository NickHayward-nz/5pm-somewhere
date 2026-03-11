import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../lib/supabase'

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
}

const FETCH_LIMIT = 20
const PRELOAD_NEXT = 3

type Props = {
  open: boolean
  onClose: () => void
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

export function LiveStream({ open, onClose }: Props) {
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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)
  const previousBlobUrlRef = useRef<string | null>(null)
  const urlToRevokeAfterLoadRef = useRef<string | null>(null)

  const fetchMore = useCallback(async () => {
    const sb = getSupabase()
    if (!sb || loadingMoreRef.current) return []
    loadingMoreRef.current = true
    // Time filter disabled for testing: fetch latest 20 regardless of created_at
    const { data: videos, error } = await sb
      .from('moments')
      .select('*')
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
      console.log('No videos found in moments table')
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
      if (rows.length === 0) setError('No moments uploaded yet.')
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

  const fetchReactionCounts = useCallback(async (momentId: string) => {
    const sb = getSupabase()
    if (!sb) return
    try {
      const { data, error } = await sb
        .from('moments')
        .select('pretty_count, funny_count, cheers_count')
        .eq('id', momentId)
        .single()
      if (error || !data) return
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
      setPrettyCount(data.pretty_count ?? 0)
      setFunnyCount(data.funny_count ?? 0)
      setCheersCount(data.cheers_count ?? 0)
      setUserReactions({
        pretty: hasReacted(momentId, 'pretty_count'),
        funny: hasReacted(momentId, 'funny_count'),
        cheers: hasReacted(momentId, 'cheers_count'),
      })
      // eslint-disable-next-line no-console
      console.log('Fetched counts for video', momentId, data)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch reaction counts:', e)
    }
  }, [])

  const toggleReaction = useCallback(
    async (momentId: string, field: 'pretty_count' | 'funny_count' | 'cheers_count') => {
      const key = getReactionStorageKey(momentId, field)
      const alreadyReacted = (() => {
        try {
          return localStorage.getItem(key) === '1'
        } catch {
          return false
        }
      })()

      const sb = getSupabase()
      if (!sb) return

      const currentVideoId = current?.id
      if (momentId !== currentVideoId) return

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
        try {
          localStorage.removeItem(key)
        } catch {
          // ignore
        }
        try {
          await sb.from('moments').update({ [field]: newCount }).eq('id', momentId)
          setTimeout(() => fetchReactionCounts(momentId), 1500)
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Reaction remove failed:', e)
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
          try {
            localStorage.setItem(key, '1')
          } catch {
            // ignore
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
      try {
        localStorage.setItem(key, '1')
      } catch {
        // ignore
      }
      try {
        await sb.from('moments').update({ [field]: optimisticCount }).eq('id', momentId)
        // eslint-disable-next-line no-console
        console.log('Reaction updated - optimistic count:', optimisticCount)
        setTimeout(() => fetchReactionCounts(momentId), 1500)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Reaction update failed:', e)
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
        try {
          localStorage.removeItem(key)
        } catch {
          // ignore
        }
      }
    },
    [prettyCount, funnyCount, cheersCount, current?.id, fetchReactionCounts],
  )

  // When current video changes (skip, return, initial load), fetch latest reaction counts from Supabase
  useEffect(() => {
    if (!current?.id) return
    setPrettyCount(current.pretty_count ?? 0)
    setFunnyCount(current.funny_count ?? 0)
    setCheersCount(current.cheers_count ?? 0)
    setUserReactions({
      pretty: hasReacted(current.id, 'pretty_count'),
      funny: hasReacted(current.id, 'funny_count'),
      cheers: hasReacted(current.id, 'cheers_count'),
    })
    fetchReactionCounts(current.id)
  }, [current?.id, fetchReactionCounts])

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
        className="absolute top-4 left-4 h-10 w-auto sm:h-12 md:h-14 z-30"
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
            <button
              type="button"
              onClick={goNext}
              className="fixed flex items-center justify-center rounded-full border-2 border-sunset-400/80 bg-sunset-500 font-bold uppercase leading-none text-midnight-900 shadow-lg hover:bg-sunset-400"
              style={{
                position: 'fixed',
                bottom: 30,
                right: 20,
                zIndex: 30,
                width: 90,
                height: 48,
                fontSize: '0.875rem',
                backgroundColor: 'rgb(251 191 36)',
                borderRadius: '9999px',
              }}
            >
              Skip →
            </button>
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
    </div>
  )
}
