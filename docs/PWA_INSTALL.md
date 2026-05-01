# PWA install experience

5PM Somewhere is distributed as an installable Progressive Web App.

## User flow

1. User opens the web app in a browser.
2. User opens **Profile**.
3. The Profile menu shows **Install the app** unless the app is already
   running standalone from the home screen.
4. Chrome / Edge / Android users see the browser install prompt.
5. iPhone / iPad users see manual instructions: **Share → Add to Home Screen**.

## Implementation

- `vite.config.ts` configures the PWA manifest and service worker.
- `src/pwa.ts` registers the service worker with auto-update.
- `src/components/PwaInstallPrompt.tsx` owns the install prompt UI.
- `src/components/ProfileMenu.tsx` renders the install prompt prominently near
  the top of the Profile dialog.

## Billing

Premium is purchased and managed on the web with Stripe. Because there are no
App Store / Play Store binaries, no native in-app purchase integration is
required.
