// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useRef } from 'react'
import { DateTime } from 'luxon'
import {
  ALMOST_FIVE_BODY,
  ALMOST_FIVE_TITLE,
  msUntilNextFivePmLocal,
  REMINDER_BAND_MS,
  storageKeyAlmostFive,
} from '../lib/almostFiveReminder'

const TICK_MS = 20_000
const TEN_MIN_MS = 10 * 60 * 1000

/**
 * Shows one browser notification per local day when ~10 minutes before the user’s 17:00 capture window.
 * Requires Notification API; works best while the app tab is open or in background (not when fully killed).
 */
export function useAlmostFivePmReminder(userId: string | null, userTz: string) {
  const permissionAskedThisBandRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const run = () => {
      let local: DateTime
      try {
        local = DateTime.now().setZone(userTz)
        if (!local.isValid) return
      } catch {
        return
      }

      const ms = msUntilNextFivePmLocal(local)
      if (Math.abs(ms - TEN_MIN_MS) > REMINDER_BAND_MS) {
        permissionAskedThisBandRef.current = false
        return
      }

      const dayKey = local.toFormat('yyyy-LL-dd')
      const key = storageKeyAlmostFive(userId, dayKey)

      try {
        if (localStorage.getItem(key)) return
      } catch {
        return
      }

      const show = () => {
        try {
          localStorage.setItem(key, '1')
        } catch {
          /* ignore */
        }
        try {
          new Notification(ALMOST_FIVE_TITLE, {
            body: ALMOST_FIVE_BODY,
            icon: '/Logo.png',
            tag: key,
          })
        } catch {
          /* ignore */
        }
      }

      if (Notification.permission === 'granted') {
        show()
        return
      }

      if (Notification.permission === 'denied') {
        try {
          localStorage.setItem(key, 'denied')
        } catch {
          /* ignore */
        }
        return
      }

      if (!permissionAskedThisBandRef.current) {
        permissionAskedThisBandRef.current = true
        void Notification.requestPermission().then((p) => {
          permissionAskedThisBandRef.current = false
          if (p === 'granted') {
            const ms2 = msUntilNextFivePmLocal(DateTime.now().setZone(userTz))
            if (Math.abs(ms2 - TEN_MIN_MS) <= REMINDER_BAND_MS) show()
          } else if (p === 'denied') {
            try {
              localStorage.setItem(key, 'denied')
            } catch {
              /* ignore */
            }
          }
        })
      }
    }

    const id = window.setInterval(run, TICK_MS)
    run()
    return () => window.clearInterval(id)
  }, [userId, userTz])
}
