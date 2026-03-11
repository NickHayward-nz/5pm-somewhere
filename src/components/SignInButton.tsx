import { getSupabase } from '../lib/supabase'

type Props = {
  userEmail: string | null
}

export default function SignInButton({ userEmail }: Props) {
  const sb = getSupabase()
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

  const glassBox =
    'bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-lg px-3 py-2 sm:px-4 sm:py-2 min-w-[140px] flex items-center justify-center gap-2 text-white font-medium text-[0.7rem] sm:text-xs'

  if (userEmail) {
    return (
      <div className={glassBox}>
        <span className="font-mono text-sunset-200/90 truncate max-w-[120px] sm:max-w-[160px]" title={userEmail}>
          {userEmail}
        </span>
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
    <div className={glassBox}>
      <button
        type="button"
        onClick={handleSignIn}
        className="btn-glow flex-shrink-0 text-[0.7rem] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5 hover:scale-105 transition-transform"
      >
        Sign in with Google
      </button>
    </div>
  )
}

