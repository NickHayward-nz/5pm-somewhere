// © 2026 Chromatic Productions Ltd. All rights reserved.
//
// Share-related helpers: client-side post-processing of recorded moments
// and integration with the Web Share API.
//
// The app re-encodes the recorded WebM blob through a canvas when a sunset
// gradient border needs to be added (free users). Premium users already
// have the border baked into the recording, so we skip the re-encode and
// share the raw blob directly.
//
// Falls back to downloading the video + opening a text-only Web Share payload
// on browsers that can't share files (e.g. most desktop browsers, older iOS
// Safari versions, some Android WebViews).

/**
 * Host-relative share caption appended to every native share.
 * Uses the current origin so the link follows whichever domain the app is
 * running on (localhost in dev, preview domains, or production).
 */
function buildAppLink(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'https://5pmsomewhere.app'
}

/**
 * Text appended to every share. Supported browsers will typically present
 * this as the caption / message body for the user to edit before posting.
 */
export const SHARE_CAPTION = `Captured at 5PM Somewhere → ${buildAppLink()}`

/**
 * Paint a thin sunset-gradient border matching the app's bg-sunset-gradient
 * (blue → purple → pink → orange) around the full frame. Uses a ~1.8% of
 * min(width, height) stroke so the border scales with the video resolution.
 *
 * Draws directly over the current canvas pixels — call after drawing the
 * video frame but before drawing any overlays that should sit on top of
 * the border (e.g. the timestamp chip).
 */
export function drawSunsetBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const thickness = Math.max(6, Math.round(Math.min(width, height) * 0.018))
  const inset = thickness / 2

  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#3b82f6')
  gradient.addColorStop(0.33, '#a855f7')
  gradient.addColorStop(0.66, '#ec4899')
  gradient.addColorStop(1, '#f97316')

  ctx.save()
  ctx.lineWidth = thickness
  ctx.strokeStyle = gradient
  ctx.shadowColor = 'rgba(249, 115, 22, 0.35)'
  ctx.shadowBlur = Math.round(thickness * 0.8)

  const radius = Math.min(width, height) * 0.025
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(
      inset,
      inset,
      width - thickness,
      height - thickness,
      radius,
    )
    ctx.stroke()
  } else {
    ctx.strokeRect(inset, inset, width - thickness, height - thickness)
  }
  ctx.restore()
}

type PrepareOptions = {
  /** If true, re-encode the blob and paint a sunset gradient border each frame. */
  addBorder: boolean
  /** Hint that mp4 is preferred; we'll use it if the browser supports mp4 MediaRecorder. */
  preferMp4?: boolean
}

/**
 * Wrap a recorded WebM blob for sharing.
 *
 * When `addBorder` is true, we re-run the blob through a canvas +
 * MediaRecorder to paint the sunset border around every frame. Audio is
 * forwarded through a MediaStreamAudioDestinationNode so the shared clip
 * keeps its soundtrack.
 *
 * When `addBorder` is false, we return the original blob unchanged (so
 * premium users with an already-bordered recording don't pay the
 * re-encode cost).
 *
 * Result is wrapped in a `File` so it can be handed directly to
 * `navigator.share({ files })`.
 */
export async function prepareShareableVideo(
  source: Blob,
  options: PrepareOptions,
): Promise<File> {
  const timestamp = Date.now()
  const { addBorder } = options

  if (!addBorder) {
    const ext = source.type.includes('mp4') ? 'mp4' : 'webm'
    return new File([source], `5pm-somewhere-${timestamp}.${ext}`, {
      type: source.type || 'video/webm',
    })
  }

  const borderedBlob = await reencodeWithBorder(source, options.preferMp4 ?? false)
  const ext = borderedBlob.type.includes('mp4') ? 'mp4' : 'webm'
  return new File([borderedBlob], `5pm-somewhere-${timestamp}.${ext}`, {
    type: borderedBlob.type || 'video/webm',
  })
}

/**
 * Re-encode a recorded blob through a canvas, drawing a sunset gradient
 * border on every frame. Preserves the original audio track via
 * AudioContext → MediaStreamAudioDestinationNode.
 */
