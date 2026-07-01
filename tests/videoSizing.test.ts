// © 2026 Chromatic Productions Ltd. All rights reserved.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getFillDrawRect,
  getMomentThumbnailCanvasSize,
  getNaturalCameraVideoConstraints,
  getVideoAspectRatio,
} from '../src/lib/videoSizing.ts'

test('getFillDrawRect fills a portrait moment frame from a landscape camera without changing output orientation', () => {
  const rect = getFillDrawRect({
    sourceWidth: 1280,
    sourceHeight: 720,
    targetWidth: 720,
    targetHeight: 1280,
  })

  assert.deepEqual(rect, {
    sx: 437.5,
    sy: 0,
    sw: 405,
    sh: 720,
    dx: 0,
    dy: 0,
    dw: 720,
    dh: 1280,
  })
})

test('getFillDrawRect fills a landscape moment frame from a portrait camera', () => {
  const rect = getFillDrawRect({
    sourceWidth: 720,
    sourceHeight: 1280,
    targetWidth: 1280,
    targetHeight: 720,
  })

  assert.deepEqual(rect, {
    sx: 0,
    sy: 437.5,
    sw: 720,
    sh: 405,
    dx: 0,
    dy: 0,
    dw: 1280,
    dh: 720,
  })
})

test('getNaturalCameraVideoConstraints does not force a browser portrait crop', () => {
  const constraints = getNaturalCameraVideoConstraints()

  assert.equal(constraints.facingMode, 'user')
  assert.equal('height' in constraints, false)
  assert.equal('aspectRatio' in constraints, false)
})

test('getVideoAspectRatio preserves natural portrait and landscape dimensions', () => {
  assert.equal(getVideoAspectRatio({ width: 720, height: 1280 }), 720 / 1280)
  assert.equal(getVideoAspectRatio({ width: 1280, height: 720 }), 1280 / 720)
})

test('getVideoAspectRatio falls back for invalid metadata', () => {
  assert.equal(getVideoAspectRatio({ width: 0, height: 1280, fallbackRatio: 16 / 9 }), 16 / 9)
  assert.equal(getVideoAspectRatio({ width: 720, height: 0 }), 9 / 16)
})

test('getMomentThumbnailCanvasSize follows the source orientation', () => {
  assert.deepEqual(getMomentThumbnailCanvasSize({ sourceWidth: 720, sourceHeight: 1280 }), {
    width: 270,
    height: 480,
    aspectRatio: 720 / 1280,
  })
  assert.deepEqual(getMomentThumbnailCanvasSize({ sourceWidth: 1280, sourceHeight: 720 }), {
    width: 480,
    height: 270,
    aspectRatio: 1280 / 720,
  })
})
