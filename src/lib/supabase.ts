import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabase() {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  if (!url || !anonKey) {
    // eslint-disable-next-line no-console
    console.error('Missing Supabase env vars')
    return null
  }

  client = createClient(url, anonKey)
  return client
}
