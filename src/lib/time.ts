// © 2026 Chromatic Productions Ltd. All rights reserved.
import { DateTime } from 'luxon'

export type CityTimeInfo = {
  now: DateTime
  minutesFromFivePm: number // 0 at exactly 17:00, positive = after, negative = before
  absMinutesFromFivePm: number
  intensity: number // 0..1
  isFivePmHour: boolean
}

export function getCityTimeInfo(zone: string, now = DateTime.now()) {
  const zNow = now.setZone(zone)
  // target: today's 17:00 in that zone
  const todayFive = zNow.set({ hour: 17, minute: 0, second: 0, millisecond: 0 })
  const yesterdayFive = todayFive.minus({ days: 1 })
  const tomorrowFive = todayFive.plus({ days: 1 })

  const d0 = zNow.diff(todayFive, 'minutes').minutes
  const d1 = zNow.diff(yesterdayFive, 'minutes').minutes
  const d2 = zNow.diff(tomorrowFive, 'minutes').minutes

  // pick smallest absolute distance to handle wrap around midnight
  let minutesFromFivePm = d0
  if (Math.abs(d1) < Math.abs(minutesFromFivePm)) minutesFromFivePm = d1
  if (Math.abs(d2) < Math.abs(minutesFromFivePm)) minutesFromFivePm = d2

  const absMinutesFromFivePm = Math.abs(minutesFromFivePm)

  // Smooth falloff: strong around 0, fades by ~3 hours.
  // Make glow slightly stronger *after* 5 PM than before.
  const sigma = 55 // minutes; adjust for pleasing glow ramp
  let base = Math.exp(-(absMinutesFromFivePm * absMinutesFromFivePm) / (2 * sigma * sigma))
  if (minutesFromFivePm > 0) base *= 1.2
  else if (minutesFromFivePm < 0) base *= 0.8
  const intensity = base

  return {
    now: zNow,
    minutesFromFivePm,
    absMinutesFromFivePm,
    intensity: clamp01(intensity),
    isFivePmHour: zNow.hour === 17,
  } satisfies CityTimeInfo
}

export function clamp01(n: number) {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

export function formatClock(dt: DateTime) {
  // 24h clock, e.g. 17:00:00
  return dt.toFormat('HH:mm:ss')
}

export function getLocalCaptureWindow(now = DateTime.local(), windowMinutes: 5 | 8) {
  const start = now.set({ hour: 17, minute: 0, second: 0, millisecond: 0 })
  const end = start.plus({ minutes: windowMinutes })
  const active = now >= start && now < end
  const msUntilStart = start.toMillis() - now.toMillis()
  const msUntilEnd = end.toMillis() - now.toMillis()
  return { start, end, active, msUntilStart, msUntilEnd }
}

