// © 2026 Chromatic Productions Ltd. All rights reserved.
import type Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { CopyrightFooter } from './CopyrightFooter'
import { SignInModal } from './SignInModal'
import { PrivacyPolicyText, TermsOfServiceText } from './PolicyLegalContent'
import { PwaInstallPrompt } from './PwaInstallPrompt'
import { NotificationSettings } from './NotificationSettings'
import { startBillingPortal, startPremiumCheckout } from '../lib/premium'

const SUPPORT_EMAIL = 'its.5pm.somewhere.app@gmail.com'
const PROFILE_SHARE_TITLE = '5PM Somewhere'
const PROFILE_SHARE_TEXT = 'Join me on 5PM Somewhere and share your 5PM moment.'

type MontageKind = 'weekly' | 'monthly'

type MontageRow = {
  id: string
  kind: MontageKind
  title: string | null
  playback_url: string | null
  period_start: string
  period_end: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  error_message: string | null
  created_at: string
}

type MontageState =
  | { status: 'idle' | 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; montage: MontageRow }

type Props = {
  userEmail: string | null
  userId: string | null
  userTz: string
  isPremium: boolean
  onOpenMyMoments: () => void
}

function formatPeriod(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const inclusiveEnd = new Date(new Date(end).getTime() - 1)
  return `${fmt.format(new Date(start))} – ${fmt.format(inclusiveEnd)}`
}

function MontageVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    let cancelled = false
    let hls: Hls | null = null

    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) {
        video.src = src
        return
      }
      hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(video)
    })

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className="mt-3 aspect-video w-full rounded-xl bg-black"
    />
  )
}

function buildProfileShareLink(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'https://5pmsomewhere.app'
}

