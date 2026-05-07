// © 2026 Chromatic Productions Ltd. All rights reserved.
import { getSupabase } from './supabase'

type PushSubscribeResult =
  | { ok: true }
  | { ok: false; error: string }

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export function pushNotificationsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function vapidPublicKeyConfigured(): boolean {
  return Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY)
}

export async function subscribeCurrentDeviceToPush(): Promise<PushSubscribeResult> {
  if (!pushNotificationsSupported()) {
    return { ok: false, error: 'This browser does not support Web Push notifications.' }
  }

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!publicKey) {
    return { ok: false, error: 'Notifications are not configured yet. Missing VITE_VAPID_PUBLIC_KEY.' }
  }

  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Supabase is not configured.' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return {
      ok: false,
      error: permission === 'denied' ? 'Notifications are blocked for this app.' : 'Notification permission was not granted.',
    }
  }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  const { error } = await sb.functions.invoke('save-push-subscription', {
    body: {
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    },
  })

  if (error) {
    return { ok: false, error: error.message || 'Could not save notification subscription.' }
  }

  return { ok: true }
}
