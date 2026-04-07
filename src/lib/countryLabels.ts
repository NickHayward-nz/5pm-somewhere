// © 2026 Chromatic Productions Ltd. All rights reserved.
import type { City } from '../data/cities'

export type CountryLabel = {
  countryCode: string
  name: string
  lat: number
  lon: number
}

/** One label per country in the city list; position = centroid of those cities. */
export function countryLabelsFromCities(cities: City[]): CountryLabel[] {
  const map = new Map<string, { sumLat: number; sumLon: number; n: number }>()
  for (const c of cities) {
    const e = map.get(c.countryCode) ?? { sumLat: 0, sumLon: 0, n: 0 }
    e.sumLat += c.lat
    e.sumLon += c.lon
    e.n += 1
    map.set(c.countryCode, e)
  }
  let regionNames: Intl.DisplayNames | null = null
  try {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    /* ignore */
  }
  const out: CountryLabel[] = []
  for (const [code, agg] of map) {
    let name = code
    if (regionNames) {
      try {
        name = regionNames.of(code) ?? code
      } catch {
        name = code
      }
    }
    out.push({
      countryCode: code,
      name,
      lat: agg.sumLat / agg.n,
      lon: agg.sumLon / agg.n,
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}