export function ProfileMenu({ userEmail, userId, userTz, isPremium, onOpenMyMoments }: Props) {
  const sb = getSupabase()
  const [profileOpen, setProfileOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const [policyOpen, setPolicyOpen] = useState<null | 'terms' | 'privacy'>(null)
  const [montageOpen, setMontageOpen] = useState<null | 'weekly' | 'monthly'>(null)
  const [premiumPitch, setPremiumPitch] = useState<null | 'weekly' | 'monthly'>(null)
  const [checkoutStarting, setCheckoutStarting] = useState(false)
  const [billingPortalStarting, setBillingPortalStarting] = useState(false)
  const [montageState, setMontageState] = useState<MontageState>({ status: 'idle' })
  const [shareStatus, setShareStatus] = useState<string | null>(null)

  const displayName = userEmail?.trim() || ''
  const profileShareLink = buildProfileShareLink()

  useEffect(() => {
    if (!montageOpen) {
      setMontageState({ status: 'idle' })
      return
    }
    if (!userId) {
      setMontageState({ status: 'error', message: 'Sign in to view your montage.' })
      return
    }
    if (!sb) {
      setMontageState({ status: 'error', message: 'Supabase is not configured.' })
      return
    }

    let cancelled = false
    setMontageState({ status: 'loading' })

    ;(async () => {
      const { data, error } = await sb
        .from('user_montages')
        .select('id, kind, title, playback_url, period_start, period_end, status, error_message, created_at')
        .eq('user_id', userId)
        .eq('kind', montageOpen)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        setMontageState({ status: 'error', message: error.message || 'Could not load your montage.' })
        return
      }
      if (!data) {
        setMontageState({ status: 'empty' })
        return
      }
      setMontageState({ status: 'loaded', montage: data as MontageRow })
    })()

    return () => {
      cancelled = true
    }
  }, [montageOpen, sb, userId])

  const goPremium = async () => {
    if (checkoutStarting) return

    setCheckoutStarting(true)
    const result = await startPremiumCheckout()
    setCheckoutStarting(false)

    if (!result.ok) {
      window.alert(result.error)
      return
    }
    window.location.href = result.url
  }

  const manageSubscription = async () => {
    if (billingPortalStarting) return

    setBillingPortalStarting(true)
    const result = await startBillingPortal()
    setBillingPortalStarting(false)

    if (!result.ok) {
      window.alert(result.error)
      return
    }
    window.location.href = result.url
  }

  const handleSignOut = async () => {
    if (!sb) return
    try {
      await sb.auth.signOut()
      setProfileOpen(false)
    } catch (e) {
       
      console.error(e)
    }
  }

  const handleShareProfile = async () => {
    const sharePayload = {
      title: PROFILE_SHARE_TITLE,
      text: PROFILE_SHARE_TEXT,
      url: profileShareLink,
    }

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(sharePayload)
        setShareStatus('Share sheet opened.')
        return
      }

      await navigator.clipboard?.writeText?.(profileShareLink)
      setShareStatus('Link copied.')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return

      try {
        await navigator.clipboard?.writeText?.(profileShareLink)
        setShareStatus('Link copied.')
      } catch {
        setShareStatus('Copy the link above to share.')
      }
    }
  }

  const glassBtn =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg px-3 py-2 sm:px-4 text-white font-medium text-[0.7rem] sm:text-xs hover:bg-white/15 transition-colors touch-manipulation'

  return (
    <>
      {/* Username to the left of Profile; full-width row so Profile sits on the right edge */}
      <div className="flex w-full min-w-0 flex-row items-center justify-end gap-2">
        {userEmail ? (
          <span
            className={`max-w-[min(10rem,32vw)] shrink truncate text-right font-mono text-[10px] sm:max-w-[13rem] sm:text-xs ${
              isPremium
                ? 'font-semibold text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.95)] [text-shadow:0_0_14px_rgba(251,191,36,0.75)]'
                : 'text-sunset-200/90'
            }`}
            title={userEmail}
          >
            {displayName}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className={`${glassBtn} shrink-0`}
          aria-expanded={profileOpen}
          aria-haspopup="dialog"
        >
          Profile
        </button>
      </div>

      {profileOpen && (
        <div
          className="fixed inset-0 z-[10002] flex items-start justify-center overflow-y-auto bg-black/70 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center sm:py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-menu-title"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/20 bg-midnight-900/95 p-4 shadow-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="profile-menu-title"
                className="text-sm font-semibold uppercase tracking-[0.14em] text-sunset-100/90"
              >
                Profile
              </h2>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-sunset-100/80 hover:bg-white/10 hover:text-sunset-50"
                aria-label="Close profile menu"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <PwaInstallPrompt />

              {/* 1 — Sign in / Sign out */}
              {userId && userEmail ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-sunset-100/60">Signed in</div>
                  <div className="mb-3 truncate font-mono text-sm text-sunset-100/90" title={userEmail}>
                    {userEmail}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="btn-glow-muted w-full min-h-[44px] text-sm touch-manipulation"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false)
                    setSignInOpen(true)
                  }}
                  className="btn-glow-gold min-h-[44px] w-full text-sm touch-manipulation"
                >
                  Sign in
                </button>
              )}

              <div className="rounded-xl border border-amber-300/70 bg-amber-300/90 px-3 py-3 text-midnight-900 shadow-[0_0_18px_rgba(251,191,36,0.28)]">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-midnight-900/70">
                  Share 5PM Somewhere
                </div>
                <p className="mb-2 text-sm font-medium leading-snug">
                  Invite friends to watch and post their 5PM moments.
                </p>
                <div className="mb-2 rounded-lg border border-midnight-900/15 bg-white/70 px-2.5 py-2 font-mono text-xs text-midnight-900 break-all">
                  {profileShareLink}
                </div>
                <button
                  type="button"
                  onClick={() => void handleShareProfile()}
                  className="min-h-[44px] w-full rounded-xl bg-midnight-900 px-4 py-2 text-sm font-semibold text-amber-100 shadow hover:bg-midnight-800 touch-manipulation"
                >
                  Share link
                </button>
                {shareStatus ? (
                  <div className="mt-2 text-center text-xs font-medium text-midnight-900/70">
                    {shareStatus}
                  </div>
                ) : null}
              </div>

              {/* 2 — Terms & Privacy */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPolicyOpen('terms')}
                  className="btn-glow-muted min-h-[44px] text-xs touch-manipulation sm:text-sm"
                >
                  Terms of Service
                </button>
                <button
                  type="button"
                  onClick={() => setPolicyOpen('privacy')}
                  className="btn-glow-muted min-h-[44px] text-xs touch-manipulation sm:text-sm"
                >
                  Privacy Policy
                </button>
              </div>

              {/* 3 — My Moments */}
              <button
                type="button"
                onClick={() => {
                  if (!userId) {
                    window.alert('Sign in to view your moments.')
                    return
                  }
                  setProfileOpen(false)
                  onOpenMyMoments()
                }}
                className="btn-glow-muted min-h-[44px] w-full text-sm touch-manipulation"
              >
                My Moments
              </button>

              {!isPremium ? (
                <button
                  type="button"
                  onClick={() => void goPremium()}
                  disabled={checkoutStarting}
                  className="btn-glow-gold min-h-[44px] w-full text-sm touch-manipulation disabled:cursor-wait disabled:opacity-70"
                >
                  {checkoutStarting ? 'Opening checkout…' : 'Upgrade to Premium'}
                </button>
              ) : (
                <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-3 text-center">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                    Premium active
                  </div>
                  <button
                    type="button"
                    onClick={() => void manageSubscription()}
                    disabled={billingPortalStarting}
                    className="btn-glow-muted min-h-[44px] w-full text-sm touch-manipulation disabled:cursor-wait disabled:opacity-70"
                  >
                    {billingPortalStarting ? 'Opening billing…' : 'Manage subscription'}
                  </button>
                </div>
              )}

              {/* 4 — Weekly montage */}
              <button
                type="button"
                onClick={() => {
                  if (!isPremium) {
                    setPremiumPitch('weekly')
                    return
                  }
                  setMontageOpen('weekly')
                }}
                className="btn-glow-muted flex min-h-[44px] w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm touch-manipulation"
              >
                <span>Watch my Weekly Montage</span>
                {!isPremium ? (
                  <span className="text-[10px] font-semibold uppercase text-amber-300/90">Premium</span>
                ) : null}
              </button>

              {/* 5 — Monthly highlights */}
              <button
                type="button"
                onClick={() => {
                  if (!isPremium) {
                    setPremiumPitch('monthly')
                    return
                  }
                  setMontageOpen('monthly')
                }}
                className="btn-glow-muted flex min-h-[44px] w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm touch-manipulation"
              >
                <span>Watch my Monthly Highlights</span>
                {!isPremium ? (
                  <span className="text-[10px] font-semibold uppercase text-amber-300/90">Premium</span>
                ) : null}
              </button>

              {/* 6 — Support */}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="btn-glow-muted flex min-h-[44px] w-full items-center justify-center text-sm touch-manipulation no-underline"
              >
                Support
              </a>

              <NotificationSettings userId={userId} userTz={userTz} />
            </div>

            <CopyrightFooter variant="card" className="!mt-4" />
          </div>
        </div>
      )}

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

      {policyOpen && (
        <div
          className="fixed inset-0 z-[10004] flex items-center justify-center bg-black/75 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setPolicyOpen(null)}
        >
          <div
            className="max-h-[min(80dvh,640px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-sunset-500/40 bg-midnight-900/98 p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-[1] mb-4 flex justify-end border-b border-white/10 bg-midnight-900/80 pb-3 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setPolicyOpen(null)}
                className="rounded-lg border border-white/20 px-2 py-1 text-xs text-sunset-100/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            {policyOpen === 'terms' ? <TermsOfServiceText /> : <PrivacyPolicyText />}
          </div>
        </div>
      )}

      {premiumPitch && (
        <div
          className="fixed inset-0 z-[10004] flex items-center justify-center bg-black/75 px-4"
          onClick={() => setPremiumPitch(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-sunset-500/40 bg-midnight-900/95 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sunset-100/80">
              Premium feature
            </h3>
            <p className="mb-4 text-sm text-sunset-100/90">
              Upgrade to Premium for{' '}
              {premiumPitch === 'weekly' ? 'your weekly montage' : 'your monthly highlights'}. Subscription
              checkout opens securely with Stripe.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPremiumPitch(null)}
                className="btn-glow-muted min-h-[44px] px-4 text-sm"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => void goPremium()}
                disabled={checkoutStarting}
                className="btn-glow-gold min-h-[44px] px-4 text-sm disabled:cursor-wait disabled:opacity-70"
              >
                {checkoutStarting ? 'Opening…' : 'Go Premium'}
              </button>
            </div>
          </div>
        </div>
      )}

      {montageOpen && (
        <div
          className="fixed inset-0 z-[10004] flex items-center justify-center bg-black/75 px-4"
          onClick={() => setMontageOpen(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-sunset-500/40 bg-midnight-900/95 p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-sunset-100/80">
                {montageOpen === 'weekly' ? 'Weekly montage' : 'Monthly highlights'}
              </h3>
              <button
                type="button"
                onClick={() => setMontageOpen(null)}
                className="text-[11px] text-sunset-100/70 hover:text-sunset-50"
              >
                Close
              </button>
            </div>

            {montageState.status === 'loading' && (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-10 text-sm text-sunset-100/80">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-sunset-400 border-t-transparent" />
                Loading your montage…
              </div>
            )}

            {montageState.status === 'error' && (
              <div className="rounded-xl border border-red-300/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">
                {montageState.message}
              </div>
            )}

            {montageState.status === 'empty' && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-sunset-100/85">
                No {montageOpen === 'weekly' ? 'weekly montage' : 'monthly highlights'} found yet. We need at
                least 3 eligible moments, then the next montage job will generate this for Premium users.
              </div>
            )}

            {montageState.status === 'loaded' && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-semibold text-sunset-50">
                  {montageState.montage.title ?? (montageOpen === 'weekly' ? 'Weekly montage' : 'Monthly highlights')}
                </div>
                <div className="mt-1 text-[11px] text-sunset-100/60">
                  {formatPeriod(montageState.montage.period_start, montageState.montage.period_end)}
                </div>

                {montageState.montage.status === 'ready' && montageState.montage.playback_url ? (
                  <MontageVideo src={montageState.montage.playback_url} />
                ) : montageState.montage.status === 'failed' ? (
                  <div className="mt-3 rounded-xl border border-red-300/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">
                    Montage generation failed: {montageState.montage.error_message ?? 'Unknown error'}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-sky-300/25 bg-sky-900/20 px-4 py-3 text-sm text-sky-100">
                    Your montage is {montageState.montage.status}. Check back shortly after processing completes.
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMontageOpen(null)}
              className="btn-glow-muted mt-4 w-full min-h-[44px] text-sm"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  )
}
