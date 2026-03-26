// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { CopyrightFooter } from './CopyrightFooter'
import { SignInModal } from './SignInModal'
import { PrivacyPolicyText, TermsOfServiceText } from './PolicyLegalContent'

const SUPPORT_EMAIL = 'its.5pm.somewhere.app@gmail.com'

function goPremiumDev() {
  try {
    const u = new URL(window.location.href)
    u.searchParams.set('premium', '1')
    window.location.href = u.toString()
  } catch {
    window.location.search = '?premium=1'
  }
}

type Props = {
  userEmail: string | null
  userId: string | null
  isPremium: boolean
  onOpenMyMoments: () => void
}

export function ProfileMenu({ userEmail, userId, isPremium, onOpenMyMoments }: Props) {
  const sb = getSupabase()
  const [profileOpen, setProfileOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const [policyOpen, setPolicyOpen] = useState<null | 'terms' | 'privacy'>(null)
  const [montageOpen, setMontageOpen] = useState<null | 'weekly' | 'monthly'>(null)
  const [premiumPitch, setPremiumPitch] = useState<null | 'weekly' | 'monthly'>(null)

  const displayName = userEmail?.trim() || ''

  const handleSignOut = async () => {
    if (!sb) return
    try {
      await sb.auth.signOut()
      setProfileOpen(false)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
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
            className="max-w-[min(10rem,32vw)] shrink truncate text-right font-mono text-[10px] text-sunset-200/90 sm:max-w-[13rem] sm:text-xs"
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
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-menu-title"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/20 bg-midnight-900/95 p-4 shadow-2xl sm:p-5"
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
              checkout will be available here soon.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPremiumPitch(null)}
                className="btn-glow-muted min-h-[44px] px-4 text-sm"
              >
                Not now
              </button>
              <button type="button" onClick={goPremiumDev} className="btn-glow-gold min-h-[44px] px-4 text-sm">
                Premium
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
            className="w-full max-w-md rounded-2xl border border-sunset-500/40 bg-midnight-900/95 p-4 shadow-xl sm:p-6"
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
            <p className="text-sm text-sunset-100/85">
              {montageOpen === 'weekly'
                ? 'Your montage of all 5PM moments from Monday–Sunday will appear here once video processing is set up.'
                : 'Your top 5 moments of the month (by views and interactions) will appear here once the feature is ready.'}
            </p>
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
