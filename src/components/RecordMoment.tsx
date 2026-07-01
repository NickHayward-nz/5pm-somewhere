// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import { getSupabase } from '../lib/supabase'
import {
  computeLiveStreamPriority,
  getUploadsToday,
  incrementUploadsToday,
  trackCaptureStarted,
  trackVideoUploaded,
  updateProfileAfterUpload,
  type ProfileStreak,
} from '../lib/capture'
import { CopyrightFooter } from './CopyrightFooter'
import { FREE_USER_MOMENT_LIMIT, pruneExcessMomentsForFreeUser } from '../lib/momentsRetention'
import { PremiumUpsellModal } from './PremiumUpsellModal'
import { prepareShareableVideo, shareVideoNatively, SHARE_CAPTION, drawSunsetBorder } from '../lib/share'
import { captureEvent } from '../lib/analytics'
import { getFillDrawRect, getNaturalCameraVideoConstraints } from '../lib/videoSizing'
import {
  notificationPermission,
  pushNotificationsSupported,
  subscribeCurrentDeviceToPush,
} from '../lib/pushNotifications'

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
  onWatchLive?: () => void
}

type Step = 'idle' | 'countdown' | 'recording' | 'preview' | 'uploading' | 'success' | 'error'

type PostSuccessUpsell = 'moment_retention' | 'first_daily' | null

type VideoFrameCallbackVideoElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

type RecordingDiagnostics = {
  cameraWidth: number
  cameraHeight: number
  cameraFrameRate: number
  outputWidth: number
  outputHeight: number
  outputOrientation: 'portrait' | 'landscape'
  audioSampleRate: number
  mimeType: string
  videoBitsPerSecond: number
  audioBitsPerSecond: number
}

const TARGET_VIDEO_WIDTH = 720
const TARGET_VIDEO_HEIGHT = 1280
const TARGET_VIDEO_BITS_PER_SECOND = 3_500_000
const TARGET_AUDIO_BITS_PER_SECOND = 192_000

const RECORDING_MIME_TYPES = [
  'video/mp4;codecs=avc1,mp4a',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
] as const

function getBestRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return RECORDING_MIME_TYPES.find((mime) => {
    try {
      return MediaRecorder.isTypeSupported(mime)
    } catch {
      return false
    }
  })
}

function getRecordingFileExtension(mimeType: string): 'mp4' | 'webm' {
  return mimeType.includes('mp4') ? 'mp4' : 'webm'
}

function getRecordingOptions(): MediaRecorderOptions {
  const mimeType = getBestRecordingMimeType()
  return {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: TARGET_VIDEO_BITS_PER_SECOND,
    audioBitsPerSecond: TARGET_AUDIO_BITS_PER_SECOND,
  }
}

function getRecordingCanvasSize() {
  const isPortrait =
    typeof window !== 'undefined'
      ? window.matchMedia?.('(orientation: portrait)').matches || window.innerHeight >= window.innerWidth
      : true

  return isPortrait
    ? { width: TARGET_VIDEO_WIDTH, height: TARGET_VIDEO_HEIGHT, orientation: 'portrait' as const }
    : { width: TARGET_VIDEO_HEIGHT, height: TARGET_VIDEO_WIDTH, orientation: 'landscape' as const }
}

function drawComfortableVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (sourceWidth <= 0 || sourceHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) return

  // Fill the bordered moment area while still using the natural front-camera
  // stream. We do not ask the browser/camera to zoom or force a portrait crop;
  // any mismatch is masked here at the app frame, like a normal phone camera
  // preview filling a portrait screen.
  const backdrop = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight)
  backdrop.addColorStop(0, '#2563eb')
  backdrop.addColorStop(0.36, '#7c3aed')
  backdrop.addColorStop(0.68, '#ec4899')
  backdrop.addColorStop(1, '#f97316')
  ctx.fillStyle = backdrop
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const rect = getFillDrawRect({
    sourceWidth,
    sourceHeight,
    targetWidth: canvasWidth,
    targetHeight: canvasHeight,
  })
  if (!rect) return

  ctx.drawImage(video, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh)
}

