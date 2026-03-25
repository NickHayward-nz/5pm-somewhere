// © 2026 Chromatic Productions Ltd. All rights reserved.
export type LatLon = { lat: number; lon: number }

export function latLonToVector3(lat: number, lon: number, radius: number) {
  // lon: -180..180, lat: -90..90
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  const x = -radius * Math.sin(phi) * Math.cos(theta)
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return { x, y, z }
}

