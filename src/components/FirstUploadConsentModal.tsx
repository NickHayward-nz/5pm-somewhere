// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useState } from 'react'
import { PrivacyPolicyText, TermsOfServiceText } from './PolicyLegalContent'

type Props = {
  open: boolean
  onClose: () => void
  onAccepted: () => Promise<void>
}

export function FirstUploadConsentModal({ open, onClose, onAccepted }: Props) {
  const [agreed, setAgreed] = useState(false)
  const [policyOpen, setPolicyOpen] = useState<null | 'terms' | 'privacy'>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setAgreed(false)
      setPolicyOpen(null)
      setSaving(false)
    }
  }, [open])

  if (!open) return null

  const handleContinue = async () => {
    if (!agreed || saving) return
    setSaving(true)
    try {
      await onAccepted()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-consent-title"
        onClick={() => !saving && onClose()}
      >
        <div
          className="relative w-full max-w-md rounded-2xl border border-sunset-500/40 bg-midnight-900/95 p-4 shadow-xl sm:p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2
              id="upload-consent-title"
              className="text-sm font-semibold uppercase tracking-[0.14em] text-sunset-100/90"
            >
              Before you record
            </h2>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-sunset-100/80 hover:bg-white/10 hover:text-sunset-50 disabled:opacity-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mb-4 space-y-3 text-sm leading-relaxed text-sunset-100/90">
            <p>
              You keep ownership of every video you upload. By uploading, you grant 5PM Somewhere a{' '}
              <strong className="text-sunset-100">worldwide, perpetual, non-exclusive, royalty-free</strong>{' '}
              licence to host, stream, and display your 5PM Moments in the app and related channels. You will
              not be paid for ordinary use of your content in the service.
            </p>
            <p className="text-xs text-sunset-100/65">
              Full details are in our Terms of Service and Privacy Policy below.
            </p>
          </div>

          <label className="mb-4 flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-sunset-100/90">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-sunset-500/50 bg-midnight-900 text-amber-500 focus:ring-amber-500/80"
              checked={agreed}
              disabled={saving}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="leading-snug">
              I agree — take me to the{' '}
              <button
                type="button"
                className="text-sunset-300 underline hover:text-sunset-200"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPolicyOpen('terms')
                }}
              >
                Terms of Service
              </button>
              {' & '}
              <button
                type="button"
                className="text-sunset-300 underline hover:text-sunset-200"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPolicyOpen('privacy')
                }}
              >
                Privacy Policy
              </button>
              .
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="btn-glow-muted w-full min-h-[44px] px-4 text-sm touch-manipulation sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!agreed || saving}
              onClick={() => void handleContinue()}
              className="btn-glow-gold w-full min-h-[44px] px-4 text-sm touch-manipulation sm:w-auto disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Continue to recording'}
            </button>
          </div>
        </div>
      </div>

      {policyOpen && (
        <div
          className="fixed inset-0 z-[10005] flex items-center justify-center bg-black/75 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setPolicyOpen(null)}
        >
          <div
            className="max-h-[min(80dvh,640px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-sunset-500/40 bg-midnight-900/98 p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-[1] mb-4 flex justify-end border-b border-white/10 bg-midnight-900/80 pb-3 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setPolicyOpen(null)}
                className="rounded-lg border border-white/20 px-2 py-1 text-xs text-sunset-100/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            {policyOpen === 'terms' ? <TermsOfServiceText /> : <PrivacyPolicyText />}
          </div>
        </div>
      )}
    </>
  )
}