export function RecordMoment(props: Props) {
  const { open, onClose, userId, userTz, city, country, isPremium, profile, onProfileUpdated, onWatchLive } = props
  const [step, setStep] = useState<Step>('idle')
  const [countdown, setCountdown] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [durationSec, setDurationSec] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [reminderStatus, setReminderStatus] = useState<string | null>(null)
  const [reminderBusy, setReminderBusy] = useState(false)
  const [recordingMaxUpsellOpen, setRecordingMaxUpsellOpen] = useState(false)
  const [postSuccessUpsell, setPostSuccessUpsell] = useState<PostSuccessUpsell>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hitRecordingMaxRef = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const recordedBlobRef = useRef<Blob | null>(null)
  const recordingDiagnosticsRef = useRef<RecordingDiagnostics | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const videoFrameCallbackRef = useRef<number | null>(null)
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
    setSharing(false)
    setShareStatus(null)
    setReminderStatus(null)
    setReminderBusy(false)
    setRecordingMaxUpsellOpen(false)
    setPostSuccessUpsell(null)
    hitRecordingMaxRef.current = false
    recordedBlobRef.current = null
    recordingDiagnosticsRef.current = null
  }, [open])

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    const frameCallbackVideo = videoRef.current as VideoFrameCallbackVideoElement | null
    if (videoFrameCallbackRef.current != null && frameCallbackVideo?.cancelVideoFrameCallback) {
      frameCallbackVideo.cancelVideoFrameCallback(videoFrameCallbackRef.current)
    }
    videoFrameCallbackRef.current = null
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

    const sb = getSupabase()
    if (!sb) {
      console.error('RecordMoment: Supabase not configured - cannot upload later')
      setError('Supabase is not configured.')
      setStep('error')
      return
    }

    let stream: MediaStream | null = null
    try {
      captureEvent('camera_permission_requested', { is_premium: isPremium, timezone: userTz })
      stream = await navigator.mediaDevices.getUserMedia({
        video: getNaturalCameraVideoConstraints(),
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      if (!stream || stream.getTracks().length === 0) {
        console.error('RecordMoment: stream null or no tracks')
        window.alert('Camera stream was empty. Check site permissions.')
        setStep('idle')
        return
      }
      captureEvent('camera_permission_granted', { is_premium: isPremium, timezone: userTz })
      const videoSettings = stream.getVideoTracks()[0]?.getSettings?.()
      const audioSettings = stream.getAudioTracks()[0]?.getSettings?.()
      streamRef.current = stream
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas not available')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      // Load the app logo once so we can draw it into the recorded video overlay.
      // Same-origin (/Logo.png) so crossOrigin drawing should work without tainting in most cases.
      let logoImg: HTMLImageElement | null = null
      void new Promise<void>((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          logoImg = img
          resolve()
        }
        img.onerror = () => {
          // If the logo fails to load, we still record the overlay text.
          resolve()
        }
        img.src = '/Logo.png'
      })

      function drawFrame() {
        const v = videoRef.current
        if (!v || !canvas || !ctx) return
        // Keep the recorded file in the user's device orientation, not whatever raw
        // camera sensor dimensions the browser reports. The raw camera frame is
        // drawn into this stable canvas so portrait phone captures are stored as
        // portrait video, with excess sensor area masked by the app frame.
        const canvasSize = getRecordingCanvasSize()
        if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
          canvas.width = canvasSize.width
          canvas.height = canvasSize.height
        }
        if (canvas.width === 0 || canvas.height === 0) return
        drawComfortableVideoFrame(ctx, v, canvas.width, canvas.height)

        // Premium visual indicator: thin sunset-gradient border matching the app's
        // bg-sunset-gradient. Baked into every recorded frame so premium users see
        // the distinctive border in the preview, live-stream, and shared video.
        if (isPremium) {
          drawSunsetBorder(ctx, canvas.width, canvas.height)
        }

        // Timestamp overlay: centered bottom bar, glassmorphism (polaroid-frame style), Poppins text.
        // Responsive; wraps long locations into two lines; includes the app logo in the bar.
        const margin = 16
        const paddingX = 16
        const paddingY = 10
        const logoPaddingRight = 12
        const maxBarWidth = canvas.width * 0.9

        const local = DateTime.now().setZone(userTz)
        const timeLabel = local.toFormat('h:mm a')
        const placeLabel = `${city}, ${country}`

        // Match tailwind fontFamily.display / sans: Poppins first (loaded in index.html).
        let fontSize = Math.max(14, Math.min(28, canvas.height / 20))
        const makeFontPrimary = () =>
          `600 ${fontSize}px Poppins, Inter, system-ui, sans-serif` as const
        const makeFontSecondary = () =>
          `500 ${fontSize}px Poppins, Inter, system-ui, sans-serif` as const

        // Size the logo relative to the current font size.
        const getLogoBoxSize = (fs: number) => Math.round(Math.min(44, Math.max(24, fs * 1.7)))

        const measureBarWidth = (textWidth: number, logoBoxSize: number) => {
          return paddingX * 2 + logoBoxSize + logoPaddingRight + textWidth
        }

        // Try single-line layout first
        ctx.font = makeFontPrimary()
        const single = `${timeLabel} • ${placeLabel}`
        const singleWidth = ctx.measureText(single).width

        let lines: string[]
        let logoBoxSize = getLogoBoxSize(fontSize)

        if (measureBarWidth(singleWidth, logoBoxSize) <= maxBarWidth) {
          lines = [single]
        } else {
          // Fallback: two-line layout (time + city, then country)
          const line1 = `${timeLabel} • ${city}`
          const line2 = country

          // Shrink font until both lines fit or we hit a floor.
          while (fontSize > 10) {
            ctx.font = makeFontPrimary()
            logoBoxSize = getLogoBoxSize(fontSize)
            const w1 = ctx.measureText(line1).width
            ctx.font = makeFontSecondary()
            const w2 = ctx.measureText(line2).width
            const maxLineWidth = Math.max(w1, w2)
            if (measureBarWidth(maxLineWidth, logoBoxSize) <= maxBarWidth) break
            fontSize -= 1
          }

          logoBoxSize = getLogoBoxSize(fontSize)
          lines = [line1, line2]
        }

        const lineMetrics = lines.map((text, i) => {
          ctx.font = lines.length === 2 && i === 1 ? makeFontSecondary() : makeFontPrimary()
          return ctx.measureText(text)
        })
        const maxLineWidth = Math.max(...lineMetrics.map((m) => m.width))
        const lineHeightPrimary = fontSize + 4
        const lineHeightSecondary = fontSize + 3
        const lineHeight =
          lines.length === 2
            ? [lineHeightPrimary, lineHeightSecondary]
            : [lineHeightPrimary]
        const barHeight =
          paddingY * 2 + lineHeight.reduce((sum, h) => sum + h, 0)
        const barWidth = paddingX * 2 + logoBoxSize + logoPaddingRight + maxLineWidth
        // Center along bottom (match polaroid glass cards)
        const barX = Math.max(0, Math.round((canvas.width - barWidth) / 2))
        const barY = canvas.height - barHeight - margin

        ctx.save()
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'

        // Glassmorphism box (canvas can’t use backdrop-filter; layered frosted gradients + borders)
        const radius = Math.min(18, Math.round(barHeight * 0.22))
        const roundRectAvailable = typeof ctx.roundRect === 'function'

        const drawGlassPanel = () => {
          if (roundRectAvailable) {
            ctx.beginPath()
            ctx.roundRect(barX, barY, barWidth, barHeight, radius)
          } else {
            ctx.beginPath()
            ctx.rect(barX, barY, barWidth, barHeight)
          }
        }

        // Soft lift shadow (under panel)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
        ctx.shadowBlur = 20
        ctx.shadowOffsetY = 4
        drawGlassPanel()
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0

        // Clip to rounded rect for frosted layers
        ctx.save()
        drawGlassPanel()
        ctx.clip()

        // Base: polaroid-style frosted stack (see index.css .polaroid-frame)
        const frost = ctx.createLinearGradient(barX, barY, barX, barY + barHeight)
        frost.addColorStop(0, 'rgba(255, 255, 255, 0.22)')
        frost.addColorStop(0.45, 'rgba(255, 255, 255, 0.1)')
        frost.addColorStop(0.78, 'rgba(236, 72, 153, 0.12)')
        frost.addColorStop(1, 'rgba(5, 7, 22, 0.42)')
        ctx.fillStyle = frost
        ctx.fillRect(barX, barY, barWidth, barHeight)

        // Specular highlight (glass shine, top-left)
        const cx = barX + barWidth * 0.28
        const cy = barY + barHeight * 0.18
        const shine = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(barWidth, barHeight) * 0.55)
        shine.addColorStop(0, 'rgba(255, 255, 255, 0.38)')
        shine.addColorStop(0.45, 'rgba(255, 255, 255, 0.08)')
        shine.addColorStop(1, 'rgba(255, 255, 255, 0)')
        ctx.fillStyle = shine
        ctx.fillRect(barX, barY, barWidth, barHeight)

        // Warm sunset wash (subtle, bottom)
        const sunset = ctx.createLinearGradient(barX, barY + barHeight * 0.35, barX, barY + barHeight)
        sunset.addColorStop(0, 'rgba(249, 115, 22, 0)')
        sunset.addColorStop(1, 'rgba(249, 115, 22, 0.14)')
        ctx.fillStyle = sunset
        ctx.fillRect(barX, barY, barWidth, barHeight)

        ctx.restore()

        // Outer rim: light glass border
        drawGlassPanel()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        // Inner edge (depth)
        if (roundRectAvailable) {
          ctx.beginPath()
          ctx.roundRect(barX + 1.5, barY + 1.5, barWidth - 3, barHeight - 3, Math.max(0, radius - 2))
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // Logo: inside top-left corner of the bar.
        if (logoImg) {
          const logoX = barX + paddingX
          const logoY = barY + Math.round((barHeight - logoBoxSize) / 2)
          const logoRadius = Math.min(12, Math.round(logoBoxSize * 0.25))

          ctx.save()
          ctx.shadowColor = 'rgba(0,0,0,0.55)'
          ctx.shadowBlur = 12
          ctx.beginPath()
          if (roundRectAvailable) {
            ctx.roundRect(logoX, logoY, logoBoxSize, logoBoxSize, logoRadius)
            ctx.clip()
          }
          ctx.drawImage(logoImg, logoX, logoY, logoBoxSize, logoBoxSize)
          ctx.restore()
        }

        // Text: primary line = sunset gradient + deep stroke; secondary = soft cream (hierarchy).
        const textX = barX + paddingX + logoBoxSize + logoPaddingRight
        const textYBase = barY + paddingY
        const strokeWidth = Math.max(1.5, Math.round(fontSize / 20))
        let yCursor = textYBase

        lines.forEach((text, index) => {
          const isSecondary = lines.length === 2 && index === 1
          ctx.font = isSecondary ? makeFontSecondary() : makeFontPrimary()
          const w = ctx.measureText(text).width
          const textY = yCursor
          yCursor += lineHeight[index] ?? lineHeightPrimary

          ctx.shadowColor = 'rgba(5, 7, 22, 0.45)'
          ctx.shadowBlur = isSecondary ? 3 : 5
          ctx.lineWidth = isSecondary ? Math.max(1, strokeWidth - 0.5) : strokeWidth

          if (isSecondary) {
            ctx.strokeStyle = 'rgba(5, 7, 22, 0.5)'
            ctx.strokeText(text, textX, textY)
            ctx.shadowBlur = 0
            ctx.fillStyle = 'rgba(255, 224, 194, 0.95)'
            ctx.fillText(text, textX, textY)
          } else {
            const g = ctx.createLinearGradient(textX, textY, textX + w, textY + fontSize)
            g.addColorStop(0, '#fff4ec')
            g.addColorStop(0.45, '#ffc08a')
            g.addColorStop(1, '#ff9a62')
            ctx.strokeStyle = 'rgba(5, 7, 22, 0.72)'
            ctx.strokeText(text, textX, textY)
            ctx.shadowBlur = 0
            ctx.fillStyle = g
            ctx.fillText(text, textX, textY)
          }
        })

        ctx.restore()

        const frameCallbackVideo = videoRef.current as VideoFrameCallbackVideoElement | null
        if (frameCallbackVideo?.requestVideoFrameCallback) {
          videoFrameCallbackRef.current = frameCallbackVideo.requestVideoFrameCallback(() => drawFrame())
        } else {
          rafRef.current = requestAnimationFrame(drawFrame)
        }
      }

      if (video) {
        video.srcObject = stream
        const startDrawLoop = () => {
          const canvasSize = getRecordingCanvasSize()
          canvas.width = canvasSize.width
          canvas.height = canvasSize.height
          drawFrame()
        }
        video.onloadedmetadata = startDrawLoop
        void video.play()
        // Fallback if metadata already loaded (e.g. reused element)
        if (video.readyState >= 1) startDrawLoop()
      }

      const initialCanvasSize = getRecordingCanvasSize()
      if (canvas.width !== initialCanvasSize.width || canvas.height !== initialCanvasSize.height) {
        canvas.width = initialCanvasSize.width
        canvas.height = initialCanvasSize.height
      }
      const canvasStream = canvas.captureStream(30)
      const combinedStream = new MediaStream()
      canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t))
      stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t))

      const recordingOptions = getRecordingOptions()
      const recorder = new MediaRecorder(combinedStream, recordingOptions)
      const diagnosticCanvasSize = getRecordingCanvasSize()
      recordingDiagnosticsRef.current = {
        cameraWidth: videoSettings?.width ?? 0,
        cameraHeight: videoSettings?.height ?? 0,
        cameraFrameRate: videoSettings?.frameRate ?? 0,
        outputWidth: diagnosticCanvasSize.width,
        outputHeight: diagnosticCanvasSize.height,
        outputOrientation: diagnosticCanvasSize.orientation,
        audioSampleRate: audioSettings?.sampleRate ?? 0,
        mimeType: recorder.mimeType || recordingOptions.mimeType || 'browser_default',
        videoBitsPerSecond: recorder.videoBitsPerSecond || TARGET_VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: recorder.audioBitsPerSecond || TARGET_AUDIO_BITS_PER_SECOND,
      }
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blobType = recorder.mimeType || recordingOptions.mimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type: blobType })
        const duration = recordingStartRef.current
          ? Math.floor((Date.now() - recordingStartRef.current) / 1000)
          : 0
        const url = URL.createObjectURL(blob)
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = url
        recordedBlobRef.current = blob
        setPreviewUrl(url)
        setDurationSec(duration)
        setStep('preview')
        if (hitRecordingMaxRef.current && !isPremium) {
          hitRecordingMaxRef.current = false
          setRecordingMaxUpsellOpen(true)
          captureEvent('premium_upsell_shown', { surface: 'recording_max_modal' })
        }
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
          const diagnostics = recordingDiagnosticsRef.current
          captureEvent('recording_pipeline_started', {
            is_premium: isPremium,
            camera_width: diagnostics?.cameraWidth ?? 0,
            camera_height: diagnostics?.cameraHeight ?? 0,
            camera_frame_rate: diagnostics?.cameraFrameRate ?? 0,
            output_width: diagnostics?.outputWidth ?? 0,
            output_height: diagnostics?.outputHeight ?? 0,
            output_orientation: diagnostics?.outputOrientation ?? 'unknown',
            audio_sample_rate: diagnostics?.audioSampleRate ?? 0,
            mime_type: diagnostics?.mimeType ?? 'browser_default',
            video_bits_per_second: diagnostics?.videoBitsPerSecond ?? TARGET_VIDEO_BITS_PER_SECOND,
            audio_bits_per_second: diagnostics?.audioBitsPerSecond ?? TARGET_AUDIO_BITS_PER_SECOND,
          })
          trackCaptureStarted({ userId, isPremium, tz: userTz, city, country })
          const tick = () => {
            const start = recordingStartRef.current
            if (!start) return
            const sec = Math.floor((Date.now() - start) / 1000)
            setDurationSec(sec)
            if (sec >= MAX_SEC) {
              if (!isPremium) hitRecordingMaxRef.current = true
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
       
      console.error('getUserMedia failed:', err.name, err.message, err.stack)
      captureEvent('camera_permission_failed', {
        error_name: err.name ?? 'Error',
        is_premium: isPremium,
        timezone: userTz,
      })
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
       
      console.error('RecordMoment: No stream after try/catch - fallback')
      window.alert('Camera stream was not available after request. Check permissions and try again.')
      setStep('idle')
    }
  }

  async function handleShare() {
    const rawBlob = recordedBlobRef.current
    if (!rawBlob) {
      setShareStatus('No recording found to share.')
      return
    }
    setSharing(true)
    setShareStatus(null)
    try {
      captureEvent('video_share_started', { surface: 'post_capture', is_premium: isPremium })
      // Premium users already have the sunset border baked into the recording (see drawFrame).
      // Free users need the border added on-the-fly before sharing. Either way we append
      // the share caption via the native share sheet so captions/link ride along.
      const prepared = await prepareShareableVideo(rawBlob, {
        addBorder: !isPremium,
        preferMp4: true,
      })
      const result = await shareVideoNatively(prepared, {
        title: "I'm 5PM Somewhere",
        caption: SHARE_CAPTION,
      })
      captureEvent('video_share_result', {
        surface: 'post_capture',
        result,
        is_premium: isPremium,
      })
      if (result === 'shared') {
        setShareStatus('Shared! 🎉')
      } else if (result === 'downloaded') {
        setShareStatus(
          'Your browser does not support sharing files, so we downloaded the video — post it from your gallery.',
        )
      } else if (result === 'cancelled') {
        setShareStatus('Share cancelled.')
      } else if (result === 'text_only') {
        setShareStatus(
          'Your browser could not share the video file directly. We shared a link/caption instead.',
        )
      }
    } catch (err) {
       
      console.error('Share failed:', err)
      captureEvent('video_share_failed', {
        surface: 'post_capture',
        error_name: err instanceof Error ? err.name : 'UnknownError',
      })
      setShareStatus('Could not prepare the share. Try again, or tap Done and share from My Moments.')
    } finally {
      setSharing(false)
    }
  }

  async function handleEnableReminder() {
    if (reminderBusy) return
    setReminderBusy(true)
    setReminderStatus(null)
    captureEvent('notification_prompt_started', { surface: 'post_upload_success' })
    try {
      const result = await subscribeCurrentDeviceToPush()
      captureEvent('notification_prompt_result', {
        surface: 'post_upload_success',
        result: result.ok ? 'enabled' : 'failed',
        permission: notificationPermission(),
      })
      if (result.ok) {
        setReminderStatus('Reminder set — we’ll nudge you around tomorrow’s 5PM.')
      } else {
        setReminderStatus(result.error)
      }
    } catch (err) {
      console.error('Notification reminder failed:', err)
      captureEvent('notification_prompt_result', {
        surface: 'post_upload_success',
        result: 'error',
        error_name: err instanceof Error ? err.name : 'UnknownError',
      })
      setReminderStatus('Could not enable reminders on this device. You can try again from Profile.')
    } finally {
      setReminderBusy(false)
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    const start = recordingStartRef.current
    const sec = start ? Math.floor((Date.now() - start) / 1000) : 0
    if (sec < MIN_SEC) {
      captureEvent('recording_too_short', {
        duration_sec: sec,
        min_sec: MIN_SEC,
        is_premium: isPremium,
      })
      setError(`Please record at least ${MIN_SEC} seconds.`)
      return
    }
    captureEvent('recording_stopped', { duration_sec: sec, is_premium: isPremium })
    setDurationSec(sec)
    recorder.stop()
  }

  async function upload() {
    if (!previewUrl) return
    setStep('uploading')
    setError(null)
    captureEvent('video_upload_started', {
      duration_sec: durationSec,
      is_premium: isPremium,
      timezone: userTz,
      city,
      country,
    })
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('Supabase is not configured.')
      const { data: sessionResult } = await sb.auth.getSession()
      const session = sessionResult?.session ?? null
      if (!session || !session.user?.id) {
        console.error('No active session in upload()')
        setError('You must be signed in to upload a moment.')
        setStep('preview')
        window.alert('You must be signed in to upload a moment.')
        return
      }
      const authUserId = session.user.id
      if (!authUserId) {
        setError('You must be signed in to upload a moment.')
        setStep('preview')
        window.alert('You must be signed in to upload a moment.')
        return
      }
      const res = await fetch(previewUrl)
      const blob = await res.blob()

      const now = DateTime.now().setZone(userTz)

      const contentType = blob.type || 'video/webm'
      const diagnostics = recordingDiagnosticsRef.current
      const extension = getRecordingFileExtension(contentType)
      const path = `${authUserId}/${now.toFormat('yyyy/LL/dd')}/${now.toMillis()}.${extension}`

      const { data: storageData, error: storageError } = await sb.storage
        .from('moments')
        .upload(path, blob, {
          contentType,
          upsert: false,
        })
      if (storageError || !storageData?.path) {
        throw storageError || new Error('Upload failed at storage step')
      }
      captureEvent('video_storage_uploaded', {
        duration_sec: durationSec,
        is_premium: isPremium,
        file_size_bytes: blob.size,
        approx_bitrate_mbps: durationSec > 0 ? Number(((blob.size * 8) / durationSec / 1_000_000).toFixed(2)) : 0,
        content_type: contentType,
        camera_width: diagnostics?.cameraWidth ?? 0,
        camera_height: diagnostics?.cameraHeight ?? 0,
        camera_frame_rate: diagnostics?.cameraFrameRate ?? 0,
        output_width: diagnostics?.outputWidth ?? 0,
        output_height: diagnostics?.outputHeight ?? 0,
        output_orientation: diagnostics?.outputOrientation ?? 'unknown',
        audio_sample_rate: diagnostics?.audioSampleRate ?? 0,
        mime_type: diagnostics?.mimeType ?? contentType,
      })

      const { data: publicUrlData } = sb.storage.from('moments').getPublicUrl(storageData.path)
      const videoUrl = publicUrlData.publicUrl

      const streakDays = profile?.current_streak ?? 0
      // Live-stream queue priority:
      //   base 100 + streak*25 + premium*80 + launch boost for uploads 1/2/3
      // Applied to every upload so both premium flat-boost and streak boost
      // are reflected in the feed ordering.
      const livePriority = computeLiveStreamPriority(streakDays, isPremium, profile?.total_uploads ?? 0)
      const boostExpiresAt =
        livePriority.boostHours && livePriority.boostHours > 0
          ? now.plus({ hours: livePriority.boostHours }).toISO()
          : null

      const insertRow: Record<string, unknown> = {
        user_id: authUserId,
        timezone: userTz,
        city,
        country,
        video_url: videoUrl,
        storage_path: storageData.path,
        caption: caption || null,
        duration: durationSec,
        pretty_count: 0,
        funny_count: 0,
        cheers_count: 0,
        uploader_streak_days: livePriority.days,
        uploader_streak_priority: livePriority.priority,
        visibility_boost_expires_at: boostExpiresAt,
        uploader_is_premium: isPremium,
      }

      try {
        const { error } = await sb.from('moments').insert([insertRow])
        if (error) throw error
      } catch (err) {
        const e = err as Error & { message?: string }
        console.error('Row insert failed:', e.message, err)
        throw e
      }

      const uploadsBeforeToday = getUploadsToday(userId, userTz)
      let postSuccessUpsellKind: PostSuccessUpsell = null

      if (!isPremium) {
        const { prunedCount } = await pruneExcessMomentsForFreeUser(sb, authUserId)
        if (prunedCount > 0) {
          postSuccessUpsellKind = 'moment_retention'
          captureEvent('premium_upsell_shown', {
            surface: 'moment_retention_modal',
            pruned_count: prunedCount,
          })
        } else if (uploadsBeforeToday === 0) {
          postSuccessUpsellKind = 'first_daily'
          captureEvent('premium_upsell_shown', { surface: 'first_daily_modal' })
        }
      }

      if (profile) {
        const previous = profile ?? {
          last_post_date: null,
          current_streak: 0,
          longest_streak: 0,
          total_uploads: 0,
        }
        await updateProfileAfterUpload(userId, userTz, previous)
        onProfileUpdated()
      }
      trackVideoUploaded({ userId: authUserId, durationSec, isPremium, tz: userTz })
      captureEvent('video_upload_succeeded', {
        duration_sec: durationSec,
        is_premium: isPremium,
        timezone: userTz,
        city,
        country,
        streak_days_before_upload: profile?.current_streak ?? 0,
        total_uploads_before_upload: profile?.total_uploads ?? 0,
      })
      incrementUploadsToday(userId, userTz)
      setPostSuccessUpsell(postSuccessUpsellKind)
      setStep('success')
    } catch (e) {
      const err = e as Error & { name?: string; message?: string; stack?: string }
      console.error('=== UPLOAD FAILED ===')
      console.error('Error name:', err.name)
      console.error('Error message:', err.message)
      console.error('Full error:', err)
      captureEvent('video_upload_failed', {
        error_name: err.name ?? 'Error',
        duration_sec: durationSec,
        is_premium: isPremium,
      })
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
              {step === 'success' ? 'You’re live' : 'Capture your 5PM moment'}
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
          <div className={`relative flex-1 ${step === 'success' ? 'min-h-[320px]' : 'min-h-[280px] sm:min-h-[40vh]'} overflow-hidden rounded-xl sm:rounded-2xl bg-midnight-900/90 border border-sunset-500/25 flex items-center justify-center`}>
            {/* Hidden live video: feeds canvas only */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover pointer-events-none"
              style={{ visibility: 'hidden', zIndex: 0 }}
            />
            {/* Single canvas: portrait/landscape recording bitmap fills the bordered frame */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full object-cover"
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
                className="absolute inset-0 h-full w-full object-cover"
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

            {step === 'success' && (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-start gap-3 overflow-y-auto bg-midnight-950/92 px-4 py-4 text-center backdrop-blur-[2px] sm:justify-center sm:gap-4 sm:px-5 sm:py-6"
                role="status"
                aria-live="polite"
              >
                <div className="rounded-2xl border border-amber-400/50 bg-amber-500/15 px-4 py-3 shadow-[0_0_32px_rgba(251,191,36,0.25)] sm:px-6 sm:py-4">
                  <img
                    src="/Logo.png"
                    alt="5PM Somewhere"
                    className="mx-auto h-10 w-auto max-w-[min(180px,60vw)] object-contain sm:h-16 sm:max-w-[min(220px,72vw)]"
                  />
                </div>
                <div className="max-w-md space-y-1.5 sm:space-y-2">
                  <p className="text-balance text-base font-semibold leading-snug text-sunset-50 sm:text-xl">
                    Your 5PM moment is live 🌍
                  </p>
                  <p className="text-xs leading-relaxed text-sunset-100/80 sm:text-sm">
                    Come back tomorrow at 5:00 PM to keep your streak going and add another tiny daily memory.
                  </p>
                </div>

                {!isPremium && (
                  <p className="max-w-sm text-[11px] leading-relaxed text-amber-100/85 sm:text-xs">
                    Premium moments get stronger placement in the live stream and a golden sunset frame on
                    every capture.
                  </p>
                )}

                {(shareStatus || reminderStatus) && (
                  <div className="max-w-xs space-y-1 text-xs text-sunset-100/70" aria-live="polite">
                    {shareStatus ? <p>{shareStatus}</p> : null}
                    {reminderStatus ? <p>{reminderStatus}</p> : null}
                  </div>
                )}

                <div className="flex w-full max-w-xs flex-col gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      captureEvent('post_upload_success_action_clicked', { action: 'watch_live' })
                      onWatchLive?.()
                    }}
                    className="btn-glow-gold min-h-[48px] w-full touch-manipulation px-8 text-base"
                  >
                    Watch it live 🌍
                  </button>
                  {pushNotificationsSupported() && notificationPermission() !== 'denied' ? (
                    <button
                      type="button"
                      onClick={() => void handleEnableReminder()}
                      disabled={reminderBusy}
                      className="btn-glow-muted min-h-[44px] w-full touch-manipulation px-8 text-sm disabled:opacity-60"
                    >
                      {reminderBusy ? 'Setting reminder…' : 'Remind me tomorrow 🔔'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleShare()}
                    disabled={sharing || !recordedBlobRef.current}
                    className="btn-glow-muted min-h-[44px] w-full touch-manipulation px-8 text-sm disabled:opacity-60"
                  >
                    {sharing ? 'Preparing share…' : 'Share this moment 📤'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] w-full touch-manipulation px-8 text-sm text-sunset-100/75 hover:text-sunset-50"
                  >
                    Done
                  </button>
                </div>
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
      <CopyrightFooter variant="embedded" />

      <PremiumUpsellModal
        open={recordingMaxUpsellOpen}
        onClose={() => setRecordingMaxUpsellOpen(false)}
        title="Maximum clip length"
        message="Free clips stop at 20 seconds. Upgrade to Premium to record up to 30 seconds per moment."
        surface="recording_max_modal"
      />
      <PremiumUpsellModal
        open={postSuccessUpsell === 'moment_retention'}
        onClose={() => setPostSuccessUpsell(null)}
        title="Moment library full"
        message={`Free accounts keep your ${FREE_USER_MOMENT_LIMIT} most recent moments. Older ones were removed to make room—upgrade to Premium to keep your full history.`}
        surface="moment_retention_modal"
      />
      <PremiumUpsellModal
        open={postSuccessUpsell === 'first_daily'}
        onClose={() => setPostSuccessUpsell(null)}
        title="Want more today?"
        message="You’ve posted your first 5PM moment for today. Premium lets you capture up to 3 moments per day."
        surface="first_daily_modal"
      />
    </div>
  )
}
