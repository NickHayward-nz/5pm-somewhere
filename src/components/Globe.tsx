import { useEffect, useMemo, useRef } from 'react'
import { DateTime } from 'luxon'
import * as THREE from 'three'
import type { City } from '../data/cities'
import { latLonToVector3 } from '../lib/geo'
import { getCityTimeInfo } from '../lib/time'

const DAY_MAP_URL =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'
const NIGHT_MAP_URL =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.jpg'
const SPEC_MAP_URL =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg'

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(5, 3, 5)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0xb8d4ff, 0.2)
    fill.position.set(-2, 1, -2)
    scene.add(fill)

    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    const earthGeo = new THREE.SphereGeometry(1, 64, 64)

    const earthMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(0x0066bb),
      emissive: new THREE.Color(0x111111),
      emissiveIntensity: 0.7,
      specular: new THREE.Color(0x333333),
      shininess: 8,
    })
    const earth = new THREE.Mesh(earthGeo, earthMat)
    group.add(earth)

    let dayTexture: THREE.Texture | null = null
    let nightTexture: THREE.Texture | null = null
    let specularTexture: THREE.Texture | null = null

    function applyTextures() {
      if (!dayTexture) return
      dayTexture.colorSpace = THREE.SRGBColorSpace
      dayTexture.wrapS = THREE.RepeatWrapping
      dayTexture.wrapT = THREE.ClampToEdgeWrapping
      if (nightTexture) nightTexture.colorSpace = THREE.SRGBColorSpace
      if (specularTexture) specularTexture.colorSpace = THREE.SRGBColorSpace

      const mat = earth.material as THREE.MeshPhongMaterial
      mat.map = dayTexture
      mat.emissiveMap = nightTexture
      mat.emissive = new THREE.Color(0x111111)
      mat.emissiveIntensity = 0.7
      mat.specularMap = specularTexture
      mat.specular = new THREE.Color(0x333333)
      mat.shininess = 8
      mat.color.set(0xffffff)
      mat.needsUpdate = true
      // eslint-disable-next-line no-console
      console.log('Texture loading status:', dayTexture ? 'success' : 'failed')
    }

    loader.load(
      DAY_MAP_URL,
      (tex) => {
        dayTexture = tex
        // eslint-disable-next-line no-console
        console.log('Day map loaded')
        applyTextures()
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error('Day map load error:', err)
        ;(earth.material as THREE.MeshPhongMaterial).color.set(0x0066bb)
        // eslint-disable-next-line no-console
        console.warn('Globe using fallback blue color (day texture failed)')
      },
    )

    loader.load(
      NIGHT_MAP_URL,
      (tex) => {
        nightTexture = tex
        // eslint-disable-next-line no-console
        console.log('Night map loaded')
        if (dayTexture) applyTextures()
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error('Night map load error:', err)
      },
    )

    loader.load(
      SPEC_MAP_URL,
      (tex) => {
        specularTexture = tex
        // eslint-disable-next-line no-console
        console.log('Specular map loaded')
        if (dayTexture) applyTextures()
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error('Specular map load error:', err)
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
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-2 sm:p-4">
        <div className="rounded-full bg-midnight-700/50 border border-sunset-500/25 px-2 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs text-sunset-100/80 truncate max-w-[50%]">
          Drag · 5PM glow
        </div>
        <div className="rounded-full bg-midnight-700/50 border border-sunset-500/25 px-2 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-mono text-sunset-50/90">
          {now.toFormat('HH:mm:ss')}
        </div>
      </div>
      <div
        ref={hostRef}
        className="w-full max-w-[90%] mx-auto flex-1 min-h-0 h-[60vh] sm:h-full sm:max-w-full select-none touch-none"
        style={{ touchAction: 'none' }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[1.35rem] ring-1 ring-white/5" />
    </div>
  )
}
