/**
 * Temporary QA / reaction-testing mode — disables normal product limits (5 PM window,
 * daily upload cap, capture button disabled-while-profile-loads, stream age, record length).
 *
 * Enable either:
 * - `VITE_APP_TEST_MODE=true` in `.env` (rebuild required), or
 * - In DevTools: `localStorage.setItem('fivepm_app_test_mode', '1')` + reload
 *
 * Disable: `localStorage.removeItem('fivepm_app_test_mode')` and set env to false, then rebuild.
 */
export function isAppTestMode(): boolean {
  try {
    if (import.meta.env.VITE_APP_TEST_MODE === 'true') return true
    if (typeof localStorage !== 'undefined' && localStorage.getItem('fivepm_app_test_mode') === '1') {
      return true
    }
  } catch {
    // ignore
  }
  return false
}
