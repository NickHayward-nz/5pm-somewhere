// © 2026 Chromatic Productions Ltd. All rights reserved.
import assert from 'node:assert/strict'
import test from 'node:test'

import { getFillDrawRect, getNaturalCameraVideoConstraints } from '../src/lib/videoSizing.ts'

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
