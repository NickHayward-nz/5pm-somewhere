import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabase() {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey) return null
  const redirectUrl = window.location.origin.includes('localhost')
    ? 'http://localhost:5173/auth/callback'
    : 'https://5pm-somewhere-alpha.vercel.app/auth/callback'
  client = createClient(url, anonKey, {
    auth: {
      redirectTo: redirectUrl,
    },
  })
  // eslint-disable-next-line no-console
  console.log('Supabase client initialized with redirectTo:', redirectUrl)
  return client
}

