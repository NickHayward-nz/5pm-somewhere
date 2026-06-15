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
  getFreeCaptureWindowClosingSoon,
  getStreakTier,
  getUploadsToday,
  getUserTimezone,
  isInPremiumExtensionCaptureWindow,
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
import {
  captureEvent,
  capturePageView,
  identifyUser,
  resetAnalytics,
} from './lib/analytics'
import { consumePendingLegalAcceptance, recordAccountLegalAcceptance } from './lib/legal'

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

function isSharePath() {
  return typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/share'
}

function isHowItWorksPath() {
  return typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/how-it-works'
}

function HowItWorksCard({ compact = false, onOpen }: { compact?: boolean; onOpen?: () => void }) {
  if (compact) {
    return (
      <div className="app-how-it-works-action mt-2 flex w-full justify-center sm:mt-3">
        <button
          type="button"
          className="app-btn-landscape btn-glow-muted w-full sm:w-auto min-h-[48px] sm:min-h-0 text-sm sm:text-base touch-manipulation sm:shrink-0"
          onClick={onOpen}
        >
          How it works
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left shadow-lg sm:mt-4 sm:px-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sunset-100/70">
        How it works
      </div>
      <div className="grid gap-2 text-[11px] leading-snug text-sunset-100/80 sm:grid-cols-3 sm:text-xs">
        <div>
          <span className="font-semibold text-sunset-50">1. Capture</span> your short moment at 5:00 PM local time.
        </div>
        <div>
          <span className="font-semibold text-sunset-50">2. Watch</span> live 5:00 PM moments from around the world.
        </div>
        <div>
          <span className="font-semibold text-sunset-50">3. Build</span> streaks, reach, and Premium highlights.
        </div>
      </div>
    </div>
  )
}

type HowItWorksPageProps = {
  isSignedIn: boolean
  isPremium: boolean
  onBack: () => void
  onWatchLive: () => void
  onSignIn: () => void
  onUpgrade: () => void
}

function HowItWorksPage({ isSignedIn, isPremium, onBack, onWatchLive, onSignIn, onUpgrade }: HowItWorksPageProps) {
  return (
    <div className="app-one-screen-root flex flex-col overflow-hidden vhs-noise bg-sunset-gradient">
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-4 py-4 sm:py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <img src="/Logo.png" alt="5PM Somewhere Logo" className="h-16 w-auto object-contain sm:h-20" />
          <button
            type="button"
            onClick={onBack}
            className="btn-glow-muted min-h-[44px] px-4 text-sm touch-manipulation"
          >
            Back
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-[2rem] border border-white/15 bg-midnight-900/75 p-4 shadow-2xl backdrop-blur-md sm:p-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sunset-100/70">
            How it works
          </div>
          <h1 className="mb-3 text-2xl font-semibold text-sunset-50 sm:text-4xl">
            One short moment, every day at 5:00 PM.
          </h1>
          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-sunset-100/85 sm:text-base">
            5PM Somewhere is a daily global video ritual. When it reaches 5:00 PM where you are,
            capture one short clip, send it into the live stream, and watch real 5:00 PM moments
            from other people as the day moves around the world.
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 text-sm font-semibold text-sunset-50">Capture your moment</div>
              <p className="text-xs leading-relaxed text-sunset-100/75">
                When your local window opens, record one quick clip of whatever 5:00 PM looks like
                today — sunset, dinner, commute, work, kids, friends, quiet, chaos.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 text-sm font-semibold text-sunset-50">Watch live 5:00 PMs</div>
              <p className="text-xs leading-relaxed text-sunset-100/75">
                The live stream shows fresh 5:00 PM clips from cities whose evening has just arrived,
                so the ritual keeps moving from timezone to timezone.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 text-sm font-semibold text-sunset-50">Build your streak</div>
              <p className="text-xs leading-relaxed text-sunset-100/75">
                Posting consistently builds a tiny daily memory, a streak, and a reason to come back
                tomorrow when your next 5:00 PM arrives.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              Premium benefits
            </div>
            <div className="grid gap-2 text-xs leading-relaxed text-sunset-100/80 sm:grid-cols-2">
              <div>Longer 5:00 PM window: 30 minutes to capture (free users get 15 minutes).</div>
              <div>Longer recordings: up to 30 seconds instead of the free recording length.</div>
              <div>More daily uploads: capture up to 3 moments per day.</div>
              <div>Premium priority: stronger placement in the live stream queue.</div>
              <div>Premium styling: exclusive visual treatment on captured moments.</div>
              <div>Weekly montage playback for your best eligible moments.</div>
              <div>Monthly highlights when enough moments are available.</div>
            </div>
            <div className="mt-3 text-[11px] text-amber-100/75">
              {isPremium
                ? 'Premium is active on your account.'
                : isSignedIn
                  ? 'Upgrade to Premium when you are ready.'
                  : 'Sign in from the Profile menu to upgrade when you are ready.'}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onWatchLive}
              className="btn-glow-gold min-h-[48px] px-5 text-sm touch-manipulation"
            >
              Watch live moments
            </button>
            {!isPremium ? (
              <button
                type="button"
                onClick={isSignedIn ? onUpgrade : onSignIn}
                className="btn-glow-muted min-h-[48px] px-5 text-sm touch-manipulation"
              >
                {isSignedIn ? 'Upgrade to Premium' : 'Sign in to capture'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <CopyrightFooter variant="main" className="shrink-0" />
    </div>
  )
}

type ShareLandingProps = {
  onWatchLive: () => void
  onSignIn: () => void
  onEnterApp: () => void
}

function ShareLanding({ onWatchLive, onSignIn, onEnterApp }: ShareLandingProps) {
  return (
    <div className="app-one-screen-root flex flex-col overflow-hidden vhs-noise bg-sunset-gradient">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-6 text-center">
        <img
          src="/Logo.png"
          alt="5PM Somewhere Logo"
          className="mb-4 h-24 w-auto object-contain sm:h-32"
        />
        <div className="w-full rounded-[2rem] border border-white/15 bg-midnight-900/70 p-5 shadow-2xl backdrop-blur-md sm:p-7">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sunset-100/70">
            Shared from 5PM Somewhere
          </div>
          <h1 className="mb-3 text-2xl font-semibold text-sunset-50 sm:text-4xl">
            See what 5:00 PM looks like around the world.
          </h1>
          <p className="mx-auto mb-5 max-w-xl text-sm leading-relaxed text-sunset-100/85 sm:text-base">
            Capture your own daily 5:00 PM moment, watch live uploads as the sunset moves around the
            globe, and share the view with friends.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onWatchLive}
              className="btn-glow-gold min-h-[48px] px-5 text-sm touch-manipulation"
            >
              Watch live moments
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="btn-glow-muted min-h-[48px] px-5 text-sm touch-manipulation"
            >
              Sign in to capture
            </button>
            <button
              type="button"
              onClick={onEnterApp}
              className="btn-glow-muted min-h-[48px] px-5 text-sm touch-manipulation"
            >
              Enter app
            </button>
          </div>
          <HowItWorksCard />
        </div>
      </div>
      <CopyrightFooter variant="main" className="shrink-0" />
    </div>
  )
}

function App() {
  const now = useNow(250)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)
  const [liveStreamOpen, setLiveStreamOpen] = useState(false)
  const [myMomentsOpen, setMyMomentsOpen] = useState(false)
  const [dailyLimitModalOpen, setDailyLimitModalOpen] = useState(false)
  const [premiumWindowModalOpen, setPremiumWindowModalOpen] = useState(false)
  const [windowClosingBannerDismissed, setWindowClosingBannerDismissed] = useState(false)
  const [uploadConsentOpen, setUploadConsentOpen] = useState(false)
  const [signInForCaptureOpen, setSignInForCaptureOpen] = useState(false)
  const [shareLandingSignInOpen, setShareLandingSignInOpen] = useState(false)
  const [howItWorksSignInOpen, setHowItWorksSignInOpen] = useState(false)
  const [shareLandingOpen, setShareLandingOpen] = useState(isSharePath)
  const [howItWorksOpen, setHowItWorksOpen] = useState(isHowItWorksPath)
  const [checkoutReturnStatus, setCheckoutReturnStatus] = useState<CheckoutReturnStatus>(null)
  const recordOpenRef = useRef(false)
  const checkoutRefetchDoneRef = useRef(false)
  const signedInToastShownRef = useRef(false)
  const userCity = 'Auckland'
  const userCountry = 'New Zealand'
  // Dev-only: `?premium=1` exercises capture flows without Stripe. Ignored in production.
  const premiumQuery = useMemo(() => {
    if (!import.meta.env.DEV) return false
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
    const syncRouteState = () => {
      setShareLandingOpen(isSharePath())
      setHowItWorksOpen(isHowItWorksPath())
    }
    window.addEventListener('popstate', syncRouteState)
    return () => window.removeEventListener('popstate', syncRouteState)
  }, [])

  useEffect(() => {
    capturePageView(howItWorksOpen ? '/how-it-works' : shareLandingOpen ? '/share' : '/')
  }, [howItWorksOpen, shareLandingOpen])

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return
    void sb.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUserId(data.user?.id ?? null)
      setUserEmail(data.user?.email ?? null)
    })
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (session != null) {
        setUserId(session.user?.id ?? null)
        setUserEmail(session.user?.email ?? null)
        if (event === 'SIGNED_IN' && !signedInToastShownRef.current) {
          captureEvent('auth_signed_in', { auth_event: event })
          if (session.user?.id) {
            identifyUser({ id: session.user.id, email: session.user.email })
            const pendingLegalAcceptance = consumePendingLegalAcceptance()
            if (pendingLegalAcceptance) {
              void recordAccountLegalAcceptance(sb, session.user.id, pendingLegalAcceptance)
                .then(() => captureEvent('legal_account_terms_recorded', { source: pendingLegalAcceptance.source }))
                .catch((error) => {
                  console.error('Failed to record legal acceptance:', error)
                  captureEvent('legal_account_terms_record_failed', {
                    source: pendingLegalAcceptance.source,
                    error_name: error instanceof Error ? error.name : 'UnknownError',
                  })
                })
            }
          }
          signedInToastShownRef.current = true
          showToast("You're signed in.")
        }
      } else {
        if (event === 'SIGNED_OUT') {
          captureEvent('auth_signed_out')
          resetAnalytics()
        }
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
      captureEvent('premium_checkout_returned', { status })
      showToast('🎉 Welcome to Premium! Refreshing your perks…')
    } else if (status === 'cancelled') {
      captureEvent('premium_checkout_returned', { status })
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

  useEffect(() => {
    if (!userId) return
    identifyUser({
      id: userId,
      email: userEmail,
      isPremium,
      timezone: userTz,
      currentStreak,
      totalUploads: profile?.total_uploads ?? null,
    })
  }, [currentStreak, isPremium, profile?.total_uploads, userEmail, userId, userTz])

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

  const freeWindowClosingSoon = useMemo(
    () => getFreeCaptureWindowClosingSoon(now, userTz, captureIsPremium, currentStreak),
    [now, userTz, captureIsPremium, currentStreak],
  )

  const windowClosingDismissKey = useMemo(() => {
    const day = now.setZone(userTz).toFormat('yyyy-LL-dd')
    return `fivepm_window_closing_dismissed_${day}`
  }, [now, userTz])

  useEffect(() => {
    try {
      setWindowClosingBannerDismissed(localStorage.getItem(windowClosingDismissKey) === '1')
    } catch {
      setWindowClosingBannerDismissed(false)
    }
  }, [windowClosingDismissKey])

  const showWindowClosingBanner =
    captureWindow.active &&
    freeWindowClosingSoon.active &&
    !captureIsPremium &&
    !windowClosingBannerDismissed

  const outsideWindowMessage = `Post a clip at your local 5PM, and watch the 5PM moments roll across the globe.`

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

  const openMainApp = () => {
    window.history.pushState({}, '', '/')
    setShareLandingOpen(false)
    setHowItWorksOpen(false)
  }

  const openHowItWorks = () => {
    window.history.pushState({}, '', '/how-it-works')
    setShareLandingOpen(false)
    setHowItWorksOpen(true)
  }

  const signInModalOpen = signInForCaptureOpen || shareLandingSignInOpen || howItWorksSignInOpen
  const signInContextMessage = shareLandingSignInOpen || howItWorksSignInOpen
    ? 'Sign in to capture your own 5:00 PM moment and save it to your account.'
    : 'To create and save your 5PM moment, sign in first. After you sign in, tap Capture again during your window.'

  if (howItWorksOpen) {
    return (
      <>
        <HowItWorksPage
          isSignedIn={Boolean(userId)}
          isPremium={isPremium}
          onBack={openMainApp}
          onWatchLive={() => setLiveStreamOpen(true)}
          onSignIn={() => setHowItWorksSignInOpen(true)}
          onUpgrade={async () => {
            captureEvent('premium_checkout_cta_clicked', { surface: 'how_it_works' })
            const result = await startPremiumCheckout()
            if (!result.ok) {
              window.alert(result.error)
              return
            }
            window.location.href = result.url
          }}
        />
        <LiveStream
          open={liveStreamOpen}
          onClose={() => setLiveStreamOpen(false)}
          userId={userId}
          reachStats={reachStats}
          currentStreak={currentStreak}
        />
        <SignInModal
          open={signInModalOpen}
          onClose={() => {
            setSignInForCaptureOpen(false)
            setShareLandingSignInOpen(false)
            setHowItWorksSignInOpen(false)
          }}
          contextMessage={signInContextMessage}
        />
      </>
    )
  }

  if (shareLandingOpen) {
    return (
      <>
        <ShareLanding
          onWatchLive={() => setLiveStreamOpen(true)}
          onSignIn={() => setShareLandingSignInOpen(true)}
          onEnterApp={openMainApp}
        />
        <LiveStream
          open={liveStreamOpen}
          onClose={() => setLiveStreamOpen(false)}
          userId={userId}
          reachStats={reachStats}
          currentStreak={currentStreak}
        />
        <SignInModal
          open={signInModalOpen}
          onClose={() => {
            setSignInForCaptureOpen(false)
            setShareLandingSignInOpen(false)
            setHowItWorksSignInOpen(false)
          }}
          contextMessage={signInContextMessage}
        />
      </>
    )
  }

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
                <div className="flex flex-col items-center gap-3 text-center shrink-0 mb-2 sm:mb-4 lg:mb-5">
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

              {showWindowClosingBanner && (
                <div
                  className="mt-2 sm:mt-4 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100/90 sm:text-sm"
                  role="status"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {freeWindowClosingSoon.minutesLeft <= 0
                        ? 'Your free capture window is ending now.'
                        : freeWindowClosingSoon.minutesLeft === 1
                          ? 'About 1 minute left in your free capture window.'
                          : `About ${freeWindowClosingSoon.minutesLeft} minutes left in your free capture window.`}{' '}
                      Premium gives you until 5:30 PM local time.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.setItem(windowClosingDismissKey, '1')
                        } catch {
                          // ignore
                        }
                        setWindowClosingBannerDismissed(true)
                      }}
                      className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-amber-200/90 hover:text-amber-50 touch-manipulation"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <div className="app-primary-actions mt-2 sm:mt-5 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center flex-shrink-0">
                <button
                  type="button"
                  className={
                    captureButtonGold
                      ? 'app-btn-landscape app-btn-capture-sunset btn-glow-gold w-full sm:w-auto min-h-[48px] sm:min-h-0 text-sm sm:text-base touch-manipulation'
                      : 'app-btn-landscape btn-glow-muted w-full sm:w-auto min-h-[48px] sm:min-h-0 text-sm sm:text-base touch-manipulation'
                  }
                  disabled={captureButtonDisabled}
                  title="Post one short video when your local 5:00 PM window opens"
                  onClick={() => {
                    captureEvent('capture_intent', {
                      active_window: captureWindow.active,
                      is_premium: captureIsPremium,
                      has_used_daily_quota: hasUsedDailyQuota,
                      uploads_today: uploadsToday,
                      max_uploads_per_day: maxUploadsPerDay,
                      streak_days: currentStreak,
                    })
                    if (!captureWindow.active) {
                      if (
                        isInPremiumExtensionCaptureWindow(
                          now,
                          userTz,
                          captureIsPremium,
                          currentStreak,
                        )
                      ) {
                        captureEvent('capture_blocked', {
                          reason: 'premium_extension_window',
                          diff_minutes: captureWindow.diffMinutes,
                          timezone: userTz,
                        })
                        setPremiumWindowModalOpen(true)
                        return
                      }
                      captureEvent('capture_blocked', {
                        reason: 'outside_window',
                        diff_minutes: captureWindow.diffMinutes,
                        timezone: userTz,
                      })
                      showToast(outsideWindowMessage)
                      return
                    }
                    if (hasUsedDailyQuota) {
                      trackDailyLimitHit({
                        userId,
                        tz: userTz,
                        uploads_today: uploadsToday,
                        max_uploads_per_day: maxUploadsPerDay,
                      })
                      captureEvent('capture_blocked', { reason: 'daily_limit' })
                      setDailyLimitModalOpen(true)
                      return
                    }
                    if (!userId) {
                      captureEvent('capture_blocked', { reason: 'sign_in_required' })
                      setSignInForCaptureOpen(true)
                      return
                    }
                    if (!profile?.upload_terms_accepted_at) {
                      captureEvent('capture_blocked', { reason: 'upload_terms_required' })
                      setUploadConsentOpen(true)
                      return
                    }
                    captureEvent('capture_modal_opened', {
                      is_premium: captureIsPremium,
                      timezone: userTz,
                    })
                    setRecordOpen(true)
                  }}
                >
                  Capture today&apos;s 5PM 🎥
                </button>

                <button
                  type="button"
                  className="app-btn-landscape btn-glow-muted w-full sm:w-auto min-h-[48px] sm:min-h-0 text-sm sm:text-base touch-manipulation"
                  onClick={() => setLiveStreamOpen(true)}
                >
                  Watch Live 5PM Moments 🌍
                </button>
              </div>
              {!captureWindow.active && (
                <div className="mt-2 rounded-xl border border-sunset-300/25 bg-midnight-900/45 px-3 py-2 text-center text-xs leading-relaxed text-sunset-100/80 sm:mt-3 sm:text-sm">
                  {outsideWindowMessage}
                </div>
              )}
              <HowItWorksCard compact onOpen={openHowItWorks} />

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
        open={signInModalOpen}
        onClose={() => {
          setSignInForCaptureOpen(false)
          setShareLandingSignInOpen(false)
          setHowItWorksSignInOpen(false)
        }}
        contextMessage={signInContextMessage}
      />
      <FirstUploadConsentModal
        open={uploadConsentOpen}
        onClose={() => setUploadConsentOpen(false)}
        onAccepted={async () => {
          const sb = getSupabase()
          if (!sb || !userId) return
          const { error } = await sb
            .from('profiles')
            .update({
              upload_terms_accepted_at: new Date().toISOString(),
              upload_terms_version: '2026-06-12',
            })
            .eq('id', userId)
          if (error) {
            window.alert(error.message ?? 'Could not save your agreement. Please try again.')
            return
          }
          captureEvent('upload_terms_accepted', { userId })
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
          onWatchLive={() => {
            setRecordOpen(false)
            setLiveStreamOpen(true)
          }}
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
          isPremium={isPremium}
        />
      )}
      {premiumWindowModalOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-window-title"
          onClick={() => setPremiumWindowModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-midnight-900/95 p-4 shadow-xl border border-sunset-500/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                id="premium-window-title"
                className="text-xs font-semibold tracking-[0.14em] uppercase text-sunset-100/80"
              >
                Capture window ended
              </div>
              <button
                type="button"
                onClick={() => setPremiumWindowModalOpen(false)}
                className="text-[11px] text-sunset-100/70 hover:text-sunset-50"
              >
                Close
              </button>
            </div>
            <p className="text-sm text-sunset-100/90 mb-4">
              Your free 15-minute capture window has ended, but you&apos;re still within today&apos;s
              5:00 PM period. Upgrade to Premium for an additional 15 minutes to capture your moment
              (5:00–5:30 PM local time).
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPremiumWindowModalOpen(false)}
                className="btn-glow-muted w-full sm:w-auto min-h-[44px] px-4 text-sm touch-manipulation"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={async () => {
                  captureEvent('premium_checkout_cta_clicked', {
                    surface: 'premium_window_modal',
                  })
                  const result = await startPremiumCheckout()
                  if (!result.ok) {
                    window.alert(result.error)
                    return
                  }
                  window.location.href = result.url
                }}
                className="btn-glow-gold w-full sm:w-auto min-h-[44px] px-4 text-sm touch-manipulation"
              >
                Upgrade to Premium
              </button>
            </div>
          </div>
        </div>
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
                  captureEvent('premium_checkout_cta_clicked', { surface: 'daily_limit_modal' })
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
