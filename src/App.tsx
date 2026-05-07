// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useMemo, useRef, useState } from 'react'
import { DateTime, Interval } from 'luxon'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { CITIES, type City } from './data/cities'
import { useNow } from './hooks/useNow'
import { useReachStats } from './hooks/useReachStats'
import { formatClock } from './lib/time'
import { Globe } from './components/Globe'
import { getSupabase } from './lib/supabase'
import {
  computeCaptureWindow,
  getStreakTier,
  getUploadsToday,
  getUserTimezone,
  trackDailyLimitHit,
} from './lib/capture'
import { useProfile } from './hooks/useProfile'
import { RecordMoment } from './components/RecordMoment'
import { LiveStream } from './components/LiveStream'
import MyMoments from './components/MyMoments'
import { ProfileMenu } from './components/ProfileMenu'
import { SignInModal } from './components/SignInModal'
import { CopyrightFooter } from './components/CopyrightFooter'
import { FirstUploadConsentModal } from './components/FirstUploadConsentModal'
import {
  consumeCheckoutReturnStatus,
  startPremiumCheckout,
  type CheckoutReturnStatus,
} from './lib/premium'

type FeaturedCity = {
  city: City
  local: DateTime
  rawDiffMinutes: number // signed minutes from 17:00 (positive = after, negative = before)
  wrappedDiffMinutes: number // 0..1439, minutes past 17:00 with wrap-around (spec helper)
  minutesSinceLastFive: number // 0..1439, minutes since most recent 17:00 (today or yesterday)
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
  const now = useNow(250)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)
  const [liveStreamOpen, setLiveStreamOpen] = useState(false)
  const [myMomentsOpen, setMyMomentsOpen] = useState(false)
  const [dailyLimitModalOpen, setDailyLimitModalOpen] = useState(false)
  const [uploadConsentOpen, setUploadConsentOpen] = useState(false)
  const [signInForCaptureOpen, setSignInForCaptureOpen] = useState(false)
  const [checkoutReturnStatus, setCheckoutReturnStatus] = useState<CheckoutReturnStatus>(null)
  const recordOpenRef = useRef(false)
  const checkoutRefetchDoneRef = useRef(false)
  const userCity = 'Auckland'
  const userCountry = 'New Zealand'
  // Dev-only local override: `?premium=1` / `?premium=0` still flips the
  // stored flag so we can exercise premium flows without a real Stripe
  // purchase. In production the authoritative source is
  // `profiles.is_premium`, which the Stripe webhook maintains.
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
    recordOpenRef.current = recordOpen
  }, [recordOpen])

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return
    void sb.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUserId(data.user?.id ?? null)
      setUserEmail(data.user?.email ?? null)
    })
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session != null) {
        setUserId(session.user?.id ?? null)
        setUserEmail(session.user?.email ?? null)
      } else {
        if (!recordOpenRef.current) {
          setUserId(null)
          setUserEmail(null)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // When the user comes back from Stripe Checkout we surface a status toast
  // and immediately refetch the profile — the webhook may have already
  // flipped `is_premium` by the time they land here.
  useEffect(() => {
    const status = consumeCheckoutReturnStatus()
    setCheckoutReturnStatus(status)
    if (status === 'success') {
      showToast('🎉 Welcome to Premium! Refreshing your perks…')
    } else if (status === 'cancelled') {
      showToast('Checkout cancelled — you can upgrade any time.')
    }
  }, [])

  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile(userId)
  const { stats: reachStats } = useReachStats(userId)
  const userTz = profile?.timezone ?? getUserTimezone()
  const isPremium = userId ? profile?.is_premium === true : false
  const captureIsPremium = userId ? isPremium : premiumQuery

  useEffect(() => {
    if (checkoutReturnStatus !== 'success' || !userId || checkoutRefetchDoneRef.current) return
    checkoutRefetchDoneRef.current = true
    void refetchProfile()
  }, [checkoutReturnStatus, refetchProfile, userId])

  const checkingDailyLimit = profileLoading
  const currentStreak = profile?.current_streak ?? 0
  const streakTier = getStreakTier(currentStreak)
  const uploadsToday = getUploadsToday(userId, userTz)
  const extraDailyUploads = streakTier?.extraDailyUploads ?? 0
  const maxUploadsPerDay = isPremium ? 3 : 1 + extraDailyUploads
  const hasUsedDailyQuota = uploadsToday >= maxUploadsPerDay
  const captureButtonDisabled = checkingDailyLimit

  const { candidates, bestCandidate } = useMemo(() => {
    if (!CITIES.length) {
      return { candidates: [] as FeaturedCity[], bestCandidate: undefined as FeaturedCity | undefined }
    }

    // Compute per-city local time and difference from 17:00 local time (in minutes).
    // rawDiffMinutes: < 0 before 17:00, > 0 after 17:00, 0 exactly at 17:00 (today)
    // wrappedDiffMinutes: spec-style helper: if (diff < 0) diff += 1440
    // minutesSinceLastFive: minutes since MOST RECENT 17:00 (today or yesterday), always 0..1439
    const computed: FeaturedCity[] = CITIES.map((city) => {
      const local = now.setZone(city.tz)
      const minutesToday = local.hour * 60 + local.minute
      const FIVE_PM = 17 * 60
      const MINUTES_PER_DAY = 24 * 60
      const rawDiffMinutes = minutesToday - FIVE_PM
      const wrappedDiffMinutes = rawDiffMinutes >= 0 ? rawDiffMinutes : rawDiffMinutes + 1440
      const minutesSinceLastFive = (minutesToday - FIVE_PM + MINUTES_PER_DAY) % MINUTES_PER_DAY
      return { city, local, rawDiffMinutes, wrappedDiffMinutes, minutesSinceLastFive }
    })

    // Use day number to rotate between candidate cities across days.
    const dayNumber = Math.floor(now.toUTC().toSeconds() / 86400)
    const MAX_MINUTES_SINCE_5 = 120 // 5pm–7pm window over the last 24 hours

    // Only consider cities where the MOST RECENT 5PM (today or yesterday) was within the last 2 hours.
    const windowCities = computed.filter((c) => c.minutesSinceLastFive <= MAX_MINUTES_SINCE_5)
    if (windowCities.length === 0) {
      // No city currently between 5pm and 7pm (in the last 24h) in its own timezone.
      return { candidates: computed, bestCandidate: undefined }
    }

    // Among those, pick the closest past 5PM (smallest minutesSinceLastFive), with daily rotation over ties.
    const minSince = Math.min(...windowCities.map((c) => c.minutesSinceLastFive))
    const closest = windowCities.filter(
      (c) => Math.abs(c.minutesSinceLastFive - minSince) <= 1,
    )
    const sorted = [...closest].sort((a, b) => {
      if (a.minutesSinceLastFive !== b.minutesSinceLastFive) {
        return a.minutesSinceLastFive - b.minutesSinceLastFive
      }
      return a.city.name.localeCompare(b.city.name)
    })
    const idx = dayNumber % sorted.length
    return { candidates: computed, bestCandidate: sorted[idx] }
  }, [now])

  // Stabilize featured city: lock for at least HOLD_MS before switching.
  const HOLD_MS = 15_000
  const [lockedCityId, setLockedCityId] = useState<string | null>(null)
  const lockRef = useRef<{ cityId: string | null; lockUntil: number }>({
    cityId: null,
    lockUntil: 0,
  })
  const bestCandidateCityId = bestCandidate?.city.id ?? null
  const nowMillis = now.toMillis()

  useEffect(() => {
    if (!bestCandidateCityId) return
    const nowMs = Date.now()
    const { cityId, lockUntil } = lockRef.current

    // If we are within the hold window for a locked city, keep it even if bestCandidate changes.
    if (cityId && nowMs < lockUntil && cityId !== bestCandidateCityId) {
      return
    }

    // Either hold expired or no lock yet: lock (or relock) to the current best candidate.
    if (cityId !== bestCandidateCityId) {
      setLockedCityId(bestCandidateCityId)
    }
    lockRef.current = { cityId: bestCandidateCityId, lockUntil: nowMs + HOLD_MS }
  }, [bestCandidateCityId, nowMillis])

  const featured: FeaturedCity | undefined = useMemo(() => {
    if (!bestCandidate) return undefined
    if (lockedCityId) {
      const locked = candidates.find((c) => c.city.id === lockedCityId)
      if (locked) return locked
    }
    return bestCandidate
  }, [bestCandidate, candidates, lockedCityId])

  const captureWindow = useMemo(
    () => computeCaptureWindow(now, userTz, captureIsPremium, currentStreak),
    [now, userTz, captureIsPremium, currentStreak],
  )

  const captureButtonGold =
    captureWindow.active && !hasUsedDailyQuota && !checkingDailyLimit

  const featuredCityName = featured?.city.name ?? 'somewhere'
  const featuredCountryName = featured
    ? (() => {
        try {
          return new Intl.DisplayNames(['en'], { type: 'region' }).of(featured.city.countryCode) ?? featured.city.countryCode
        } catch {
          return featured.city.countryCode
        }
      })()
    : ''
  const featuredCityTime = featured?.local ?? now

  const dayRange = useMemo(() => {
    const start = now.startOf('day')
    const end = start.plus({ days: 1 })
    return Interval.fromDateTimes(start, end)
  }, [now])

  return (
    <div className="app-one-screen-root flex flex-col overflow-hidden vhs-noise bg-sunset-gradient">
      <div className="app-wrapper-landscape flex-1 min-h-0 flex flex-col overflow-hidden mx-auto w-full max-w-6xl max-h-full px-3 py-2 sm:px-4 sm:py-3 lg:py-5">
        <header className="app-header-landscape flex-shrink-0 mb-1.5 sm:mb-4 flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex items-start gap-2 sm:gap-3 min-w-0">
            <div className="flex-shrink-0 flex items-start justify-center min-w-0">
              <img
                src="/Logo.png"
                alt="5PM Somewhere Logo"
                className="block h-14 w-auto max-w-full max-h-[56px] object-contain sm:h-24 sm:max-h-none md:h-28 lg:h-32"
              />
            </div>
            <div className="leading-tight min-w-0 overflow-visible mt-2 sm:mt-5 md:mt-6 lg:mt-7">
              <div className="text-[9px] sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.24em] text-sunset-100/80 whitespace-nowrap overflow-visible [text-overflow:clip]">
                5PM Somewhere
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.24em] text-sunset-100/70">
              Your local time
            </div>
            <div className="font-mono text-xs sm:text-base text-sunset-50/90">{formatClock(DateTime.local())}</div>
            <div className="mt-1 sm:mt-2 flex justify-end items-center gap-2">
              <ProfileMenu
                userEmail={userEmail}
                userId={userId}
                userTz={userTz}
                isPremium={isPremium}
                onOpenMyMoments={() => setMyMomentsOpen(true)}
              />
            </div>
          </div>
        </header>

        <main className="app-main-landscape flex-1 min-h-0 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-1 gap-2 sm:gap-4 lg:gap-6 lg:items-stretch content-stretch">
          <section className="app-card-landscape app-clock-panel polaroid-frame p-2 sm:p-4 lg:p-5 min-h-0 flex flex-col overflow-hidden max-lg:flex-shrink-0">
            <div className="polaroid-inner p-2.5 sm:p-5 lg:p-6 flex min-h-0 flex-1 flex-col overflow-hidden max-lg:min-h-0">
              {featured && (
                <div className="flex flex-col items-center gap-4 sm:gap-5 lg:gap-6 text-center shrink-0 mb-3 sm:mb-5 lg:mb-6">
                  <div
                    className="uppercase tracking-[0.34em] text-sunset-100/70"
                    style={{ fontSize: 'clamp(1rem, 4vw, 1.8rem)' }}
                  >
                    IT&apos;S 5:00 PM IN
                  </div>
                  <div
                    className="uppercase font-semibold tracking-[0.22em] text-sunset-100 text-balance leading-tight drop-shadow-[0_0_18px_rgba(255,160,80,0.55)] [text-shadow:0_0_28px_rgba(255,120,60,0.45),0_0_48px_rgba(255,90,40,0.2)]"
                    style={{ fontSize: 'clamp(1.45rem, 5.5vw, 2.85rem)' }}
                  >
                    {featuredCityName}
                  </div>
                  <div
                    className="flex flex-wrap justify-center items-baseline gap-x-3 sm:gap-x-4 gap-y-1 uppercase tracking-[0.12em] text-sunset-100/75"
                    style={{ fontSize: 'clamp(0.8rem, 2vw, 1.05rem)' }}
                  >
                    <span className="whitespace-nowrap">{featuredCityTime.toFormat('h:mm a')}</span>
                    <span className="whitespace-nowrap">{featuredCityTime.toFormat('ccc')}</span>
                    <span className="whitespace-nowrap">{featuredCityTime.toFormat('LLL d')}</span>
                    {featuredCountryName ? (
                      <span className="whitespace-nowrap">{featuredCountryName}</span>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="mt-2 sm:mt-5 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center flex-shrink-0">
                <button
                  type="button"
                  className={
                    captureButtonGold
                      ? 'app-btn-landscape app-btn-capture-sunset btn-glow-gold w-full sm:w-auto min-h-[48px] sm:min-h-0 text-sm sm:text-base touch-manipulation'
                      : 'app-btn-landscape btn-glow-muted w-full sm:w-auto min-h-[48px] sm:min-h-0 text-sm sm:text-base touch-manipulation'
                  }
                  disabled={captureButtonDisabled}
                  title="Upload your 5PM moment during your active window"
                  onClick={() => {
                    if (!captureWindow.active) {
                      showToast(
                        "You're outside your personal 5:00 PM window — come back at 5:00 PM local time!",
                      )
                      return
                    }
                    if (hasUsedDailyQuota) {
                      trackDailyLimitHit({ userId, tz: userTz })
                      setDailyLimitModalOpen(true)
                      return
                    }
                    if (!userId) {
                      setSignInForCaptureOpen(true)
                      return
                    }
                    if (!profile?.upload_terms_accepted_at) {
                      setUploadConsentOpen(true)
                      return
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
                  Watch Live 5PM Moments 🌍
                </button>
              </div>

            </div>
          </section>

          <section className="app-card-landscape app-globe-landscape app-globe-panel polaroid-frame p-2 sm:p-4 lg:p-5 min-h-0 flex flex-col overflow-hidden max-lg:min-h-0">
            <div className="polaroid-inner flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="app-globe-container-landscape min-h-0 flex-1 flex flex-col overflow-hidden">
                <Globe
                  now={now}
                  cities={CITIES}
                />
              </div>
              <div className="text-[10px] sm:text-xs text-sunset-500/90 text-center py-1 sm:py-2 flex-shrink-0">
                Cities at 5:00 PM glow brightest (Range: {Math.round(dayRange.length('hours'))}h)
              </div>
            </div>
          </section>
        </main>
        <CopyrightFooter variant="main" className="shrink-0" />
      </div>
      <SignInModal
        open={signInForCaptureOpen}
        onClose={() => setSignInForCaptureOpen(false)}
        contextMessage="To create and save your 5PM moment, sign in first. After you sign in, tap Capture again during your window."
      />
      <FirstUploadConsentModal
        open={uploadConsentOpen}
        onClose={() => setUploadConsentOpen(false)}
        onAccepted={async () => {
          const sb = getSupabase()
          if (!sb || !userId) return
          const { error } = await sb
            .from('profiles')
            .update({ upload_terms_accepted_at: new Date().toISOString() })
            .eq('id', userId)
          if (error) {
            window.alert(error.message ?? 'Could not save your agreement. Please try again.')
            return
          }
          await refetchProfile()
          setUploadConsentOpen(false)
          setRecordOpen(true)
        }}
      />
      {recordOpen && userId && (
        <RecordMoment
          open={recordOpen}
          onClose={() => setRecordOpen(false)}
          userId={userId}
          userTz={userTz}
          city={userCity}
          country={userCountry}
          isPremium={captureIsPremium}
          profile={
            profile
              ? {
                  last_post_date: profile.last_post_date,
                  current_streak: profile.current_streak,
                  longest_streak: profile.longest_streak,
                  total_uploads: profile.total_uploads,
                }
              : null
          }
          onProfileUpdated={refetchProfile}
        />
      )}
      <LiveStream
        open={liveStreamOpen}
        onClose={() => setLiveStreamOpen(false)}
        userId={userId}
        reachStats={reachStats}
        currentStreak={currentStreak}
      />
      {userId && (
        <MyMoments
          open={myMomentsOpen}
          onClose={() => setMyMomentsOpen(false)}
          userId={userId}
        />
      )}
      {dailyLimitModalOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-limit-title"
          onClick={() => setDailyLimitModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-midnight-900/95 p-4 shadow-xl border border-sunset-500/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                id="daily-limit-title"
                className="text-xs font-semibold tracking-[0.14em] uppercase text-sunset-100/80"
              >
                Daily limit
              </div>
              <button
                type="button"
                onClick={() => setDailyLimitModalOpen(false)}
                className="text-[11px] text-sunset-100/70 hover:text-sunset-50"
              >
                Close
              </button>
            </div>
            <p className="text-sm text-sunset-100/90 mb-4">
              You&apos;ve already posted your 5PM moment for today. Premium includes up to 3 moments per
              day — upgrade to capture more.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDailyLimitModalOpen(false)}
                className="btn-glow-muted w-full sm:w-auto min-h-[44px] px-4 text-sm touch-manipulation"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = await startPremiumCheckout()
                  if (!result.ok) {
                    window.alert(result.error)
                    return
                  }
                  window.location.href = result.url
                }}
                className="btn-glow-gold w-full sm:w-auto min-h-[44px] px-4 text-sm touch-manipulation"
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
