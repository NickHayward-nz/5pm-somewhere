/// <reference lib="webworker" />
// © 2026 Chromatic Productions Ltd. All rights reserved.

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

type PushPayload = {
  title?: string
  body?: string
  tag?: string
  url?: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('push', (event) => {
  const fallback: Required<Pick<PushPayload, 'title' | 'body' | 'url' | 'icon'>> = {
    title: "It's 5PM Somewhere",
    body: 'A 5PM moment window is opening now.',
    url: '/',
    icon: '/Logo.png',
  }

  let payload: PushPayload = {}
  try {
    payload = event.data?.json() as PushPayload
  } catch {
    payload = { body: event.data?.text() }
  }

  const title = payload.title ?? fallback.title
  const url = payload.url ?? fallback.url
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? fallback.body,
      icon: payload.icon ?? fallback.icon,
      badge: payload.badge ?? payload.icon ?? fallback.icon,
      tag: payload.tag,
      data: { ...(payload.data ?? {}), url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl = event.notification.data?.url
  const targetUrl = typeof rawUrl === 'string' ? rawUrl : '/'
  const absoluteUrl = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          await client.focus()
          return
        }
      }
      await self.clients.openWindow(absoluteUrl)
    }),
  )
})
