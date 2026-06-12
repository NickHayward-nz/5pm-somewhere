// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { CopyrightFooter } from './CopyrightFooter'
import { captureEvent } from '../lib/analytics'
import { markLegalAcceptancePending } from '../lib/legal'
import { PrivacyPolicyText, TermsOfServiceText } from './PolicyLegalContent'

type Props = {
  open: boolean
  onClose: () => void
  /** Shown above the title (e.g. why sign-in is needed) */
  contextMessage?: string | null
}

function getMagicLinkErrorMessage(message?: string) {
  const lowerMessage = message?.toLowerCase() ?? ''

  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
    return 'Too many sign-in emails have been requested recently. Please try again later, or use Google sign-in for now.'
  }

  return 'Unable to send magic link. Please try again, or use Google sign-in for now.'
}

export function SignInModal({ open, onClose, contextMessage }: Props) {
  const sb = getSupabase()
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [policyOpen, setPolicyOpen] = useState<null | 'terms' | 'privacy'>(null)

  useEffect(() => {
    if (!open) {
      setAgreed(false)
      setPolicyOpen(null)
    }
  }, [open])

  if (!open) return null

  const handleSignIn = async () => {
    if (!agreed) {
      window.alert('Please confirm you agree to the Terms and Privacy Policy first.')
      return
    }
    if (!sb) {
       
      console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env')
      window.alert('Supabase is not configured - check env vars.')
      return
    }
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      captureEvent('auth_sign_in_started', { provider: 'google' })
      markLegalAcceptancePending('google')
      await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })
    } catch (e) {
       
      console.error(e)
      captureEvent('auth_sign_in_failed', { provider: 'google' })
      window.alert('Unable to start Google sign-in. Please try again.')
    }
  }

  const handleMagicLink = async () => {
    if (!agreed) {
      window.alert('Please confirm you agree to the Terms and Privacy Policy first.')
      return
    }
    if (!sb) {
      window.alert('Supabase not configured')
      return
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      window.alert('Please enter your email address first.')
      return
    }

    try {
      captureEvent('auth_magic_link_requested', { provider: 'email' })
      markLegalAcceptancePending('email')
      const { error } = await sb.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error(error)
        captureEvent('auth_magic_link_failed', { provider: 'email', reason: error.message })
        window.alert(getMagicLinkErrorMessage(error.message))
        return
      }

      window.alert('Magic link sent! Check your email.')
    } catch (e) {
       
      console.error(e)
      captureEvent('auth_magic_link_failed', { provider: 'email' })
      window.alert('Unable to send magic link. Please try again, or use Google sign-in for now.')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10003] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div
        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-6 sm:p-8 max-w-[400px] w-full mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white text-sm"
        >
          Close
        </button>
        {contextMessage ? (
          <p className="text-sm sm:text-base text-white/90 text-center mb-4 pr-8 leading-relaxed">
            {contextMessage}
          </p>
        ) : null}
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center pr-8">Sign In</h2>
        {contextMessage ? (
          <p className="text-xs text-white/60 text-center -mt-4 mb-6 pr-8">
            Or use <span className="text-white/80 font-medium">Profile</span> (top right) →{' '}
            <span className="text-white/80 font-medium">Sign in</span>.
          </p>
        ) : null}
        <label className="mb-4 flex cursor-pointer gap-3 rounded-xl border border-white/15 bg-white/5 p-3 text-xs leading-snug text-white/80">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/40 bg-white/10 text-amber-500 focus:ring-amber-500/80"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I am at least 13, and I agree to the{' '}
            <button
              type="button"
              className="text-amber-200 underline hover:text-amber-100"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPolicyOpen('terms')
              }}
            >
              Terms
            </button>{' '}
            and{' '}
            <button
              type="button"
              className="text-amber-200 underline hover:text-amber-100"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPolicyOpen('privacy')
              }}
            >
              Privacy Policy
            </button>
            .
          </span>
        </label>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={!agreed}
          className="w-full btn-glow py-3 rounded-lg mb-6 text-sm sm:text-base font-medium disabled:cursor-not-allowed disabled:opacity-45"
        >
          Sign in with Google
        </button>
        <div className="text-center text-white/70 text-xs sm:text-sm mb-4">or use email</div>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 mb-4 text-white placeholder-white/50 focus:outline-none focus:border-white/40 text-sm"
        />
        <button
          type="button"
          onClick={handleMagicLink}
          disabled={!agreed}
          className="w-full bg-gradient-to-r from-orange-500 to-pink-500 py-3 rounded-lg text-white font-medium hover:opacity-90 text-sm disabled:cursor-not-allowed disabled:opacity-45"
        >
          Send Magic Link
        </button>
      </div>
      {policyOpen && (
        <div
          className="fixed inset-0 z-[10005] flex items-center justify-center bg-black/75 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            e.stopPropagation()
            setPolicyOpen(null)
          }}
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
      <CopyrightFooter variant="overlay" />
    </div>
  )
}
