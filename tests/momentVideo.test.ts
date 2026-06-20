// © 2026 Chromatic Productions Ltd. All rights reserved.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearMomentVideoUrlCache,
  getSignedMomentVideoUrl,
  shouldPreferPlaybackRendition,
} from '../src/lib/momentVideo.ts'

function makeNavigator(userAgent: string, vendor = ''): Pick<Navigator, 'userAgent' | 'vendor'> {
  return { userAgent, vendor }
}

describe('shouldPreferPlaybackRendition', () => {
  it('prefers playback renditions for iPhone Safari', () => {
    const nav = makeNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Apple Computer, Inc.',
    )

    assert.equal(shouldPreferPlaybackRendition(nav), true)
  })

  it('does not prefer playback renditions for Chrome on Android', () => {
    const nav = makeNavigator(
      'Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      'Google Inc.',
    )

    assert.equal(shouldPreferPlaybackRendition(nav), false)
  })

  it('prefers playback renditions for Chrome on iOS because iOS browsers use WebKit media playback', () => {
    const nav = makeNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1',
      'Google Inc.',
    )

    assert.equal(shouldPreferPlaybackRendition(nav), true)
  })
})

describe('getSignedMomentVideoUrl', () => {
  it('passes preferPlayback to the Edge Function and keeps original/playback URL caches separate', async () => {
    clearMomentVideoUrlCache()
    const invokedBodies: unknown[] = []
    const sb = {
      functions: {
        invoke: async (_name: string, options: { body: unknown }) => {
          invokedBodies.push(options.body)
          const preferPlayback = (options.body as { preferPlayback?: boolean }).preferPlayback
          return {
            data: {
              signedUrl: preferPlayback ? 'https://example.test/playback.mp4' : 'https://example.test/original.webm',
              expiresIn: 600,
              usedPlaybackRendition: Boolean(preferPlayback),
            },
            error: null,
          }
        },
      },
    }

    const originalUrl = await getSignedMomentVideoUrl(sb as never, 'moment-1')
    const playbackUrl = await getSignedMomentVideoUrl(sb as never, 'moment-1', { preferPlayback: true })
    const playbackUrlAgain = await getSignedMomentVideoUrl(sb as never, 'moment-1', { preferPlayback: true })

    assert.equal(originalUrl, 'https://example.test/original.webm')
    assert.equal(playbackUrl, 'https://example.test/playback.mp4')
    assert.equal(playbackUrlAgain, 'https://example.test/playback.mp4')
    assert.deepEqual(invokedBodies, [
      { momentId: 'moment-1', preferPlayback: false },
      { momentId: 'moment-1', preferPlayback: true },
    ])
  })
})
