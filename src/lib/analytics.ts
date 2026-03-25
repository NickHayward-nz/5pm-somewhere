// © 2026 Chromatic Productions Ltd. All rights reserved.
import posthog from 'posthog-js'

let isInitialised = false

export function initAnalytics() {
  if (isInitialised) return
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  const host = import.meta.env.VITE_POSTHOG_HOST as string | undefined
  if (!key) return
  posthog.init(key, {
    api_host: host || 'https://us.i.posthog.com',
    capture_pageview: false,
    autocapture: true,
  })
  isInitialised = true
}

export function captureEvent(name: string, properties?: Record<string, unknown>) {
  if (!isInitialised) return
  posthog.capture(name, properties)
}

