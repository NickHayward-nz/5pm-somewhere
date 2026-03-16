// FORCE COMMIT - user_id fix - 2025-03-13 - delete me after push
// FORCE COMMIT - user_id fix - 2025-03-13 - delete me after push
// FORCE COMMIT - user_id fix - 2025-03-13 - delete me after push
import { useEffect, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import { getSupabase } from '../lib/supabase'
import {
  trackCaptureStarted,
  trackVideoUploaded,
  updateProfileAfterUpload,
  type ProfileStreak,
} from '../lib/capture'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  userTz: string
  city: string
  country: string
  isPremium: boolean
  profile: ProfileStreak | null
  onProfileUpdated: () => void
}

type Step = 'idle' | 'countdown' | 'recording' | 'preview' | 'uploading' | 'error'

export function RecordMoment(props: Props) {
  const { open, onClose, userId, userTz, city, country, isPremium, profile, onProfileUpdated } = props
  const [step, setStep] = useState<Step>('idle')
  const [countdown, setCountdown] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [durationSec, setDurationSec] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const MIN_SEC = isPremium ? 5 : 10
  const MAX_SEC = isPremium ? 30 : 20

  useEffect(() => {
    if (!open) {
      cleanup()
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      return
    }
    setStep('idle')
    setCountdown(3)
    setError(null)
    setCaption('')
    setDurationSec(0)
    setPreviewUrl(null)
  }, [open])

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    return () => cleanup()
  }, [])

  async function startCountdownAndRecord() {
    setError(null)
    // TEMP: auth + daily-limit bypassed for testing - re-enable last_post_date check later
    setStep('countdown')
    setCountdown(3)

    // eslint-disable-next-line no-console
    console.log('RecordMoment: Attempting getUserMedia...')

    const sb = getSupabase()
    if (!sb) {
      // eslint-disable-next-line no-console
      console.error('RecordMoment: Supabase not configured - cannot upload later')
      setError('Supabase is not configured.')
      setStep('error')
      return
    }

    let stream: MediaStream | null = null
    try {
      // eslint-disable-next-line no-console
      console.log('getUserMedia called')
      // eslint-disable-next-line no-console
      console.log('Requesting camera permission...')
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      })
      // eslint-disable-next-line no-console
      console.log('Camera permission granted - stream obtained:', stream)
      if (!stream || stream.getTracks().length === 0) {
        // eslint-disable-next-line no-console
        console.error('RecordMoment: stream null or no tracks')
        window.alert('Camera stream was empty. Check site permissions.')
        setStep('idle')
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas not available')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      function drawFrame() {
        const v = videoRef.current
        if (!v || !canvas || !ctx) return
        // Canvas size set once on loadedmetadata; only draw here (full frame, no crop)
        if (
          v.videoWidth > 0 &&
          v.videoHeight > 0 &&
          (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight)
        ) {
          canvas.width = v.videoWidth
          canvas.height = v.videoHeight
        }
        if (canvas.width === 0 || canvas.height === 0) return
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)

        // VHS-style timestamp overlay: responsive, wraps long locations into two lines if needed
        const margin = 16
        const paddingX = 16
        const paddingY = 8
        const maxBarWidth = canvas.width * 0.9

        const local = DateTime.now().setZone(userTz)
        const timeLabel = local.toFormat('HH:mm')
        const placeLabel = `${city}, ${country}`

        // Start with a base size relative to canvas height
        let fontSize = Math.max(14, Math.min(28, canvas.height / 20))
        const makeFont = () =>
          `bold ${fontSize}px "VT323", "DM Mono", ui-monospace, monospace` as const

        // Try single-line layout first
        ctx.font = makeFont()
        const single = `${timeLabel} • ${placeLabel}`
        let singleWidth = ctx.measureText(single).width

        let lines: string[]
        if (singleWidth <= maxBarWidth) {
          lines = [single]
        } else {
          // Fallback: two-line layout (time + city, then country)
          const line1 = `${timeLabel} • ${city}`
          const line2 = country

          // Shrink font until both lines fit or we hit a floor
          while (fontSize > 10) {
            ctx.font = makeFont()
            const w1 = ctx.measureText(line1).width
            const w2 = ctx.measureText(line2).width
            if (Math.max(w1, w2) <= maxBarWidth) break
            fontSize -= 1
          }
          ctx.font = makeFont()
          lines = [line1, line2]
        }

        const lineMetrics = lines.map((text) => ctx.measureText(text))
        const maxLineWidth = Math.min(
          maxBarWidth,
          Math.max(...lineMetrics.map((m) => m.width)),
        )
        const lineHeight = fontSize + 4
        const barHeight = lineHeight * lines.length + paddingY * 2
        const barWidth = maxLineWidth + paddingX * 2
        const barX = margin
        const barY = canvas.height - barHeight - margin

        ctx.save()
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
        ctx.shadowBlur = 6

        // Background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(barX, barY, barWidth, barHeight)

        // Text lines
        ctx.fillStyle = '#fff'
        lines.forEach((text, index) => {
          const textX = barX + paddingX
          const textY = barY + paddingY + index * lineHeight
          ctx.fillText(text, textX, textY)
        })

        ctx.restore()

        rafRef.current = requestAnimationFrame(drawFrame)
      }

      if (video) {
        video.srcObject = stream
        const startDrawLoop = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
          }
          drawFrame()
        }
        video.onloadedmetadata = startDrawLoop
        void video.play()
        // Fallback if metadata already loaded (e.g. reused element)
        if (video.readyState >= 1) startDrawLoop()
      }

      const canvasStream = canvas.captureStream(30)
      const combinedStream = new MediaStream()
      canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t))
      stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t))

      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const duration = recordingStartRef.current
          ? Math.floor((Date.now() - recordingStartRef.current) / 1000)
          : 0
        // eslint-disable-next-line no-console
        console.log('Recorded blob size:', blob.size, 'duration:', duration)
        const url = URL.createObjectURL(blob)
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = url
        setPreviewUrl(url)
        setDurationSec(duration)
        setStep('preview')
        cleanup()
      }

      // Countdown
      let current = 3
      const countdownInterval = window.setInterval(() => {
        current -= 1
        if (current <= 0) {
          window.clearInterval(countdownInterval)
          setStep('recording')
          chunksRef.current = []
          recorder.start()
          recordingStartRef.current = Date.now()
          // TEMP: if userId is missing, use a valid test UUID for analytics
          const testUserId = '00000000-0000-0000-0000-000000000000'
          const effectiveId = userId || testUserId
          trackCaptureStarted({ userId: effectiveId, isPremium, tz: userTz })
          const tick = () => {
            const start = recordingStartRef.current
            if (!start) return
            const sec = Math.floor((Date.now() - start) / 1000)
            setDurationSec(sec)
            if (sec >= MAX_SEC) {
              stopRecording()
              return
            }
            rafRef.current = requestAnimationFrame(tick)
          }
          tick()
        } else {
          setCountdown(current)
        }
      }, 1000)
    } catch (e) {
      const err = e as Error & { name?: string; stack?: string }
      // eslint-disable-next-line no-console
      console.error('getUserMedia failed:', err.name, err.message, err.stack)
      setError('Unable to access camera or microphone.')
      setStep('error')
      cleanup()
      window.alert(
        'Camera access failed: ' +
          (err.name ?? 'Error') +
          ' - ' +
          err.message +
          '\n\nCheck Chrome site settings for camera permission.',
      )
    }
    if (!streamRef.current) {
      // eslint-disable-next-line no-console
      console.error('RecordMoment: No stream after try/catch - fallback')
      window.alert('Camera stream was not available after request. Check permissions and try again.')
      setStep('idle')
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    const start = recordingStartRef.current
    const sec = start ? Math.floor((Date.now() - start) / 1000) : 0
    if (sec < MIN_SEC) {
      setError(`Please record at least ${MIN_SEC} seconds.`)
      return
    }
    setDurationSec(sec)
    recorder.stop()
  }

  async function upload() {
    if (!previewUrl) return
    setStep('uploading')
    setError(null)
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('Supabase is not configured.')
      // eslint-disable-next-line no-console
      console.log('Supabase auth session:', await sb.auth.getSession())
      const res = await fetch(previewUrl)
      const blob = await res.blob()
      const duration = durationSec

      // Detailed debug logging for uploads
      // eslint-disable-next-line no-console
      console.log('=== UPLOAD START ===')
      // eslint-disable-next-line no-console
      console.log('Blob size:', blob.size, 'Type:', blob.type, 'Duration:', duration)
      // eslint-disable-next-line no-console
      console.log(
        'Supabase URL:',
        import.meta.env.VITE_SUPABASE_URL ? 'present' : 'MISSING',
      )
      // eslint-disable-next-line no-console
      console.log(
        'Anon key length:',
        import.meta.env.VITE_SUPABASE_ANON_KEY
          ? import.meta.env.VITE_SUPABASE_ANON_KEY.length
          : 'MISSING',
      )

      const now = DateTime.now().setZone(userTz)

      const { data: userData, error: userError } = await sb.auth.getUser()
      if (userError) {
        // eslint-disable-next-line no-console
        console.error('Failed to get current user for upload:', userError)
      }
      const authUserId = userData?.user?.id
      if (!authUserId) {
        window.alert('You must be signed in to upload a moment.')
        return
      }
      // eslint-disable-next-line no-console
      console.log('Using user_id for upload:', authUserId)
      const path = `${authUserId}/${now.toFormat('yyyy/LL/dd')}/${now.toMillis()}.webm`
      // eslint-disable-next-line no-console
      console.log('Uploading to path:', path)

      const { data: storageData, error: storageError } = await sb.storage
        .from('moments')
        .upload(path, blob, {
          contentType: 'video/webm',
          upsert: false,
        })
      if (storageError || !storageData?.path) {
        throw storageError || new Error('Upload failed at storage step')
      }
      // eslint-disable-next-line no-console
      console.log('Upload SUCCESS (storage):', storageData)

      const { data: publicUrlData } = sb.storage.from('moments').getPublicUrl(storageData.path)
      const videoUrl = publicUrlData.publicUrl
      // eslint-disable-next-line no-console
      console.log('Public video URL:', videoUrl)

      const insertRow = {
        user_id: authUserId,
        timezone: userTz,
        city,
        country,
        video_url: videoUrl,
        caption: caption || null,
        duration: durationSec,
        pretty_count: 0,
        funny_count: 0,
        cheers_count: 0,
      }
      // eslint-disable-next-line no-console
      console.log('Using real user_id from auth for insert:', authUserId)
      // eslint-disable-next-line no-console
      console.log('Inserting moments row:', insertRow)

      const { data: sessionData } = await sb.auth.getSession()
      const session = sessionData?.session
      if (!session) {
        // eslint-disable-next-line no-console
        console.error('No active auth session - upload will fail RLS')
        window.alert('You must be signed in to upload a moment.')
        return
      }
      // eslint-disable-next-line no-console
      console.log('Authenticated session found - proceeding with insert')

      try {
        // eslint-disable-next-line no-console
        console.log('Insert request should be authenticated now')
        const { data, error } = await sb.from('moments').insert([insertRow])
        if (error) throw error
        // eslint-disable-next-line no-console
        console.log('Row insert success:', data)
        window.alert('Upload and row insert successful!')
      } catch (err) {
        const e = err as Error & { message?: string }
        // eslint-disable-next-line no-console
        console.error('Row insert failed:', e.message, err)
        window.alert('Row insert failed: ' + (e.message ?? 'Unknown error'))
        throw e
      }

      if (profile) {
        const previous = profile ?? {
          last_post_date: null,
          current_streak: 0,
          longest_streak: 0,
        }
        await updateProfileAfterUpload(userId, userTz, previous)
        onProfileUpdated()
      }
      trackVideoUploaded({ userId: authUserId, durationSec, isPremium, tz: userTz })
      // eslint-disable-next-line no-console
      console.log('=== UPLOAD COMPLETE ===')
      onClose()
    } catch (e) {
      const err = e as Error & { name?: string; message?: string; stack?: string }
      // eslint-disable-next-line no-console
      console.error('=== UPLOAD FAILED ===')
      // eslint-disable-next-line no-console
      console.error('Error name:', err.name)
      // eslint-disable-next-line no-console
      console.error('Error message:', err.message)
      // eslint-disable-next-line no-console
      console.error('Full error:', err)
      setError('Upload failed. Please try again.')
      setStep('error')
      window.alert('Upload failed: ' + (err.message || 'Unknown error'))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm h-dvh max-h-dvh w-dvw max-w-dvw overflow-hidden">
      <div className="polaroid-frame max-w-xl w-full mx-3 sm:mx-4 p-3 sm:p-4 max-h-[calc(100dvh-1rem)] flex flex-col min-h-0">
        <div className="polaroid-inner p-3 sm:p-4 space-y-2 sm:space-y-4 flex flex-col min-h-0 overflow-hidden flex-1">
          <div className="flex items-center justify-between flex-shrink-0 gap-2">
            <h2 className="text-sm sm:text-lg font-semibold tracking-[0.12em] sm:tracking-[0.18em] uppercase text-sunset-100 truncate">
              Capture your 5PM moment
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sunset-100/70 hover:text-sunset-50 text-sm flex-shrink-0 min-h-[44px] min-w-[44px] touch-manipulation"
            >
              Close
            </button>
          </div>

          {/* Preview: flex-grow fills space; min height so live preview is never tiny */}
          <div className="relative flex-1 min-h-[280px] sm:min-h-[40vh] overflow-hidden rounded-xl sm:rounded-2xl bg-midnight-900/90 border border-sunset-500/25 flex items-center justify-center">
            {/* Hidden live video: feeds canvas only */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ visibility: 'hidden', zIndex: 0 }}
            />
            {/* Single canvas: bitmap = stream size; element fills container, object-contain = full frame no crop */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full max-h-[80dvh] object-contain"
              style={{
                visibility: step === 'countdown' || step === 'recording' ? 'visible' : 'hidden',
                zIndex: 1,
              }}
            />
            {/* Playback: same sizing as live */}
            {previewUrl && (
              <video
                key={previewUrl}
                src={previewUrl}
                controls
                playsInline
                className="absolute inset-0 w-full h-full max-h-[80dvh] object-contain"
                style={{
                  visibility: step === 'preview' ? 'visible' : 'hidden',
                  zIndex: 2,
                }}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget
                  if (v) void v.play().catch(() => {})
                }}
              />
            )}

            {step === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10" aria-hidden>
                <div className="text-4xl sm:text-5xl font-bold text-sunset-200 font-mono">{countdown}</div>
              </div>
            )}

            {step === 'recording' && (
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-2 z-10">
                <span className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] sm:text-xs font-mono text-sunset-50">
                  REC • {durationSec.toString().padStart(2, '0')}s
                </span>
              </div>
            )}
          </div>

          {step === 'idle' && (
            <button
              type="button"
              onClick={startCountdownAndRecord}
              className="btn-glow-gold w-full min-h-[48px] text-sm sm:text-base touch-manipulation flex-shrink-0"
            >
              Start Recording
            </button>
          )}

          {step === 'recording' && (
            <div className="flex items-center justify-between gap-2 sm:gap-4 flex-shrink-0 flex-wrap">
              <div className="text-[10px] sm:text-xs text-sunset-100/80">
                {isPremium ? '5–30s' : '10–20s'}
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="btn-glow-gold min-h-[44px] px-4 touch-manipulation"
              >
                Stop
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-2 sm:space-y-3 flex-shrink-0">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add caption…"
                className="w-full rounded-xl bg-midnight-700/60 border border-sunset-500/30 px-3 py-2 text-sm text-sunset-50 placeholder:text-sunset-100/50 focus:outline-none focus:ring-2 focus:ring-sunset-400/70 min-h-[44px]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] sm:text-xs text-sunset-100/80 font-mono truncate">
                  {durationSec}s • {city}, {country}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-glow-muted min-h-[44px] touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={upload}
                    className="btn-glow-gold min-h-[44px] touch-manipulation"
                  >
                    Save Moment
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'uploading' && (
            <div className="text-xs sm:text-sm text-sunset-100/80 flex-shrink-0">Uploading…</div>
          )}

          {error && (
            <div className="text-[10px] sm:text-xs text-red-300 bg-red-950/40 border border-red-500/40 rounded-xl px-3 py-2 flex-shrink-0">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

