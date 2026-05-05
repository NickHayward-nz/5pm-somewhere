// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { getSupabase } from '../lib/supabase'
import { CopyrightFooter } from './CopyrightFooter'

type MomentRow = {
  id: string
  video_url: string
  city: string
  country: string
  duration: number
  caption: string | null
  created_at?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  userId: string
}

type ShareNavigator = Navigator & {
  canShare?: (data: ShareData) => boolean
}

const APP_URL = 'https://5pm-somewhere-alpha.vercel.app'

function buildShareText(city: string): string {
  return `My 5PM moment from ${city} 🌅 Watch it on 5PM Somewhere!`
}

async function shareMoment(params: { moment: MomentRow }): Promise<void> {
  const { moment } = params
  const text = buildShareText(moment.city)

  // Attempt to share the actual video file (so the share sheet treats it as a video).
  const videoFile = await getVideoFile(moment.video_url)

  const nav = navigator as ShareNavigator
  if (!nav?.share) {
    // Minimal fallback: copy link + text.
    const payload = `${text}\n${APP_URL}`
    try {
      await navigator.clipboard.writeText(payload)
      return
    } catch {
      window.alert(payload)
      return
    }
  }

  // Prefer attaching the video file when supported.
  try {
    if (videoFile) {
      const canShareVideoOnly = nav.canShare?.({ files: [videoFile] })
      if (canShareVideoOnly) {
        await nav.share({
          title: '5PM Somewhere',
          text,
          url: APP_URL,
          files: [videoFile],
        })
        return
      }
    }
  } catch {
    // Ignore file-share failures and try text+url share.
  }

  // Fallback: if we cannot attach files, share the video URL as the `url` (so the share sheet
  // can treat it like a video) and include the app link in the text.
  try {
    const payloadText = `${text}\n${APP_URL}`
    const canShareUrl = nav.canShare?.({ url: moment.video_url }) !== false
    if (canShareUrl) {
      await nav.share({
        title: '5PM Somewhere',
        text: payloadText,
        url: moment.video_url,
      })
      return
    }
  } catch {
    // ignore and fall through
  }

  await nav.share({ title: '5PM Somewhere', text, url: APP_URL })
}

async function getVideoFile(videoUrl: string): Promise<File | null> {
  try {
    const res = await fetch(videoUrl)
    const blob = await res.blob()
    if (!blob || blob.size === 0) return null
    const mime = blob.type || 'video/webm'
    const ext = mime.includes('mp4') ? 'mp4' : 'webm'
    return new File([blob], `5pm-moment.${ext}`, { type: mime })
  } catch {
    return null
  }
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m <= 0) return `${rem}s`
  return `${m}:${rem.toString().padStart(2, '0')}`
}

async function generateFirstFrameThumbnail(args: {
  videoUrl: string
  targetWidth: number
  targetHeight: number
}): Promise<string | null> {
  const { videoUrl, targetWidth, targetHeight } = args

  // Off-DOM video for frame extraction.
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  // Attempt CORS-safe drawing; if the server doesn't allow it, canvas becomes tainted.
  video.crossOrigin = 'anonymous'
  video.src = videoUrl

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const load = () =>
    new Promise<void>((resolve, reject) => {
      const onError = () => reject(new Error('Video load failed'))
      video.addEventListener('error', onError, { once: true })

      video.addEventListener(
        'loadeddata',
        () => {
          resolve()
        },
        { once: true },
      )
    })

  const seekToStart = () =>
    new Promise<void>((resolve, reject) => {
      const onSeeked = () => resolve()
      const onError = () => reject(new Error('Video seek failed'))
      video.addEventListener('seeked', onSeeked, { once: true })
      video.addEventListener('error', onError, { once: true })
      try {
        video.currentTime = 0
      } catch (e) {
        reject(e as Error)
      }
    })

  try {
    await load()
    // Some sources require a seek to ensure first frame is ready.
    await seekToStart()

    const vw = video.videoWidth || targetWidth
    const vh = video.videoHeight || targetHeight
    if (!vw || !vh) return null

    // Draw "cover" into the fixed canvas.
    const srcAspect = vw / vh
    const dstAspect = targetWidth / targetHeight
    let sx = 0
    let sy = 0
    let sw = vw
    let sh = vh

    if (srcAspect > dstAspect) {
      // Wider than target: crop horizontally.
      sw = vh * dstAspect
      sx = (vw - sw) / 2
    } else {
      // Taller than target: crop vertically.
      sh = vw / dstAspect
      sy = (vh - sh) / 2
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return null
  }
}

function VideoPlayModal(props: {
  open: boolean
  onClose: () => void
  url: string
  caption: string | null
}) {
  const { open, onClose, url, caption } = props
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[10010] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Play moment video"
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-midnight-900/95 border border-sunset-500/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-xs font-semibold tracking-[0.14em] uppercase text-sunset-100/70">
            Playing moment
          </div>
          <button type="button" onClick={onClose} className="text-sm text-white/70 hover:text-white">
            Close
          </button>
        </div>
        <video
          src={url}
          controls
          playsInline
          autoPlay
          className="w-full aspect-video bg-black"
        />
        {caption && <div className="px-4 py-3 text-sm text-white/80">{caption}</div>}
        <CopyrightFooter variant="card" />
      </div>
    </div>
  )
}

