export function countryCodeToFlagEmoji(countryCode: string) {
  const code = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️'
  const A = 0x1f1e6
  const base = 'A'.charCodeAt(0)
  const first = A + (code.charCodeAt(0) - base)
  const second = A + (code.charCodeAt(1) - base)
  return String.fromCodePoint(first, second)
}

