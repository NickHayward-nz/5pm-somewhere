// © 2026 Chromatic Productions Ltd. All rights reserved.
// Supabase Edge Function: send-5pm-notifications
// Schedule every minute with pg_cron or an external cron using CRON_SECRET.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import webpush from 'npm:web-push@3.6.7'

type PreferenceRow = {
  id: string
  user_id: string
  city_id: string
  city_name: string
  country_code: string
  timezone: string
  reminder_offsets: number[]
}

type SubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_secret: string
}

type DuePreference = PreferenceRow & {
  localDate: string
  offsetMinutes: number
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function localTimeParts(timezone: string, now: Date): { date: string; minuteOfDay: number } | null {
  try {
    let formatter = formatters.get(timezone)
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
      formatters.set(timezone, formatter)
    }
    const parts = formatter.formatToParts(now)
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    const hour = Number(values.hour)
    const minute = Number(values.minute)
    if (!values.year || !values.month || !values.day || Number.isNaN(hour) || Number.isNaN(minute)) {
      return null
    }
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      minuteOfDay: hour * 60 + minute,
    }
  } catch {
    return null
  }
}

function duePreferences(preferences: PreferenceRow[], now: Date): DuePreference[] {
  const targetFivePmMinute = 17 * 60
  const due: DuePreference[] = []
  for (const preference of preferences) {
    const local = localTimeParts(preference.timezone, now)
    if (!local) continue

    const offsets = Array.isArray(preference.reminder_offsets) ? preference.reminder_offsets : []
    for (const offset of offsets) {
      if (local.minuteOfDay === targetFivePmMinute - offset) {
        due.push({ ...preference, localDate: local.date, offsetMinutes: offset })
      }
    }
  }
  return due
}

function notificationPayload(preference: DuePreference, siteUrl: string) {
  const isLocal = preference.city_id === 'local'
  const atFive = preference.offsetMinutes === 0
  const city = isLocal ? 'your location' : preference.city_name
  const title = atFive
    ? `It's 5PM in ${city}`
    : `${city} hits 5PM in ${preference.offsetMinutes} minutes`
  const body = atFive
    ? 'Open 5PM Somewhere to catch the live moments now.'
    : 'Get ready for the 5PM moments coming through soon.'

  return {
    title,
    body,
    icon: '/Logo.png',
    url: siteUrl,
    tag: `fivepm:${preference.city_id}:${preference.localDate}:${preference.offsetMinutes}`,
    data: {
      cityId: preference.city_id,
      timezone: preference.timezone,
      localDate: preference.localDate,
      offsetMinutes: preference.offsetMinutes,
    },
  }
}

function pushErrorStatusCode(err: unknown): number | null {
  if (!err || typeof err !== 'object' || !('statusCode' in err)) return null
  const statusCode = (err as { statusCode?: unknown }).statusCode
  return typeof statusCode === 'number' ? statusCode : null
}

serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)

  const cronSecret = Deno.env.get('CRON_SECRET')
  const auth = req.headers.get('Authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://5pmsomewhere.app'
  const supportEmail = Deno.env.get('SUPPORT_EMAIL') ?? 'its.5pm.somewhere.app@gmail.com'

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ error: 'Server not configured.' }, 500)
  }

  webpush.setVapidDetails(`mailto:${supportEmail}`, vapidPublicKey, vapidPrivateKey)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: preferences, error: preferenceError } = await admin
    .from('notification_city_preferences')
    .select('id, user_id, city_id, city_name, country_code, timezone, reminder_offsets')
    .eq('active', true)
    .limit(5000)

  if (preferenceError) {
    console.error('send-5pm-notifications: preference query failed', preferenceError)
    return jsonResponse({ error: 'Could not load preferences.' }, 500)
  }

  const due = duePreferences((preferences ?? []) as PreferenceRow[], new Date())
  if (!due.length) return jsonResponse({ ok: true, due: 0, sent: 0 })

  const userIds = [...new Set(due.map((preference) => preference.user_id))]
  const { data: subscriptions, error: subscriptionError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_secret')
    .eq('active', true)
    .in('user_id', userIds)

  if (subscriptionError) {
    console.error('send-5pm-notifications: subscription query failed', subscriptionError)
    return jsonResponse({ error: 'Could not load subscriptions.' }, 500)
  }

  const subscriptionsByUser = new Map<string, SubscriptionRow[]>()
  for (const subscription of (subscriptions ?? []) as SubscriptionRow[]) {
    const list = subscriptionsByUser.get(subscription.user_id) ?? []
    list.push(subscription)
    subscriptionsByUser.set(subscription.user_id, list)
  }

  let sent = 0
  let skipped = 0
  for (const preference of due) {
    const userSubscriptions = subscriptionsByUser.get(preference.user_id) ?? []
    for (const subscription of userSubscriptions) {
      const { error: claimError } = await admin.from('notification_delivery_log').insert({
        user_id: preference.user_id,
        subscription_id: subscription.id,
        preference_id: preference.id,
        city_id: preference.city_id,
        local_date: preference.localDate,
        offset_minutes: preference.offsetMinutes,
      })
      if (claimError) {
        skipped += 1
        continue
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth_secret,
            },
          },
          JSON.stringify(notificationPayload(preference, siteUrl)),
        )
        sent += 1
      } catch (err) {
        const statusCode = pushErrorStatusCode(err)
        if (statusCode === 404 || statusCode === 410) {
          await admin
            .from('push_subscriptions')
            .update({ active: false })
            .eq('id', subscription.id)
        }
        console.error('send-5pm-notifications: send failed', err)
      }
    }
  }

  return jsonResponse({ ok: true, due: due.length, sent, skipped })
})
