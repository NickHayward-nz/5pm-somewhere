// © 2026 Chromatic Productions Ltd. All rights reserved.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Only expose browser env vars that the app intentionally reads. Vercel can
  // inject VITE_VERCEL_* build metadata; without this allow-list Vite will make
  // that metadata available in import.meta.env and it can leak into bundles.
  envPrefix: [
    'VITE_SUPABASE_',
    'VITE_LIVE_STREAM_',
    'VITE_POSTHOG_',
    'VITE_PLAUSIBLE_',
    'VITE_SENTRY_',
    'VITE_APP_',
    'VITE_ANALYTICS_',
    'VITE_VAPID_',
  ],
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: '5PM Somewhere',
        short_name: '5PM',
        description: "It's 5PM Somewhere",
        start_url: '/',
        scope: '/',
        theme_color: '#f97316',
        background_color: '#1a0f00',
        display: 'standalone',
        icons: [
          {
            src: 'Logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'Logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    allowedHosts: [
      'localhost',
      '.ngrok-free.dev'  // This allows ALL ngrok-free.dev subdomains
      // OR for exact match: 'unelucidated-nondecisively-emiko.ngrok-free.dev'
    ]
  }
})