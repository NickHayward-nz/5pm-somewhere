// © 2026 Chromatic Productions Ltd. All rights reserved.
//
// Capacitor configuration for the native iOS / Android wrappers.
//
// The native shells load the Vite-built web bundle from `dist/` and
// communicate with Capacitor plugins (Share, Browser, StatusBar, etc.).
//
// Build flow:
//   1. npm run build           → produces dist/
//   2. npx cap sync            → copies dist/ into ios/App and android/app
//   3. npx cap open ios        (macOS + Xcode only)
//      npx cap open android    (Android Studio required)
//
// Change `appId` BEFORE first running `cap add ios` / `cap add android`.
// The appId becomes the bundle identifier (iOS) and applicationId
// (Android) and is extremely painful to change after the fact because it
// affects code signing and Play/App Store listings.

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.fivepmsomewhere.mobile',
  appName: '5PM Somewhere',
  webDir: 'dist',
  backgroundColor: '#1a0f00',
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#1a0f00',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a0f00',
    },
  },
  server: {
    // Allow the app to load the hosted web version instead of the bundled
    // dist/ directory during development. Uncomment and set to your dev
    // server URL (e.g. `http://192.168.1.42:5173`) when iterating.
    // url: 'http://localhost:5173',
    // cleartext: true,
    androidScheme: 'https',
  },
}

export default config
