import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { useNow } from '../hooks/useNow'

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

export function LiveStream({ open, onClose }: Props) {
  const now = useNow(1000)
  const [queue, setQueue] = useState<MomentRow[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null)
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
      console.log('Live stream full-screen gradient applied')
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
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
      {/* Top bar: fixed at top, height 60px, z-index 20 */}
      <header className="fixed top-0 left-0 flex h-[60px] w-full items-center justify-between gap-2 border-b border-sunset-500/20 bg-midnight-900/95 px-3 py-2 sm:px-4 z-20">
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <img
            src="/Logo.png"
            alt="5PM Somewhere Logo"
            className="block h-10 w-auto max-w-full min-h-[40px] sm:h-12 md:h-14 object-contain"
          />
          <span className="text-sm font-semibold tracking-wide text-sunset-100 sm:text-base truncate">
            5PM Somewhere
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-sunset-200/90 sm:text-sm">
            {now.toFormat('HH:mm')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/50 px-3 py-1.5 text-xs text-sunset-100 hover:bg-black/70 sm:px-4 sm:py-2 sm:text-sm"
          >
            Close
          </button>
        </div>
      </header>

      {/* Video container: full-height under header, gradient fills any letterbox */}
      <div
        ref={containerRef}
        className="relative mt-[60px] w-full flex-1 overflow-auto"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 'calc(100vh - 60px)',
          background: 'transparent',
          padding: 0,
          margin: 0,
        }}
      >
        <div
          className="relative w-full flex items-center justify-center"
          style={{
            minHeight: 'calc(100vh - 60px)',
            height: 'calc(100vh - 60px)',
            background: 'transparent',
            padding: 0,
            margin: 0,
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
              {/* Timestamp overlay: bottom 80px so skip button never covers it */}
              <div
                className="absolute z-[10] max-w-[85%] overflow-hidden text-ellipsis rounded-lg bg-black/50 px-3 py-2 text-sunset-100/90"
                style={{
                  bottom: 80,
                  left: 20,
                  zIndex: 10,
                  pointerEvents: 'none',
                  fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
                }}
              >
                {current.city}, {current.country}
              </div>
              {transitioning && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-midnight-900/80">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-sunset-400 border-t-transparent" />
                </div>
              )}
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
      </div>
    </div>
  )
}
