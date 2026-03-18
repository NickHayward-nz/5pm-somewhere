import { useState } from 'react'
import { getSupabase } from '../lib/supabase'

type Props = {
  userEmail: string | null
  onUsernameClick?: () => void
}

export default function SignInButton({ userEmail, onUsernameClick }: Props) {
  const sb = getSupabase()
  const [email, setEmail] = useState('')
  const [showSignInModal, setShowSignInModal] = useState(false)
  // eslint-disable-next-line no-console
  console.log('Sign-in box rendered')

  const handleSignIn = async () => {
    if (!sb) {
      // eslint-disable-next-line no-console
      console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env')
      window.alert('Supabase is not configured - check env vars.')
      return
    }
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      // eslint-disable-next-line no-console
      console.log('Sign-in redirectTo:', redirectTo)
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

  const handleSignOut = async () => {
    if (!sb) return
    try {
      await sb.auth.signOut()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
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

  const glassBox =
    'bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-lg px-3 py-2 sm:px-4 sm:py-2 min-w-[140px] flex items-center justify-center gap-2 text-white font-medium text-[0.7rem] sm:text-xs'

  if (userEmail) {
    return (
      <div className={glassBox}>
        <button
          type="button"
          onClick={() => onUsernameClick?.()}
          className="font-mono text-sunset-200/90 truncate max-w-[120px] sm:max-w-[160px] text-left hover:opacity-90 focus:outline-none"
          title={userEmail}
          aria-label="Open My 5PM Moments"
          disabled={!onUsernameClick}
        >
          {userEmail}
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="btn-glow-muted flex-shrink-0 text-[0.7rem] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5 hover:scale-105 transition-transform"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowSignInModal(true)}
        className="btn-glow text-[0.7rem] sm:text-xs px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg text-white font-medium hover:scale-105 transition-transform"
      >
        Sign In
      </button>

      {showSignInModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10001] p-4"
          onClick={() => setShowSignInModal(false)}
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
              onClick={() => setShowSignInModal(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white text-sm"
            >
              Close
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center pr-8">Sign In</h2>
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
        </div>
      )}
    </>
  )
}

