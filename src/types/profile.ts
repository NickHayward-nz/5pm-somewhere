// © 2026 Chromatic Productions Ltd. All rights reserved.
export type Profile = {
  id: string
  is_premium: boolean
  timezone: string
  current_streak: number
  longest_streak: number
  last_post_date: string | null
  total_uploads: number
  /** ISO timestamp when user accepted upload terms; null = not yet accepted */
  upload_terms_accepted_at: string | null
  /** ISO timestamp when user accepted account terms/privacy before sign-in/account use */
  terms_accepted_at?: string | null
  privacy_policy_accepted_at?: string | null
  age_confirmed_at?: string | null
  legal_terms_version?: string | null
  upload_terms_version?: string | null
}
