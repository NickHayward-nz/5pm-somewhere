// © 2026 Chromatic Productions Ltd. All rights reserved.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPlaybackRenditionObjectPath,
  getPlaybackRenditionFfmpegArgs,
  normalizePlaybackLimit,
} from '../workers/playback-rendition-utils.mjs'

describe('playback rendition worker utilities', () => {
  it('stores MP4 renditions under playback/ while preserving original folder structure', () => {
    assert.equal(
      buildPlaybackRenditionObjectPath('user-1/2026/06/20/source.webm'),
      'playback/user-1/2026/06/20/source.mp4',
    )
    assert.equal(
      buildPlaybackRenditionObjectPath('user-1/2026/06/20/source'),
      'playback/user-1/2026/06/20/source.mp4',
    )
  })

  it('normalizes batch limits to a safe bounded range', () => {
    assert.equal(normalizePlaybackLimit(undefined), 5)
    assert.equal(normalizePlaybackLimit(0), 1)
    assert.equal(normalizePlaybackLimit(999), 25)
    assert.equal(normalizePlaybackLimit('8'), 8)
  })

  it('builds ffmpeg args for fast-start H.264/AAC MP4 playback renditions', () => {
    const args = getPlaybackRenditionFfmpegArgs('/tmp/in.webm', '/tmp/out.mp4')

    assert.deepEqual(args.slice(0, 3), ['-y', '-i', '/tmp/in.webm'])
    assert.ok(args.includes('libx264'))
    assert.ok(args.includes('aac'))
    assert.ok(args.join(' ').includes('yuv420p'))
    assert.ok(args.includes('+faststart'))
    assert.equal(args.at(-1), '/tmp/out.mp4')
  })
})
