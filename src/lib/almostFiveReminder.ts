// © 2026 Chromatic Productions Ltd. All rights reserved.
import { DateTime } from 'luxon'

/** Milliseconds until the next 17:00 local (today if still ahead, else tomorrow). */
export function msUntilNextFivePmLocal(localNow: DateTime): number {
  const fiveToday = localNow.startOf('day').set({ hour: 17, minute: 0, second: 0, millisecond: 0 })
  if (localNow < fiveToday) {
    return fiveToday.toMillis() - localNow.toMillis()
  }
  return fiveToday.plus({ days: 1 }).toMillis() - localNow.toMillis()
}

export const ALMOST_FIVE_TITLE = "It's almost 5 PM!"
export const ALMOST_FIVE_BODY =
  "Your 5-minute window to capture today's moment opens in 10 minutes"

/** Half-width of the “10 minutes before” band (ms), so we still fire if the tab wakes a bit late. */
export const REMINDER_BAND_MS = 90_000

export function storageKeyAlmostFive(userId: string | null, localDate: string): string {
  const id = userId ?? 'guest'
  return `fivepm_almost5_${id}_${localDate}`
}
