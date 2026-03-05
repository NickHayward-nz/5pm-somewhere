import { useEffect, useState } from 'react'
import { DateTime } from 'luxon'

export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => DateTime.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(DateTime.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}

