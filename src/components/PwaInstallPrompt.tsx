// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isAppleTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua) || (ua.includes('macintosh') && navigator.maxTouchPoints > 1)
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandaloneDisplay())
  const isApple = useMemo(() => isAppleTouchDevice(), [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (installed) return null

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
    }
    setInstallPrompt(null)
  }

  return (
    <div className="rounded-xl border border-sky-300/35 bg-sky-400/10 px-3 py-3 text-sky-50 shadow-[0_0_22px_rgba(125,211,252,0.16)]">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
        Install the app
      </div>
      <p className="mb-3 text-sm leading-relaxed text-sky-50/90">
        Add 5PM Somewhere to your home screen for the full app experience.
      </p>
      {installPrompt ? (
        <button
          type="button"
          onClick={() => void handleInstall()}
          className="btn-glow-gold min-h-[44px] w-full text-sm touch-manipulation"
        >
          Install 5PM Somewhere
        </button>
      ) : isApple ? (
        <p className="rounded-lg border border-sky-200/15 bg-sky-100/5 px-3 py-2 text-xs leading-relaxed text-sky-50/85">
          On iPhone or iPad: tap <span className="font-semibold text-sky-50">Share</span>, then{' '}
          <span className="font-semibold text-sky-50">Add to Home Screen</span>.
        </p>
      ) : (
        <p className="rounded-lg border border-sky-200/15 bg-sky-100/5 px-3 py-2 text-xs leading-relaxed text-sky-50/85">
          Use your browser menu and choose <span className="font-semibold text-sky-50">Install app</span>{' '}
          or <span className="font-semibold text-sky-50">Add to home screen</span>.
        </p>
      )}
    </div>
  )
}
