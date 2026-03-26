// © 2026 Chromatic Productions Ltd. All rights reserved.
export type Profile = {
  id: string
  is_premium: boolean
  timezone: string
  current_streak: number
  longest_streak: number
  last_post_date: string | null
  /** ISO timestamp when user accepted upload terms; null = not yet accepted */
  upload_terms_accepted_at: string | null
}
