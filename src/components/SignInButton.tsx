import { getSupabase } from '../lib/supabase'

type Props = {
  userEmail: string | null
}

export function SignInButton({ userEmail }: Props) {
  const sb = getSupabase()

  const handleSignIn = async () => {
    if (!sb) {
      window.alert('Supabase is not configured.')
      return
    }
    try {
      const redirectTo = window.location.origin.includes('localhost')
        ? 'http://localhost:5173/auth/callback'
        : 'https://5pm-somewhere-alpha.vercel.app/auth/callback'
      // eslint-disable-next-line no-console
      console.log('Sign-in redirectTo set to:', redirectTo)
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

  if (userEmail) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-sunset-100/80">
        <div className="rounded-full bg-midnight-700/80 border border-sunset-500/40 px-3 py-1">
          <span className="font-mono text-sunset-50/90">Signed in as</span>{' '}
          <span className="font-mono text-sunset-200/90">{userEmail}</span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sunset-200/80 hover:text-sunset-50 text-[10px]"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      className="btn-glow-muted text-xs px-4 py-1.5"
    >
      Sign in with Google
    </button>
  )
}

