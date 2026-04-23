# Publishing the iOS & Android native apps (Capacitor)

The web app is wrapped into real iOS / Android binaries with
[Capacitor](https://capacitorjs.com). This repo already contains:

- `capacitor.config.ts` — app id, name, splash/status-bar config.
- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, and selected
  plugins (`share`, `browser`, `app`, `haptics`, `splash-screen`,
  `status-bar`) as dependencies.
- npm scripts: `npm run cap:sync`, `npm run cap:add:ios`,
  `npm run cap:add:android`, `npm run cap:open:ios`, `npm run cap:open:android`.

What it does **not** have yet (you need to run these — they require tooling
that only exists on macOS or Android Studio respectively):

- The generated `ios/` and `android/` native project directories.
- Code-signing identities / certificates.
- App Store Connect + Google Play Console listings.

## 1. Lock in the app identity (one-time)

Before first `cap add`, make sure **`capacitor.config.ts` → `appId`** matches
the reverse-DNS identifier you want. It becomes:

- iOS **Bundle Identifier** (must match your Apple App ID).
- Android **applicationId** (unique on Google Play forever).

Example in this repo: `app.fivepmsomewhere.mobile`. Change it before `cap add`.

## 2. Android (Windows / Mac / Linux)

Requires: **Android Studio** with the Android SDK + JDK 17+.

```bash
npm run build            # produces dist/
npm run cap:add:android  # one-time: creates android/ directory
npm run cap:sync         # copies dist/ into android/app
npm run cap:open:android # launches Android Studio
```

Inside Android Studio:

1. Let Gradle sync.
2. Run on an emulator or physical device (Run → Run 'app').
3. Test the full flow: sign-in, record a moment, share, upgrade to premium
   (redirects out to Chrome Custom Tab on purpose — in-app purchases on
   Google Play require separate StoreKit/Billing integration, see the
   premium doc).

To ship to the Play Store:

1. In Android Studio: **Build → Generate Signed Bundle/APK → Android App
   Bundle (.aab)**. Create or import a keystore (store the keystore
   password somewhere safe — losing it means you can never update the app).
2. Sign up at https://play.google.com/console (US$25 one-time).
3. Create an app, fill in store listing (icon, screenshots, privacy policy
   URL, age rating questionnaire, data safety form).
4. Upload the `.aab` to the Internal testing track first; once Google's
   prelaunch report passes, promote to Closed testing → Open testing →
   Production.

## 3. iOS (requires macOS + Xcode)

Not runnable from Windows. On a Mac:

```bash
npm install
npm run build
npm run cap:add:ios
npm run cap:sync
npm run cap:open:ios   # opens App.xcworkspace in Xcode
```

Then in Xcode:

1. Select the `App` target → **Signing & Capabilities** → pick your Apple
   Developer team. Apple Developer Program membership is **US$99/year**
   (https://developer.apple.com/programs/).
2. Add required permissions in `ios/App/App/Info.plist`:
   - `NSCameraUsageDescription` — "Record your 5PM moment."
   - `NSMicrophoneUsageDescription` — "Add audio to your 5PM moment."
   - `NSPhotoLibraryAddUsageDescription` — "Save your moment to share."
3. Run on a simulator, then a physical device (needed for camera testing).
4. **Product → Archive** → Distribute to App Store Connect.

Then in App Store Connect (https://appstoreconnect.apple.com):

1. Create a new app → pick the matching bundle id.
2. Fill in metadata, screenshots (use the simulator at each required
   device size), privacy nutrition label, Age Rating.
3. Submit a build for review. First review is typically 1–3 days; expect
   at least one round of clarifying questions from App Review.

## 4. Recommended plugins to wire up before launch

These are already installed but not yet used everywhere they could be:

- `@capacitor/status-bar` — adjust the bar colour on the live stream
  overlay so it doesn't look washed out.
- `@capacitor/splash-screen` — fade out after the first React render
  (`SplashScreen.hide()` in `src/main.tsx`).
- `@capacitor/browser` — open privacy / TOS links in an in-app Chrome
  Custom Tab / SFSafariViewController instead of a full context switch.
- `@capacitor/haptics` — buzz on a successful upload / reaction tap.

## 5. Dev / production web hosting

Capacitor loads the built `dist/` bundle embedded in the app. For faster
iteration you can point it at a live dev server by editing the
`server.url` key in `capacitor.config.ts` (see comment block). Revert
before building a release.

## 6. Checklist before the first store submission

- [ ] `capacitor.config.ts` appId finalized.
- [ ] App icon + splash assets at all required sizes in
      `ios/App/App/Assets.xcassets/AppIcon.appiconset` and
      `android/app/src/main/res/mipmap-*` (use
      [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets)
      to auto-generate from a single 1024×1024 PNG).
- [ ] Info.plist permission strings (iOS).
- [ ] `AndroidManifest.xml` permissions audited (camera, microphone,
      internet — nothing extra).
- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` baked into the
      production build (`.env.production`).
- [ ] Privacy policy URL reachable and honest about what's collected.
- [ ] Terms of Service URL reachable.
- [ ] Age rating reflects user-generated video content (typically 12+).
- [ ] Premium purchases either removed from native or replaced with
      StoreKit / Play Billing (see `docs/PREMIUM_STRIPE.md §8`).
