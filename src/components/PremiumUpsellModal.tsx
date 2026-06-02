// © 2026 Chromatic Productions Ltd. All rights reserved.
import { captureEvent } from '../lib/analytics'
import { startPremiumCheckout } from '../lib/premium'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  message: string
  /** Analytics surface id, e.g. `recording_max_modal` */
  surface: string
  primaryLabel?: string
}

export function PremiumUpsellModal({
  open,
  onClose,
  title,
  message,
  surface,
  primaryLabel = 'Upgrade to Premium',
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`premium-upsell-${surface}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-midnight-900/95 p-4 shadow-xl border border-sunset-500/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div
            id={`premium-upsell-${surface}`}
            className="text-xs font-semibold tracking-[0.14em] uppercase text-sunset-100/80"
          >
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-sunset-100/70 hover:text-sunset-50"
          >
            Close
          </button>
        </div>
        <p className="text-sm text-sunset-100/90 mb-4">{message}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-glow-muted w-full sm:w-auto min-h-[44px] px-4 text-sm touch-manipulation"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={async () => {
              captureEvent('premium_checkout_cta_clicked', { surface })
              const result = await startPremiumCheckout()
              if (!result.ok) {
                window.alert(result.error)
                return
              }
              window.location.href = result.url
            }}
            className="btn-glow-gold w-full sm:w-auto min-h-[44px] px-4 text-sm touch-manipulation"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
