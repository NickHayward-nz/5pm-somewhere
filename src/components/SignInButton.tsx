import { getSupabase } from '../lib/supabase'

type Props = {
  userEmail: string | null
}

export default function SignInButton({ userEmail }: Props) {
  const sb = getSupabase()

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

  if (userEmail) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sunset-200/90">{userEmail}</span>
        <button
          type="button"
          onClick={handleSignOut}
          className="btn-glow-muted text-xs px-4 py-1.5"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={handleSignIn} className="btn-glow text-xs px-4 py-1.5">
      Sign in with Google
    </button>
  )
}

