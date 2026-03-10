import { useEffect, useMemo, useRef, useState } from 'react'
import { DateTime, Interval } from 'luxon'
import { CITIES, type City } from './data/cities'
import { useNow } from './hooks/useNow'
import { countryCodeToFlagEmoji } from './lib/flags'
import { formatClock } from './lib/time'
import { Globe } from './components/Globe'
import { getSupabase } from './lib/supabase'
import { computeCaptureWindow, getUserTimezone, hasPostedToday, trackDailyLimitHit } from './lib/capture'
import { useProfile } from './hooks/useProfile'
import { RecordMoment } from './components/RecordMoment'
import { LiveStream } from './components/LiveStream'
import { SignInButton } from './components/SignInButton.tsx'

type FeaturedCity = {
  city: City
  local: DateTime
  rawDiffMinutes: number // signed minutes from 17:00 (positive = after, negative = before)
  wrappedDiffMinutes: number // 0..1439, minutes past 17:00 with wrap-around (spec helper)
}

function showToast(message: string) {
  const toast = document.createElement('div')
  toast.textContent = message
  toast.setAttribute('role', 'status')
  toast.style.position = 'fixed'
  toast.style.bottom = '20px'
  toast.style.left = '50%'
  toast.style.transform = 'translateX(-50%)'
  toast.style.background = 'rgba(255, 140, 0, 0.95)'
  toast.style.color = 'white'
  toast.style.padding = '16px 32px'
  toast.style.borderRadius = '12px'
  toast.style.zIndex = '1000'
  toast.style.fontSize = '1.1rem'
  toast.style.fontWeight = '500'
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
  toast.style.maxWidth = '90%'
  toast.style.textAlign = 'center'
  toast.style.opacity = '0'
  toast.style.transition = 'opacity 0.5s'
  document.body.appendChild(toast)
  setTimeout(() => { toast.style.opacity = '1' }, 100)
  setTimeout(() => { toast.style.opacity = '0' }, 3500)
  setTimeout(() => toast.remove(), 4000)
}

