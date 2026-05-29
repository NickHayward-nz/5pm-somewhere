// © 2026 Chromatic Productions Ltd. All rights reserved.
import * as Sentry from '@sentry/react'

type MonitoringUser = {
  id: string
  email?: string | null
}

let isMonitoringInitialised = false

function readSampleRate(key: string, fallback: number): number {
  const raw = import.meta.env[key] as string | undefined
  if (!raw) return fallback
  const parsed = Number.parseFloat(raw)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

export function initMonitoring() {
  if (isMonitoringInitialised) return
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_APP_ENV as string | undefined) || import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: readSampleRate('VITE_SENTRY_TRACES_SAMPLE_RATE', 0.05),
    replaysSessionSampleRate: readSampleRate('VITE_SENTRY_REPLAY_SAMPLE_RATE', 0),
    replaysOnErrorSampleRate: readSampleRate('VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE', 1),
  })
  isMonitoringInitialised = true
}

export function setMonitoringUser(user: MonitoringUser) {
  if (!isMonitoringInitialised) return
  Sentry.setUser({ id: user.id, email: user.email ?? undefined })
}

export function clearMonitoringUser() {
  if (!isMonitoringInitialised) return
  Sentry.setUser(null)
}
