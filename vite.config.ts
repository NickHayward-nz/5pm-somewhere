// © 2026 Chromatic Productions Ltd. All rights reserved.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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