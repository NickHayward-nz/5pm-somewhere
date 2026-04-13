// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { CopyrightFooter } from './CopyrightFooter'

type Props = {
  open: boolean
  onClose: () => void
  /** Shown above the title (e.g. why sign-in is needed) */
  contextMessage?: string | null
}

export function SignInModal({ open, onClose, contextMessage }: Props) {
  const sb = getSupabase()
  const [email, setEmail] = useState('')

  if (!open) return null

  const handleSignIn = async () => {
    if (!sb) {
      // eslint-disable-next-line no-console
      console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env')
      window.alert('Supabase is not configured - check env vars.')
      return
    }
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      window.alert('Unable to start Google sign-in. Please try again.')
    }
  }

  const handleMagicLink = async () => {
    if (!sb) {
      window.alert('Supabase not configured')
      return
    }
    try {
      await sb.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      window.alert('Magic link sent! Check your email.')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      window.alert('Unable to send magic link.')
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
        <button
          type="button"
          onClick={handleSignIn}
          className="w-full btn-glow py-3 rounded-lg mb-6 text-sm sm:text-base font-medium"
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
          className="w-full bg-gradient-to-r from-orange-500 to-pink-500 py-3 rounded-lg text-white font-medium hover:opacity-90 text-sm"
        >
          Send Magic Link
        </button>
      </div>
      <CopyrightFooter variant="overlay" />
    </div>
  )
}
