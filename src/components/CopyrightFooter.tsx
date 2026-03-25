// © 2026 Chromatic Productions Ltd. All rights reserved.

type Props = {
  className?: string
  /** Main: bottom strip; overlay: fixed; embedded: absolute in relative modal; card: bottom of a dialog card. */
  variant?: 'main' | 'overlay' | 'embedded' | 'card'
}

export function CopyrightFooter({ className = '', variant = 'main' }: Props) {
  const base =
    variant === 'overlay'
      ? 'fixed bottom-1 left-0 right-0 z-[10001] text-center text-[7px] leading-tight text-white/30 pointer-events-none px-2'
      : variant === 'embedded'
        ? 'absolute bottom-1 left-0 right-0 z-20 text-center text-[7px] leading-tight text-white/30 pointer-events-none px-2'
        : variant === 'card'
          ? 'text-center text-[7px] leading-tight text-sunset-100/35 mt-3 pointer-events-none'
          : 'text-center text-[7px] leading-tight text-sunset-100/35 pointer-events-none py-0.5 flex-shrink-0'

  return (
    <p className={`${base} ${className}`} aria-hidden>
      © 2026 Chromatic Productions Ltd. All rights reserved.
    </p>
  )
}
