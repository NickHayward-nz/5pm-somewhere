import { useEffect, useMemo, useRef } from 'react'
import { DateTime } from 'luxon'
import * as THREE from 'three'
import type { City } from '../data/cities'
import { latLonToVector3 } from '../lib/geo'
import { getCityTimeInfo } from '../lib/time'

const DAY_MAP_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg'

const AUTO_ROTATE_Y_DEG_PER_FRAME = 0.12
const DOT_UPDATE_INTERVAL_MS = 120000
const SPHERE_SEGMENTS = 64

type Props = {
  now: DateTime
  cities: City[]
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function intensityToColor(intensity: number) {
  const t = Math.min(1, Math.max(0, intensity))
  return new THREE.Color(
    lerp(0.35, 1.0, t),
    lerp(0.18, 0.78, t),
    lerp(0.25, 0.34, t),
  )
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
    }
  }
  return [h * 360, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360
  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

export function Globe({ now, cities }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const dotTimeRef = useRef<number>(now.toMillis())

  const cityPositions = useMemo(() => {
    const radius = 1.02
    return cities.map((c) => ({
      city: c,
      pos: latLonToVector3(c.lat, c.lon, radius),
    }))
  }, [cities])

  useEffect(() => {
    const hostEl = hostRef.current
    if (!hostEl) return
    const el = hostEl

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50)
    camera.position.set(0, 0, 3.25)

    const group = new THREE.Group()
    scene.add(group)

    // Brighter lighting so the pastel globe pops
    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(5, 3, 5)
    scene.add(sun)

    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    const earthGeo = new THREE.SphereGeometry(1, 64, 64)

    // MeshPhongMaterial with light pastel tint controlled via material only
    const earthMat = new THREE.MeshPhongMaterial()
    const earth = new THREE.Mesh(earthGeo, earthMat)
    group.add(earth)

    let dayTexture: THREE.Texture | null = null

    function enhanceContinentEdges(sourceTex: THREE.Texture): THREE.CanvasTexture {
      const img = sourceTex.image as HTMLImageElement
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return sourceTex as THREE.CanvasTexture
      ctx.drawImage(img, 0, 0)

      // Aggressive selective land enhancement (pixel-by-pixel)
      const imageData = ctx.getImageData(0, 0, w, h)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        // Aggressive land detection (green/brown dominance, exclude blues)
        if (g > r * 1.1 && g > b * 1.1 && (r + b) / 2 < 180 && g > 90) {
          const hsl = rgbToHsl(r, g, b)
          hsl[1] = Math.min(1, hsl[1] * 2.0) // double saturation on land
          hsl[2] = Math.min(1, hsl[2] * 1.5) // +50% lightness/contrast on land
          const [newR, newG, newB] = hslToRgb(hsl[0], hsl[1], hsl[2])
          data[i] = newR
          data[i + 1] = newG
          data[i + 2] = newB
        }
      }
      ctx.putImageData(imageData, 0, 0)

      // Strong land edge darkening (outline effect)
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = 'rgba(0,0,0,0.25)' // stronger black for edges
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      const enhancedTexture = new THREE.CanvasTexture(canvas)
      enhancedTexture.needsUpdate = true
      // eslint-disable-next-line no-console
      console.log('Aggressive land pop-out applied - continents should stand out clearly')
      return enhancedTexture
    }

    function applyTextures() {
      if (!dayTexture) return
      dayTexture.colorSpace = THREE.SRGBColorSpace
      dayTexture.wrapS = THREE.RepeatWrapping
      dayTexture.wrapT = THREE.ClampToEdgeWrapping

      // Replace material with a neutral MeshPhongMaterial using the enhanced texture
      const mat = new THREE.MeshPhongMaterial({
        map: dayTexture,
        shininess: 5,
      })
      earth.material = mat
      mat.needsUpdate = true

      // Debug logging to verify texture state
      // eslint-disable-next-line no-console
      console.log('Neutral material applied with aggressive land pop-out texture')
      // eslint-disable-next-line no-console
      console.log('Material map applied:', mat.map ? 'yes' : 'no')
      // eslint-disable-next-line no-console
      console.log(
        'Texture image dimensions:',
        (dayTexture as any)?.image?.width,
        (dayTexture as any)?.image?.height,
      )
    }

    loader.load(
      DAY_MAP_URL,
      (tex) => {
        // eslint-disable-next-line no-console
        console.log('Day map loaded successfully')
        tex.colorSpace = THREE.SRGBColorSpace
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        dayTexture = enhanceContinentEdges(tex)
        dayTexture.colorSpace = THREE.SRGBColorSpace
        dayTexture.wrapS = THREE.RepeatWrapping
        dayTexture.wrapT = THREE.ClampToEdgeWrapping
        applyTextures()
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error('Day map load failed:', err)
        const mat = earth.material as THREE.MeshPhongMaterial
        mat.color = new THREE.Color(0xaaddff)
        mat.needsUpdate = true
        // eslint-disable-next-line no-console
        console.log('Globe using fallback pastel blue (day texture failed)')
      },
    )

    const atmoGeo = new THREE.SphereGeometry(1.04, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
    const atmo = new THREE.Mesh(
      atmoGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffb56b,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      }),
    )
    group.add(atmo)

    const markerGeo = new THREE.SphereGeometry(0.012, 8, 8)
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xff9a62,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const markers = new THREE.InstancedMesh(markerGeo, markerMat, cityPositions.length)
    markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    group.add(markers)

    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = 128
    spriteCanvas.height = 128
    const ctx = spriteCanvas.getContext('2d')
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, 'rgba(255,220,160,1)')
      g.addColorStop(0.35, 'rgba(255,160,90,0.7)')
      g.addColorStop(1, 'rgba(255,120,60,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 128)
    }
    const spriteTex = new THREE.CanvasTexture(spriteCanvas)
    const spriteMat = new THREE.SpriteMaterial({
      map: spriteTex,
      color: 0xffb56b,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
    })

    const sprites: THREE.Sprite[] = []
    for (let i = 0; i < cityPositions.length; i++) {
      const s = new THREE.Sprite(spriteMat.clone())
      s.scale.setScalar(0.12)
      group.add(s)
      sprites.push(s)
    }

    const tmpObj = new THREE.Object3D()
    const baseColor = new THREE.Color()

    function resize() {
      const w = el.clientWidth ?? 0
      const h = el.clientHeight || Math.round(w * 0.78)
      const height = Math.max(120, h)
      el.style.background = 'transparent'
      renderer.setSize(w, height, false)
      camera.aspect = w / height
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    dotTimeRef.current = now.toMillis()
    const dotInterval = setInterval(() => {
      dotTimeRef.current = DateTime.now().toMillis()
    }, DOT_UPDATE_INTERVAL_MS)

    let dragging = false
    let lastX = 0
    let lastY = 0
    let velX = 0
    let velY = 0

    function onPointerDown(e: PointerEvent) {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      el.setPointerCapture(e.pointerId)
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      velY = dx * 0.003
      velX = dy * 0.003
      group.rotation.y += velY
      group.rotation.x += velX
      group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x))
    }

    function onPointerUp(e: PointerEvent) {
      dragging = false
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* no-op */
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)

    const autoRotateY = (AUTO_ROTATE_Y_DEG_PER_FRAME * Math.PI) / 180

    function tick() {
      if (!dragging) {
        group.rotation.y += autoRotateY + velY * 0.88
        group.rotation.x += velX * 0.88
        velX *= 0.92
        velY *= 0.92
        group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x))
      }

      const dotNow = DateTime.fromMillis(dotTimeRef.current)
      const timeForDots = dotNow.isValid ? dotNow : now

      for (let i = 0; i < cityPositions.length; i++) {
        const { city, pos } = cityPositions[i]
        const info = getCityTimeInfo(city.tz, timeForDots)
        const intensity = info.intensity

        tmpObj.position.set(pos.x, pos.y, pos.z)
        tmpObj.scale.setScalar(0.65 + intensity * 1.85)
        tmpObj.updateMatrix()
        markers.setMatrixAt(i, tmpObj.matrix)

        baseColor.copy(intensityToColor(intensity))
        markers.setColorAt(i, baseColor)

        const spr = sprites[i]
        spr.position.set(pos.x, pos.y, pos.z)
        spr.scale.setScalar(0.08 + intensity * 0.22)
        ;(spr.material as THREE.SpriteMaterial).opacity = Math.max(0, intensity - 0.12)
      }

      if (markers.instanceColor) markers.instanceColor.needsUpdate = true
      markers.instanceMatrix.needsUpdate = true

      renderer.render(scene, camera)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      clearInterval(dotInterval)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      ro.disconnect()
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [cityPositions])

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-visible min-w-0 !overflow-visible">
      <style>{`
        @media (max-width: 640px) {
          .globe-portrait-fill {
            width: 100% !important;
            height: auto !important;
            max-height: 80vh !important;
            margin: 0 auto !important;
            padding: 0 !important;
            overflow: visible !important;
            clip-path: none !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .globe-host-portrait {
            width: 100% !important;
            height: auto !important;
            max-height: 80vh !important;
            transform: scale(1.3) !important;
            transform-origin: center center !important;
            position: relative !important;
            left: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding-left: 0 !important;
            overflow: visible !important;
            clip-path: none !important;
            object-fit: contain !important;
            object-position: center !important;
          }
          .globe-host-portrait canvas {
            width: 100% !important;
            height: auto !important;
            position: relative !important;
            left: 0 !important;
            margin-left: 0 !important;
            padding-left: 0 !important;
            overflow: visible !important;
            clip-path: none !important;
            object-fit: contain !important;
            object-position: center !important;
          }
        }
        @media (min-width: 641px) {
          .globe-host-portrait {
            transform: none !important;
          }
        }
      `}</style>
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-2 sm:p-4">
        <div className="rounded-full bg-midnight-700/50 border border-sunset-500/25 px-2 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs text-sunset-100/80 truncate max-w-[50%]">
          Drag · 5PM glow
        </div>
        <div className="rounded-full bg-midnight-700/50 border border-sunset-500/25 px-2 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-mono text-sunset-50/90">
          {now.toFormat('HH:mm:ss')}
        </div>
      </div>
      <div className="globe-portrait-fill flex-1 min-h-0 flex items-center justify-center overflow-visible p-0 w-full max-h-[80vh] sm:max-h-none mx-auto !overflow-visible">
        <div
          ref={hostRef}
          className="globe-host globe-host-portrait w-full h-[80vh] max-h-[80vh] min-h-0 flex-none overflow-visible sm:h-full sm:max-h-none sm:flex-1 select-none touch-none !overflow-visible"
          style={{
            touchAction: 'none',
            clipPath: 'none',
            overflow: 'visible',
            marginLeft: 0,
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[1.35rem] ring-1 ring-white/5" />
    </div>
  )
}
