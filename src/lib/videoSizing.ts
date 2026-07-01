// © 2026 Chromatic Productions Ltd. All rights reserved.

export type DrawRect = {
  sx: number
  sy: number
  sw: number
  sh: number
  dx: number
  dy: number
  dw: number
  dh: number
}

export function getContainDrawRect(args: {
  sourceWidth: number
  sourceHeight: number
  targetWidth: number
  targetHeight: number
}): DrawRect | null {
  const { sourceWidth, sourceHeight, targetWidth, targetHeight } = args
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) return null

  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const dw = sourceWidth * scale
  const dh = sourceHeight * scale
  const dx = (targetWidth - dw) / 2
  const dy = (targetHeight - dh) / 2

  return {
    sx: 0,
    sy: 0,
    sw: sourceWidth,
    sh: sourceHeight,
    dx,
    dy,
    dw,
    dh,
  }
}

export function getFillDrawRect(args: {
  sourceWidth: number
  sourceHeight: number
  targetWidth: number
  targetHeight: number
}): DrawRect | null {
  const { sourceWidth, sourceHeight, targetWidth, targetHeight } = args
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) return null

  // Fill the bordered moment frame without asking the browser/camera to zoom.
  // We crop only at the app/canvas boundary, the same way a normal phone camera
  // preview masks a wider sensor image behind a portrait screen.
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const sw = targetWidth / scale
  const sh = targetHeight / scale
  const sx = (sourceWidth - sw) / 2
  const sy = (sourceHeight - sh) / 2

  return {
    sx,
    sy,
    sw,
    sh,
    dx: 0,
    dy: 0,
    dw: targetWidth,
    dh: targetHeight,
  }
}

export function getNaturalCameraVideoConstraints(): MediaTrackConstraints {
  return {
    facingMode: 'user',
    // Do not request a portrait-shaped camera stream here. Some mobile browsers
    // satisfy portrait ideals by digitally cropping/zooming the camera feed before
    // we ever draw it. Ask for the normal front camera, then fill the app's
    // bordered moment frame by masking/cropping in our own canvas.
    width: { ideal: 1280 },
    frameRate: { ideal: 30, max: 30 },
  }
}