async function reencodeWithBorder(source: Blob, preferMp4: boolean): Promise<Blob> {
  const objectUrl = URL.createObjectURL(source)
  const video = document.createElement('video')
  video.src = objectUrl
  video.playsInline = true
  // Keep audio enabled so we can tap it into the AudioContext graph; the
  // element itself stays silent (volume = 0) so the user doesn't hear a
  // second playback during the re-encode.
  video.muted = false
  video.volume = 0
  video.crossOrigin = 'anonymous'

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Failed to load recorded video for re-encode'))
    })

    const width = video.videoWidth || 720
    const height = video.videoHeight || 1280
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    const canvasStream = canvas.captureStream(30)

    // Pipe the video element's audio through Web Audio so we can copy it
    // onto the canvas stream. createMediaElementSource hijacks the
    // element's output, which is why we set volume = 0 above (we don't
    // want a double audio feed).
    let audioCtx: AudioContext | null = null
    try {
      // Some browsers disallow createMediaElementSource on blob: URLs for
      // CORS reasons; fall back to silent re-encode if that happens.
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) throw new Error('AudioContext unavailable')
      audioCtx = new AudioContextCtor()
      const srcNode = audioCtx.createMediaElementSource(video)
      const dest = audioCtx.createMediaStreamDestination()
      srcNode.connect(dest)
      dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t))
    } catch (err) {
      console.warn('Audio re-encode unavailable, continuing silent:', err)
    }

    const preferredMime = preferMp4 && supportsMime('video/mp4;codecs=avc1,mp4a')
      ? 'video/mp4;codecs=avc1,mp4a'
      : supportsMime('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'

    const recorder = new MediaRecorder(canvasStream, { mimeType: preferredMime })
    const chunks: BlobPart[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })

    recorder.start()

    const done = new Promise<void>((resolve) => {
      const finish = () => {
        if (recorder.state !== 'inactive') recorder.stop()
        resolve()
      }
      video.onended = finish
      video.onerror = finish
    })

    let rafId: number | null = null
    const drawLoop = () => {
      if (video.ended || video.paused) return
      ctx.drawImage(video, 0, 0, width, height)
      drawSunsetBorder(ctx, width, height)
      rafId = requestAnimationFrame(drawLoop)
    }

    await video.play()
    drawLoop()
    await done
    if (rafId != null) cancelAnimationFrame(rafId)
    await stopped
    await audioCtx?.close().catch(() => {})

    return new Blob(chunks, { type: preferredMime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function supportsMime(mime: string): boolean {
  try {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)
  } catch {
    return false
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'text_only' | 'downloaded'

type NativeShareInput = {
  title: string
  caption: string
}

type ShareNavigator = Navigator & {
  canShare?: (data: ShareData) => boolean
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * Share a prepared video file via the best available share surface.
 *
 * 1. If `navigator.canShare({ files })` is supported → share
 *    the file + caption + URL.
 * 2. Otherwise, if basic text share is supported, share the caption + URL
 *    only.
 * 3. Otherwise, download the file so the user can post it manually and
 *    copy the caption to the clipboard.
 */
export async function shareVideoNatively(
  file: File,
  { title, caption }: NativeShareInput,
): Promise<ShareResult> {
  const url = buildAppLink()
  const shareNavigator = navigator as ShareNavigator

  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof shareNavigator.canShare === 'function' &&
      shareNavigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title, text: caption, url })
        return 'shared'
      } catch (err: unknown) {
        if (isAbortError(err)) return 'cancelled'
        // Fall through to text-only share / download fallback
      }
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: caption, url })
        await downloadFile(file)
        return 'text_only'
      } catch (err: unknown) {
        if (isAbortError(err)) return 'cancelled'
      }
    }

    await downloadFile(file)
    try {
      await navigator.clipboard?.writeText?.(caption)
    } catch {
      // Ignore clipboard errors (permissions, insecure context, etc.)
    }
    return 'downloaded'
  } catch (err) {
    console.error('shareVideoNatively fatal:', err)
    await downloadFile(file)
    return 'downloaded'
  }
}

async function downloadFile(file: File): Promise<void> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = file.name
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    // Delay revoke so the browser has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000)
  }
}
