// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CITIES, type City } from '../data/cities'
import { getSupabase } from '../lib/supabase'
import {
  notificationPermission,
  pushNotificationsSupported,
  subscribeCurrentDeviceToPush,
  vapidPublicKeyConfigured,
} from '../lib/pushNotifications'

type PreferenceRow = {
  id: string
  city_id: string
  city_name: string
  country_code: string
  timezone: string
  reminder_offsets: number[]
  active: boolean
}

const OFFSET_OPTIONS = [30, 10, 0]
const LOCAL_CITY_ID = 'local'

function countryName(countryCode: string): string {
  if (countryCode === 'LOCAL') return 'Your timezone'
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? countryCode
  } catch {
    return countryCode
  }
}

function offsetLabel(offset: number): string {
  if (offset === 0) return 'At 5PM'
  return `${offset} min before`
}

function uniqueCities(): City[] {
  const seen = new Set<string>()
  return CITIES.filter((city) => {
    if (seen.has(city.id)) return false
    seen.add(city.id)
    return true
  })
}

type Props = {
  userId: string | null
  userTz: string
}

export function NotificationSettings({ userId, userTz }: Props) {
  const sb = getSupabase()
  const [preferences, setPreferences] = useState<PreferenceRow[]>([])
  const [query, setQuery] = useState('')
  const [newCityOffsets, setNewCityOffsets] = useState<number[]>([10, 0])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [permission, setPermission] = useState(() => notificationPermission())

  const supported = pushNotificationsSupported()
  const vapidReady = vapidPublicKeyConfigured()
  const cities = useMemo(() => uniqueCities(), [])
  const activeCityIds = useMemo(() => new Set(preferences.map((pref) => pref.city_id)), [preferences])
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return cities
      .filter((city) => {
        if (activeCityIds.has(city.id)) return false
        return (
          city.name.toLowerCase().includes(needle) ||
          city.countryCode.toLowerCase().includes(needle) ||
          city.tz.toLowerCase().includes(needle)
        )
      })
      .slice(0, 8)
  }, [activeCityIds, cities, query])

  const loadPreferences = useCallback(async () => {
    if (!sb || !userId) {
      setPreferences([])
      return
    }
    setLoading(true)
    const { data, error } = await sb
      .from('notification_city_preferences')
      .select('id, city_id, city_name, country_code, timezone, reminder_offsets, active')
      .eq('user_id', userId)
      .eq('active', true)
      .order('city_name', { ascending: true })
    setLoading(false)
    if (error) {
      setMessage(error.message || 'Could not load notification settings.')
      return
    }
    setPreferences((data ?? []) as PreferenceRow[])
  }, [sb, userId])

  useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  const ensureLocalPreference = async () => {
    if (!sb || !userId) return
    await sb.from('notification_city_preferences').upsert(
      {
        user_id: userId,
        city_id: LOCAL_CITY_ID,
        city_name: 'My local 5PM',
        country_code: 'LOCAL',
        timezone: userTz,
        reminder_offsets: [10, 0],
        active: true,
      },
      { onConflict: 'user_id,city_id' },
    )
  }

  const enableNotifications = async () => {
    if (!userId) {
      setMessage('Sign in to enable notifications.')
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await subscribeCurrentDeviceToPush()
    setPermission(notificationPermission())
    if (result.ok) {
      await ensureLocalPreference()
      await loadPreferences()
      setMessage('Notifications enabled for this device.')
    } else {
      setMessage(result.error)
    }
    setSaving(false)
  }

  const addCity = async (city: City) => {
    if (!sb || !userId) {
      setMessage('Sign in to add city notifications.')
      return
    }
    setSaving(true)
    setMessage(null)
    const { error } = await sb.from('notification_city_preferences').upsert(
      {
        user_id: userId,
        city_id: city.id,
        city_name: city.name,
        country_code: city.countryCode,
        timezone: city.tz,
        reminder_offsets: newCityOffsets,
        active: true,
      },
      { onConflict: 'user_id,city_id' },
    )
    setSaving(false)
    if (error) {
      setMessage(error.message || 'Could not add city.')
      return
    }
    setQuery('')
    await loadPreferences()
  }

  const updateOffsets = async (preference: PreferenceRow, offset: number, checked: boolean) => {
    if (!sb) return
    const next = checked
      ? [...new Set([...preference.reminder_offsets, offset])].sort((a, b) => b - a)
      : preference.reminder_offsets.filter((value) => value !== offset)
    if (!next.length) {
      setMessage('Choose at least one notification time.')
      return
    }
    const { error } = await sb
      .from('notification_city_preferences')
      .update({ reminder_offsets: next })
      .eq('id', preference.id)
    if (error) {
      setMessage(error.message || 'Could not update reminder times.')
      return
    }
    setPreferences((items) =>
      items.map((item) => (item.id === preference.id ? { ...item, reminder_offsets: next } : item)),
    )
  }

  const removePreference = async (preference: PreferenceRow) => {
    if (!sb) return
    const { error } = await sb
      .from('notification_city_preferences')
      .delete()
      .eq('id', preference.id)
    if (error) {
      setMessage(error.message || 'Could not remove notification.')
      return
    }
    setPreferences((items) => items.filter((item) => item.id !== preference.id))
  }

  const toggleNewCityOffset = (offset: number, checked: boolean) => {
    const next = checked
      ? [...new Set([...newCityOffsets, offset])].sort((a, b) => b - a)
      : newCityOffsets.filter((value) => value !== offset)
    if (next.length) setNewCityOffsets(next)
  }

  return (
    <div className="rounded-xl border border-sunset-300/25 bg-sunset-400/10 px-3 py-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sunset-200">
        5PM notifications
      </div>
      <p className="mb-3 text-xs leading-relaxed text-sunset-50/85">
        Get reminded before your own 5PM window and before selected cities hit 5PM.
      </p>

      <button
        type="button"
        onClick={() => void enableNotifications()}
        disabled={!userId || saving || !supported || !vapidReady}
        className="btn-glow-gold min-h-[44px] w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving...' : permission === 'granted' ? 'Refresh notification device' : 'Enable notifications'}
      </button>

      {!userId ? <p className="mt-2 text-xs text-sunset-100/70">Sign in to manage notifications.</p> : null}
      {!supported ? <p className="mt-2 text-xs text-red-100">This browser does not support Web Push.</p> : null}
      {supported && !vapidReady ? (
        <p className="mt-2 text-xs text-amber-100">Add `VITE_VAPID_PUBLIC_KEY` to enable push subscriptions.</p>
      ) : null}
      {permission === 'denied' ? (
        <p className="mt-2 text-xs text-red-100">Notifications are blocked in your browser settings.</p>
      ) : null}
      {message ? <p className="mt-2 text-xs text-sunset-50/85">{message}</p> : null}

      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
        <label className="mb-2 block text-xs font-semibold text-sunset-100/85" htmlFor="notification-city-search">
          Add a city
        </label>
        <input
          id="notification-city-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Rio, Tokyo, London..."
          className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-sunset-50 placeholder:text-sunset-100/40 focus:border-sunset-300 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {OFFSET_OPTIONS.map((offset) => (
            <label key={offset} className="inline-flex items-center gap-1 text-[11px] text-sunset-100/80">
              <input
                type="checkbox"
                checked={newCityOffsets.includes(offset)}
                onChange={(event) => toggleNewCityOffset(offset, event.target.checked)}
              />
              {offsetLabel(offset)}
            </label>
          ))}
        </div>

        {searchResults.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {searchResults.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => void addCity(city)}
                disabled={saving}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-sunset-50 hover:bg-white/10 disabled:opacity-60"
              >
                {city.name}
                <span className="ml-2 text-xs text-sunset-100/55">
                  {countryName(city.countryCode)} - {city.tz}
                </span>
              </button>
            ))}
          </div>
        ) : query.trim() ? (
          <p className="mt-2 text-xs text-sunset-100/60">No matching cities found.</p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {loading ? <p className="text-xs text-sunset-100/70">Loading notification settings...</p> : null}
        {preferences.map((preference) => (
          <div key={preference.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-sunset-50">{preference.city_name}</div>
                <div className="text-[11px] text-sunset-100/55">
                  {countryName(preference.country_code)} - {preference.timezone}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void removePreference(preference)}
                className="text-[11px] text-sunset-100/65 hover:text-sunset-50"
              >
                Remove
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {OFFSET_OPTIONS.map((offset) => (
                <label key={offset} className="inline-flex items-center gap-1 text-[11px] text-sunset-100/80">
                  <input
                    type="checkbox"
                    checked={preference.reminder_offsets.includes(offset)}
                    onChange={(event) => void updateOffsets(preference, offset, event.target.checked)}
                  />
                  {offsetLabel(offset)}
                </label>
              ))}
            </div>
          </div>
        ))}
        {!loading && preferences.length === 0 ? (
          <p className="text-xs text-sunset-100/65">
            Enable notifications to add your local 5PM reminder, then search for cities to follow.
          </p>
        ) : null}
      </div>
    </div>
  )
}
