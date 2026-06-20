// © 2026 Chromatic Productions Ltd. All rights reserved.

export function normalizePlaybackLimit(value, defaultLimit = 5, maxLimit = 25) {
  const parsed = Number.parseInt(String(value ?? defaultLimit), 10)
  if (!Number.isFinite(parsed)) return defaultLimit
  return Math.min(maxLimit, Math.max(1, parsed))
}

export function buildPlaybackRenditionObjectPath(originalStoragePath) {
  const clean = String(originalStoragePath || '').replace(/^\/+/, '')
  const withoutExt = clean.replace(/\.[^/.]+$/, '')
  return `playback/${withoutExt || 'moment'}.mp4`
}

export function getPlaybackRenditionFfmpegArgs(inputPath, outputPath) {
  return [
    '-y',
    '-i',
    inputPath,
    '-vf',
    "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))',fps=30,format=yuv420p",
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    outputPath,
  ]
}
