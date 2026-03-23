/**
 * QA / staging test mode — bypasses 5 PM capture window, daily upload cap, stream age filter,
 * and relaxed record length. Production: leave everything off / unset.
 *
 * Enable (any one):
 * - URL: add `?test=1` or `?test=true` (persists `fivepm_app_test_mode=1` in localStorage)
 * - URL: `?app_test=1` or `?fivepm_test=1`
 * - localStorage: `localStorage.setItem('fivepm_app_test_mode', '1')` then reload
 * - Build env: `VITE_APP_TEST_MODE=true` or `1` (whole deployment; use only for preview/staging)
 *
 * Disable:
 * - URL: `?test=0` or `?test=false` (clears the flag)
 * - localStorage: `localStorage.removeItem('fivepm_app_test_mode')` + reload
 * - Remove / set `VITE_APP_TEST_MODE=false` and redeploy
 */
export const APP_TEST_MODE_STORAGE_KEY = 'fivepm_app_test_mode'

function envTestModeEnabled(): boolean {
  const v = import.meta.env.VITE_APP_TEST_MODE
  if (v == null || v === '') return false
  const s = String(v).toLowerCase().trim()
  return s === 'true' || s === '1' || s === 'yes'
}

/**
 * Read `test` / `app_test` / `fivepm_test` from the current URL and sync localStorage.
 * Call on every `isAppTestMode()` check so a full page load with `?test=1` works without manual steps.
 */
export function syncAppTestModeFromUrl(): void {
  if (typeof window === 'undefined') return
  try {
    const qs = new URLSearchParams(window.location.search)
    const raw = qs.get('test') ?? qs.get('app_test') ?? qs.get('fivepm_test')
    if (raw == null) return
    const v = raw.toLowerCase().trim()
    if (v === '1' || v === 'true' || v === 'yes') {
      localStorage.setItem(APP_TEST_MODE_STORAGE_KEY, '1')
    } else if (v === '0' || v === 'false' || v === 'no') {
      localStorage.removeItem(APP_TEST_MODE_STORAGE_KEY)
    }
  } catch {
    // ignore
  }
}

export function isAppTestMode(): boolean {
  syncAppTestModeFromUrl()
  if (envTestModeEnabled()) return true
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(APP_TEST_MODE_STORAGE_KEY) === '1') {
      return true
    }
  } catch {
    // ignore
  }
  return false
}
