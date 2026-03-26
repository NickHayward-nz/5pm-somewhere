// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useState } from 'react'
import { SignInModal } from './SignInModal'

type Props = {
  userEmail: string | null
  onUsernameClick?: () => void
}

/** @deprecated Prefer ProfileMenu in app header — kept for any legacy use */
export default function SignInButton({ userEmail, onUsernameClick }: Props) {
  const [showSignInModal, setShowSignInModal] = useState(false)

  if (userEmail) {
    return (
      <div className="flex min-w-[140px] items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 shadow-lg backdrop-blur-md sm:px-4">
        <button
          type="button"
          onClick={() => onUsernameClick?.()}
          className="max-w-[120px] truncate text-left font-mono text-[0.7rem] text-sunset-200/90 hover:opacity-90 sm:max-w-[160px] sm:text-xs"
          title={userEmail}
          aria-label="Open My 5PM Moments"
          disabled={!onUsernameClick}
        >
          {userEmail}
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowSignInModal(true)}
        className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.7rem] font-medium text-white shadow-lg backdrop-blur-md hover:scale-105 sm:px-4 sm:py-1.5 sm:text-xs"
      >
        Sign In
      </button>
      <SignInModal open={showSignInModal} onClose={() => setShowSignInModal(false)} />
    </>
  )
}