export default function MyMoments({ open, onClose, userId }: Props) {
  const sb = useMemo(() => getSupabase(), [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [moments, setMoments] = useState<MomentRow[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({})

  const [playModal, setPlayModal] = useState<{
    open: boolean
    url: string
    caption: string | null
  }>({
    open: false,
    url: '',
    caption: null,
  })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)

    ;(async () => {
      if (!sb) {
        setLoading(false)
        setError('Supabase is not configured.')
        return
      }
      const { data, error: qErr } = await sb
        .from('moments')
        .select('id, video_url, city, country, duration, caption, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (qErr) {
        setError(qErr.message || 'Failed to load your moments.')
        setLoading(false)
        return
      }
      setMoments((data ?? []) as MomentRow[])
      setThumbs({})
      setLoading(false)
    })()
  }, [open, sb, userId])

  useEffect(() => {
    if (!open) return
    // Generate thumbnails for the visible set only.
    const THUMB_LIMIT = 12
    const target = moments.slice(0, THUMB_LIMIT)
    const missing = target.filter((m) => thumbs[m.id] === undefined)
    if (!missing.length) return

    let cancelled = false
    ;(async () => {
      for (const m of missing) {
        if (cancelled) return
        const thumb = await generateFirstFrameThumbnail({
          videoUrl: m.video_url,
          targetWidth: 480,
          targetHeight: 270,
        })
        if (cancelled) return
        setThumbs((prev) => ({ ...prev, [m.id]: thumb }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, moments, thumbs])

  const appLogoAlt = '5PM Somewhere logo'

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="My 5PM Moments"
    >
      <div
        className="w-full max-w-5xl rounded-2xl bg-midnight-900/95 border border-sunset-500/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
              <img src="/Logo.png" alt={appLogoAlt} className="h-7 w-7 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-[0.14em] uppercase text-sunset-100/70">
                My 5PM Moments
              </div>
              <div className="text-[11px] text-white/60">
                {moments.length > 0 ? `${moments.length} moment${moments.length === 1 ? '' : 's'}` : 'Your moments'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-glow-muted text-xs sm:text-sm touch-manipulation"
            >
              Back to 5PM
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-white/70 hover:text-white bg-white/5 rounded-lg px-3 py-1.5"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-4 overflow-auto" style={{ maxHeight: '70vh' }}>
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-sunset-400 border-t-transparent" />
            </div>
          )}
          {error && !loading && <div className="text-sm text-red-200 px-2">{error}</div>}

          {!loading && !error && moments.length === 0 && (
            <div className="text-sm text-white/70 py-10 text-center">No 5PM moments yet. Post your first one!</div>
          )}

          {!loading && !error && moments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {moments.map((m) => {
                const thumb = thumbs[m.id]
                const caption = m.caption ?? ''
                const createdLabel = m.created_at
                  ? DateTime.fromISO(m.created_at).toFormat('LLL d, HH:mm')
                  : ''
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex flex-col"
                  >
                    <div className="relative aspect-video bg-black">
                      {thumb ? (
                        <img src={thumb} alt={`Thumbnail for ${m.city}`} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <img src="/Logo.png" alt={appLogoAlt} className="absolute inset-0 w-full h-full object-contain opacity-70 p-4" />
                      )}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                          <div className="px-2 py-1 rounded-full bg-black/50 text-white/80 text-[11px]">
                            {formatDuration(m.duration)}
                          </div>
                          <div className="px-2 py-1 rounded-full bg-black/50 text-white/80 text-[11px]">
                            {createdLabel}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPlayModal({ open: true, url: m.video_url, caption: m.caption })
                        }
                        className="absolute inset-0 flex items-center justify-center"
                        aria-label="Play video"
                      >
                        <div className="h-12 w-12 rounded-full bg-white/15 border border-white/30 backdrop-blur flex items-center justify-center">
                          <div className="w-0 h-0 border-t-[8px] border-b-[8px] border-l-[14px] border-l-white/80 border-y-transparent ml-1" />
                        </div>
                      </button>
                    </div>

                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div className="text-sm font-semibold text-white/90 truncate">{m.city}</div>
                      {caption ? (
                        <div className="text-[12px] text-white/70 line-clamp-2">{caption}</div>
                      ) : (
                        <div className="text-[12px] text-white/50 italic">No caption</div>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void shareMoment({ moment: m })
                          }}
                          className="btn-glow-gold text-xs touch-manipulation flex-1"
                        >
                          Share
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <CopyrightFooter variant="overlay" />

      <VideoPlayModal
        open={playModal.open}
        url={playModal.url}
        caption={playModal.caption}
        onClose={() => setPlayModal({ open: false, url: '', caption: null })}
      />
    </div>
  )
}

