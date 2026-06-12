// © 2026 Chromatic Productions Ltd. All rights reserved.
import type { SupabaseClient } from '@supabase/supabase-js'

export const LEGAL_TERMS_VERSION = '2026-06-12'
export const LEGAL_PENDING_ACCEPTANCE_KEY = 'fivepm_legal_acceptance_pending'

export type LegalAcceptanceSource = 'google' | 'email' | 'first_upload' | 'profile'

type PendingLegalAcceptance = {
  acceptedAt: string
  termsVersion: string
  source: LegalAcceptanceSource
}

export function markLegalAcceptancePending(source: LegalAcceptanceSource) {
  try {
    const pending: PendingLegalAcceptance = {
      acceptedAt: new Date().toISOString(),
      termsVersion: LEGAL_TERMS_VERSION,
      source,
    }
    localStorage.setItem(LEGAL_PENDING_ACCEPTANCE_KEY, JSON.stringify(pending))
  } catch {
    // If localStorage is unavailable, the UI still requires active consent before the auth action.
  }
}

export function consumePendingLegalAcceptance(): PendingLegalAcceptance | null {
  try {
    const raw = localStorage.getItem(LEGAL_PENDING_ACCEPTANCE_KEY)
    if (!raw) return null
    localStorage.removeItem(LEGAL_PENDING_ACCEPTANCE_KEY)
    const parsed = JSON.parse(raw) as Partial<PendingLegalAcceptance>
    if (!parsed.acceptedAt || !parsed.termsVersion || !parsed.source) return null
    return parsed as PendingLegalAcceptance
  } catch {
    return null
  }
}

export async function recordAccountLegalAcceptance(
  sb: SupabaseClient,
  userId: string,
  pending: PendingLegalAcceptance,
) {
  const acceptedAt = pending.acceptedAt || new Date().toISOString()
  const { error } = await sb
    .from('profiles')
    .update({
      terms_accepted_at: acceptedAt,
      privacy_policy_accepted_at: acceptedAt,
      age_confirmed_at: acceptedAt,
      legal_terms_version: pending.termsVersion || LEGAL_TERMS_VERSION,
    })
    .eq('id', userId)

  if (error) throw error
}
