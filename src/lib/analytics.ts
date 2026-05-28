// © 2026 Chromatic Productions Ltd. All rights reserved.
import posthog from 'posthog-js'
import { clearMonitoringUser, setMonitoringUser } from './monitoring'

type PlausibleEventOptions = {
  props?: Record<string, string | number | boolean>
  u?: string
}

type PlausibleFunction = ((
  eventName: string,
  options?: PlausibleEventOptions,
) => void) & {
  q?: unknown[][]
}

declare global {
  interface Window {
    plausible?: PlausibleFunction
  }
}

type AnalyticsUser = {
  id: string
  email?: string | null
  isPremium?: boolean
  timezone?: string | null
  currentStreak?: number | null
  totalUploads?: number | null
}

let isPostHogInitialised = false
let isPlausibleInitialised = false

const PLAUSIBLE_SCRIPT_ID = 'plausible-analytics-script'
const PLAUSIBLE_GROWTH_EVENTS = new Map<string, string>([
  ['auth_sign_in_started', 'Sign In Started'],
  ['auth_magic_link_requested', 'Magic Link Requested'],
  ['auth_signed_in', 'Signed In'],
  ['capture_intent', 'Capture Intent'],
  ['capture_started', 'Capture Started'],
  ['video_uploaded', 'Video Uploaded'],
  ['video_share_result', 'Video Share Result'],
  ['profile_share_result', 'Profile Share Result'],
  ['premium_checkout_started', 'Premium Checkout Started'],
  ['premium_checkout_returned', 'Premium Checkout Returned'],
])

function includeEmailInAnalytics(): boolean {
  return import.meta.env.VITE_ANALYTICS_INCLUDE_EMAIL === 'true'
}

function posthogAutocaptureEnabled(): boolean {
  return import.meta.env.VITE_POSTHOG_AUTOCAPTURE === 'true'
}

/** Keys that must never be sent to Plausible custom event props. */
export function isPlausibleSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  if (lower === 'id' || lower === 'userid' || lower === 'authuserid') return true
  if (lower.endsWith('userid')) return true
  if (lower.includes('email')) return true
  if (lower.includes('distinct')) return true
  if (lower.includes('token')) return true
  if (lower.includes('session') && lower.includes('id')) return true
  if (lower === 'sessionid' || lower.endsWith('session_id')) return true
  return false
}

function toPlausibleProps(properties?: Record<string, unknown>): PlausibleEventOptions['props'] {
  if (!properties) return undefined
  const entries = Object.entries(properties).filter(([key, value]) => {
    if (isPlausibleSensitiveKey(key)) return false
    return ['string', 'number', 'boolean'].includes(typeof value)
  })
  if (!entries.length) return undefined
  return Object.fromEntries(
    entries.map(([key, value]) => [key, value as string | number | boolean]),
  )
}

/** Absolute page URL for Plausible `u` (no query string or hash). */
export function sanitizePlausiblePageUrl(path?: string): string {
  if (typeof window === 'undefined') {
    const normalized = path?.startsWith('/') ? path : `/${path ?? ''}`
    return normalized || '/'
  }
  const pathname = path ?? window.location.pathname
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${window.location.origin}${normalizedPath}`
}

export function initAnalytics() {
  initPostHog()
  initPlausible()
}

function initPostHog() {
  if (isPostHogInitialised) return
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  const host = import.meta.env.VITE_POSTHOG_HOST as string | undefined
  if (!key) return
  posthog.init(key, {
    api_host: host || 'https://us.i.posthog.com',
    capture_pageview: false,
    autocapture: posthogAutocaptureEnabled(),
  })
  isPostHogInitialised = true
}

function initPlausible() {
  if (isPlausibleInitialised || typeof document === 'undefined') return
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined
  if (!domain || document.getElementById(PLAUSIBLE_SCRIPT_ID)) return

  window.plausible =
    window.plausible ||
    (function plausibleProxy(...args: unknown[]) {
      const plausible = window.plausible as PlausibleFunction
      plausible.q = plausible.q || []
      plausible.q.push(args)
    } as PlausibleFunction)

  const script = document.createElement('script')
  script.id = PLAUSIBLE_SCRIPT_ID
  script.defer = true
  script.setAttribute('data-domain', domain)
  // SPA: disable automatic pageviews; capturePageView sends sanitized URLs on route changes.
  script.setAttribute('data-manual', '')
  script.src =
    (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) ||
    'https://plausible.io/js/script.js'
  document.head.appendChild(script)
  isPlausibleInitialised = true
}

export function captureEvent(name: string, properties?: Record<string, unknown>) {
  if (isPostHogInitialised) {
    posthog.capture(name, properties)
  }

  const plausibleName = PLAUSIBLE_GROWTH_EVENTS.get(name)
  if (isPlausibleInitialised && plausibleName && typeof window.plausible === 'function') {
    window.plausible(plausibleName, { props: toPlausibleProps(properties) })
  }
}

export function capturePageView(path?: string) {
  const pathOnly = path ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  const sanitizedUrl = sanitizePlausiblePageUrl(pathOnly)

  if (isPostHogInitialised) {
    posthog.capture('page_view', { path: pathOnly, url: sanitizedUrl })
  }

  if (isPlausibleInitialised && typeof window.plausible === 'function') {
    window.plausible('pageview', { u: sanitizedUrl })
  }
}

export function identifyUser(user: AnalyticsUser) {
  const traits = {
    ...(includeEmailInAnalytics() && user.email ? { email: user.email } : {}),
    is_premium: user.isPremium,
    timezone: user.timezone,
    current_streak: user.currentStreak,
    total_uploads: user.totalUploads,
  }

  if (isPostHogInitialised) {
    posthog.identify(user.id, traits)
  }
  setMonitoringUser({
    id: user.id,
    email: includeEmailInAnalytics() ? user.email : undefined,
  })
}

export function resetAnalytics() {
  if (isPostHogInitialised) posthog.reset()
  clearMonitoringUser()
}