function App() {
  // TEMP: auth bypassed for capture testing – re-enable sign-in gate before production
  const AUTH_BYPASS = true
  const now = useNow(250)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)
  const [liveStreamOpen, setLiveStreamOpen] = useState(false)
  const userCity = 'Auckland'
  const userCountry = 'New Zealand'
  const premiumQuery = useMemo(() => {
    try {
      const qs = new URLSearchParams(window.location.search)
      const q = qs.get('premium')
      if (q === '1' || q === 'true') localStorage.setItem('fivepm_premium', '1')
      if (q === '0' || q === 'false') localStorage.setItem('fivepm_premium', '0')
      return localStorage.getItem('fivepm_premium') === '1'
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return
    void sb.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
      setUserEmail(data.user?.email ?? null)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      setUserEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile(userId)
  const userTz = profile?.timezone ?? getUserTimezone()
  const isPremium = typeof profile?.is_premium === 'boolean' ? profile.is_premium : premiumQuery
  const hasPostedTodayState = AUTH_BYPASS
    ? false
    : hasPostedToday(profile?.last_post_date ?? null, userTz)
  const checkingDailyLimit = AUTH_BYPASS ? false : profileLoading

  const { candidates, bestCandidate } = useMemo(() => {
    if (!CITIES.length) {
      return { candidates: [] as FeaturedCity[], bestCandidate: undefined as FeaturedCity | undefined }
    }

    // Compute per-city local time and difference from 17:00 local time (in minutes).
    // rawDiffMinutes: < 0 before 17:00, > 0 after 17:00, 0 exactly at 17:00
    // wrappedDiffMinutes: spec-style helper: if (diff < 0) diff += 1440
    const computed: FeaturedCity[] = CITIES.map((city) => {
      const local = now.setZone(city.tz)
      const rawDiffMinutes = (local.hour - 17) * 60 + local.minute
      const wrappedDiffMinutes = rawDiffMinutes >= 0 ? rawDiffMinutes : rawDiffMinutes + 1440
      return { city, local, rawDiffMinutes, wrappedDiffMinutes }
    })

    // 1) Cities effectively at 5PM: STRICTLY 17:00 to 17:05 (never before).
    const exact = computed.filter((c) => c.rawDiffMinutes >= 0 && c.rawDiffMinutes <= 5)
    if (exact.length > 0) {
      // Prefer the earliest after-5 city, then alphabetical.
      const sortedExact = [...exact].sort((a, b) => {
        if (a.rawDiffMinutes !== b.rawDiffMinutes) return a.rawDiffMinutes - b.rawDiffMinutes
        return a.city.name.localeCompare(b.city.name)
      })
      return { candidates: computed, bestCandidate: sortedExact[0] }
    }

    // 2) Prefer strictly positive diffs (past 5PM). rawDiffMinutes > 0
    const positive = computed.filter((c) => c.rawDiffMinutes > 0)
    if (positive.length > 0) {
      const bestPositive = [...positive].sort((a, b) => {
        if (a.rawDiffMinutes !== b.rawDiffMinutes) return a.rawDiffMinutes - b.rawDiffMinutes
        return a.city.name.localeCompare(b.city.name)
      })[0]
      return { candidates: computed, bestCandidate: bestPositive }
    }

    // 3) Fallback: no positive diffs at all – pick closest BEFORE 5PM (largest rawDiffMinutes, i.e. closest to 0 from below).
    const negative = computed.filter((c) => c.rawDiffMinutes < 0)
    const bestNegative = [...negative].sort((a, b) => {
      if (a.rawDiffMinutes !== b.rawDiffMinutes) return b.rawDiffMinutes - a.rawDiffMinutes
      return a.city.name.localeCompare(b.city.name)
    })[0]

    return { candidates: computed, bestCandidate: bestNegative }
  }, [now])

  // Stabilize featured city: lock for at least HOLD_MS before switching.
  const HOLD_MS = 15_000
  const [lockedCityId, setLockedCityId] = useState<string | null>(null)
  const lockRef = useRef<{ cityId: string | null; lockUntil: number }>({
    cityId: null,
    lockUntil: 0,
  })

  useEffect(() => {
    if (!bestCandidate) return
    const nowMs = Date.now()
    const { cityId, lockUntil } = lockRef.current

    // If we are within the hold window for a locked city, keep it even if bestCandidate changes.
    if (cityId && nowMs < lockUntil && cityId !== bestCandidate.city.id) {
      return
    }

    // Either hold expired or no lock yet: lock (or relock) to the current best candidate.
    if (cityId !== bestCandidate.city.id) {
      // eslint-disable-next-line no-console
      console.log('Switching featured city to', bestCandidate.city.name, 'after hold expired')
      setLockedCityId(bestCandidate.city.id)
    }
    lockRef.current = { cityId: bestCandidate.city.id, lockUntil: nowMs + HOLD_MS }
  }, [bestCandidate?.city.id, now.toMillis()])

  const featured: FeaturedCity | undefined = useMemo(() => {
    if (!bestCandidate) return undefined
    if (lockedCityId) {
      const locked = candidates.find((c) => c.city.id === lockedCityId)
      if (locked) return locked
    }
    return bestCandidate
  }, [bestCandidate, candidates, lockedCityId])

  const captureWindow = useMemo(
    () => computeCaptureWindow(now, userTz, isPremium),
    [now, userTz, isPremium],
  )

  const featuredFlag = featured ? countryCodeToFlagEmoji(featured.city.countryCode) : '🏳️'
  const featuredCityName = featured?.city.name ?? 'somewhere'
  const featuredCityTime = featured?.local ?? now
  const featuredRawDiff = featured?.rawDiffMinutes ?? 0
  const featuredWrappedDiff = featured?.wrappedDiffMinutes ?? 0

  useEffect(() => {
    if (!featured) return
    // Debugging: verify Luxon local time for the featured city
    // eslint-disable-next-line no-console
    console.log(
      'Selected city:',
      featured.city.name,
      'Local:',
      featuredCityTime.toFormat('HH:mm:ss'),
      'Diff:',
      featuredRawDiff,
      "min (type: " +
        (featuredRawDiff > 0 ? 'past' : featuredRawDiff < 0 ? 'before' : 'exact') +
        `), wrapped=${featuredWrappedDiff}`,
    )
  }, [featured, featuredCityTime])

  const dayRange = useMemo(() => {
    const start = now.startOf('day')
    const end = start.plus({ days: 1 })
    return Interval.fromDateTimes(start, end)
  }, [now])

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden vhs-noise bg-sunset-gradient">
      <div className="app-wrapper-landscape flex-1 min-h-0 flex flex-col overflow-hidden mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 sm:py-4 lg:py-5">
        <header className="app-header-landscape flex-shrink-0 mb-2 sm:mb-4 flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="polaroid-frame app-header-logo-frame p-1.5 sm:p-2 flex-shrink-0">
              <div className="polaroid-inner h-9 w-9 sm:h-12 sm:w-12 grid place-items-center">
                <img
                  src="/Logo.png"
                  alt="5PM Somewhere Logo"
                  className="h-10 w-auto sm:h-12 md:h-14"
                  onLoad={() => {
                    // eslint-disable-next-line no-console
                    console.log('Custom logo loaded')
                  }}
                />
              </div>
            </div>
            <div className="leading-tight min-w-0 overflow-visible">
              <div className="text-[9px] sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.24em] text-sunset-100/80 whitespace-nowrap overflow-visible [text-overflow:clip]">
                5PM Somewhere
              </div>
              <div className="text-[10px] sm:text-xs text-sunset-200/70 font-mono hidden sm:block">
                Luxon + Three.js · PWA
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.24em] text-sunset-100/70">
              Your local time
            </div>
            <div className="font-mono text-xs sm:text-base text-sunset-50/90">{formatClock(DateTime.local())}</div>
            <div className="text-[10px] sm:text-[11px] text-sunset-100/60 hidden sm:block">
              {isPremium ? 'Premium (8 min)' : 'Free (5 min)'} · <span className="font-mono">?premium=1</span>
            </div>
            <div className="mt-1 sm:mt-2 flex justify-end">
              <SignInButton userEmail={userEmail} />
            </div>
          </div>
        </header>

        <main className="app-main-landscape flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-3 sm:gap-4 lg:gap-6 lg:items-stretch content-stretch">
          <section className="app-card-landscape app-clock-panel polaroid-frame p-2 sm:p-4 lg:p-5 min-h-0 flex flex-col overflow-hidden">
            <div className="polaroid-inner p-3 sm:p-5 lg:p-6 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div
                className="uppercase tracking-[0.34em] text-sunset-100/70 text-center"
                style={{ fontSize: 'clamp(1.5rem, 5vw, 2.2rem)', marginBottom: '26px' }}
              >
                Live golden hour
              </div>

              {featured && (
                <div
                  className="mt-1 sm:mt-2 lg:mt-3 mb-8 sm:mb-0 uppercase text-balance font-semibold leading-tight text-center"
                  style={{ fontSize: 'clamp(1.3rem, 4.5vw, 1.8rem)' }}
                >
                  It’s{' '}
                  <span className="text-sunset-200 drop-shadow-[0_0_18px_rgba(255,190,120,0.35)]">
                    5PM
                  </span>{' '}
                  in{' '}
                  <span className="whitespace-nowrap">
                    {featuredFlag} {featuredCityName}
                  </span>{' '}
                  <span className="whitespace-nowrap">{featuredCityTime.toFormat('HH:mm')}</span>{' '}
                  <span className="whitespace-nowrap">{featuredCityTime.toFormat('ccc')}</span>,{' '}
                  <span className="whitespace-nowrap">{featuredCityTime.toFormat('LLL d')}</span>
                </div>
              )}

              <div className="mt-3 sm:mt-5 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center flex-shrink-0">
                <button
                  type="button"
                  className={
                    captureWindow.active && !hasPostedTodayState && !checkingDailyLimit
                      ? 'app-btn-landscape btn-glow-gold w-full sm:w-auto min-h-[48px] sm:min-h-0 text-sm sm:text-base touch-manipulation'
                      : 'app-btn-landscape btn-glow-muted w-full sm:w-auto min-h-[48px] sm:min-h-0 text-sm sm:text-base touch-manipulation'
                  }
                  disabled={!AUTH_BYPASS && (hasPostedTodayState || checkingDailyLimit)}
                  title="Free 5 minute window around 5pm local time"
                  onClick={() => {
                    if (!captureWindow.active) {
                      showToast(
                        "You're outside your personal 5 PM window — come back at 5 PM local time!",
                      )
                      return
                    }
                    if (!AUTH_BYPASS) {
                      if (hasPostedTodayState) {
                        trackDailyLimitHit({ userId, tz: userTz })
                        return
                      }
                      if (!userId) {
                        window.alert('Sign in to capture your 5PM moment.')
                        return
                      }
                    }
                    setRecordOpen(true)
                  }}
                >
                  Capture My 5PM Moment 🎥
                </button>

                <button
                  type="button"
                  className="app-btn-landscape btn-glow-muted w-full sm:w-auto min-h-[48px] sm:min-h-0 text-sm sm:text-base touch-manipulation"
                  onClick={() => setLiveStreamOpen(true)}
                >
                  Watch Live 5PM Stream 🌍
                </button>
              </div>

            </div>
          </section>

          <section className="app-card-landscape app-globe-landscape app-globe-panel polaroid-frame p-2 sm:p-4 lg:p-5 min-h-0 flex flex-col overflow-hidden">
            <div className="polaroid-inner flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="app-globe-container-landscape min-h-0 flex-1 flex flex-col">
                <Globe
                  now={now}
                  cities={CITIES}
                />
              </div>
              <div className="text-[10px] sm:text-xs text-sunset-500/90 text-center py-1.5 sm:py-2 flex-shrink-0">
                Cities at 5PM glow brightest (Range: {Math.round(dayRange.length('hours'))}h)
              </div>
            </div>
          </section>
        </main>
      </div>
      {recordOpen && (userId || AUTH_BYPASS) && (
        <RecordMoment
          open={recordOpen}
          onClose={() => setRecordOpen(false)}
          userId={userId ?? '00000000-0000-0000-0000-000000000000'}
          userTz={userTz}
          city={userCity}
          country={userCountry}
          isPremium={isPremium}
          profile={profile ? { last_post_date: profile.last_post_date, current_streak: profile.current_streak, longest_streak: profile.longest_streak } : null}
          onProfileUpdated={refetchProfile}
        />
      )}
      <LiveStream open={liveStreamOpen} onClose={() => setLiveStreamOpen(false)} />
    </div>
  )
}

export default App
