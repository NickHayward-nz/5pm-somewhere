// © 2026 Chromatic Productions Ltd. All rights reserved.
import { useEffect, useMemo, useRef } from 'react'
import { DateTime } from 'luxon'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { City } from '../data/cities'
import { latLonToVector3 } from '../lib/geo'
import { getCityTimeInfo, NEAR_FIVE_PM_VISIBLE_MINUTES } from '../lib/time'

const DAY_MAP_URL =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'

const DOT_UPDATE_INTERVAL_MS = 120000
const SPHERE_SEGMENTS = 64
/** City name labels sit slightly outside city pins */
const CITY_LABEL_RADIUS = 1.075
/** Camera distance (orbit target = origin): hide labels when zoomed out */
const LABEL_ZOOM_DIST_FULL = 3.45
/** Show labels fully when zoomed in at least this much */
const LABEL_ZOOM_DIST_NONE = 2.02

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
    dotTimeRef.current = now.toMillis()
  }, [now])

  useEffect(() => {
    const hostEl = hostRef.current
    if (!hostEl) return
    const el = hostEl

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    const canvas = renderer.domElement
    canvas.style.display = 'block'
    canvas.style.margin = '0'
    canvas.style.padding = '0'
    canvas.style.verticalAlign = 'top'
    el.appendChild(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50)
    camera.position.set(0, 0, 3.25)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableZoom = true
    controls.zoomSpeed = 1.0
    controls.minDistance = 1.5
    controls.maxDistance = 5.0
    controls.enablePan = false
    controls.enableRotate = true
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5

    const group = new THREE.Group()
    scene.add(group)

    // Lighting for the globe
    scene.add(new THREE.AmbientLight(0xffffff, 1.0))
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(5, 3, 5)
    scene.add(sun)

    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    const earthGeo = new THREE.SphereGeometry(1, 64, 64)

    const earthMat = new THREE.MeshPhongMaterial()
    const earth = new THREE.Mesh(earthGeo, earthMat)
    group.add(earth)

    loader.load(
      DAY_MAP_URL,
      (tex) => {
        earthMat.map = tex
        earthMat.needsUpdate = true
      },
      undefined,
      (err) => {
        console.error('Pastel texture load failed:', err)
        earthMat.color = new THREE.Color(0xaaddff)
        earthMat.needsUpdate = true
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

    // Small solid core (city pin) — size stays compact so land stays visible
    const markerGeo = new THREE.SphereGeometry(0.007, 10, 10)
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xff9a62,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    })
    const markers = new THREE.InstancedMesh(markerGeo, markerMat, cityPositions.length)
    markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    group.add(markers)

    // Soft ring: transparent center (map shows through), bright annulus, soft outer falloff
    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = 128
    spriteCanvas.height = 128
    const ctx = spriteCanvas.getContext('2d')
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62)
      g.addColorStop(0, 'rgba(255, 200, 140, 0)')
      g.addColorStop(0.28, 'rgba(255, 200, 140, 0)')
      g.addColorStop(0.38, 'rgba(255, 190, 120, 0.55)')
      g.addColorStop(0.52, 'rgba(255, 150, 85, 0.75)')
      g.addColorStop(0.72, 'rgba(255, 120, 70, 0.35)')
      g.addColorStop(1, 'rgba(255, 100, 50, 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 128)
    }
    const spriteTex = new THREE.CanvasTexture(spriteCanvas)
    const spriteMat = new THREE.SpriteMaterial({
      map: spriteTex,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    })

    const ringSprites: THREE.Sprite[] = []
    for (let i = 0; i < cityPositions.length; i++) {
      const s = new THREE.Sprite(spriteMat.clone())
      s.scale.setScalar(0.12)
      group.add(s)
      ringSprites.push(s)
    }

    function makeCityLabelSprite(text: string): THREE.Sprite {
      const cw = 512
      const ch = 112
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        const empty = new THREE.CanvasTexture(document.createElement('canvas'))
        return new THREE.Sprite(new THREE.SpriteMaterial({ map: empty, transparent: true, opacity: 0 }))
      }
      ctx.clearRect(0, 0, cw, ch)
      const fontPx = 28
      ctx.font = `600 ${fontPx}px Poppins, Inter, system-ui, sans-serif`
      let display = text
      const maxTextW = cw - 56
      while (display.length > 4 && ctx.measureText(display).width > maxTextW) {
        display = display.slice(0, -2).trimEnd() + '…'
      }
      const tw = ctx.measureText(display).width
      const bw = Math.min(cw - 28, tw + 44)
      const bh = 54
      const bx = (cw - bw) / 2
      const by = (ch - bh) / 2
      const r = 14
      ctx.fillStyle = 'rgba(14, 12, 32, 0.82)'
      ctx.beginPath()
      ctx.roundRect(bx, by, bw, bh, r)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 170, 110, 0.62)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = 'rgba(255, 240, 220, 0.98)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(display, cw / 2, by + bh / 2)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
      })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.setScalar(0.17)
      return sprite
    }

    const cityLabelSprites: THREE.Sprite[] = []
    for (const { city } of cityPositions) {
      const v = latLonToVector3(city.lat, city.lon, CITY_LABEL_RADIUS)
      const spr = makeCityLabelSprite(city.name)
      spr.position.set(v.x, v.y, v.z)
      spr.visible = false
      group.add(spr)
      cityLabelSprites.push(spr)
    }

    const tmpObj = new THREE.Object3D()
    const baseColor = new THREE.Color()

    function resize() {
      const rect = el.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      let h = Math.max(1, Math.floor(rect.height))
      // Flex can report 0 height before layout; fall back until ResizeObserver refires
      if (h <= 1 && w > 1) {
        h = Math.max(120, Math.round(w * 0.75))
      }
      el.style.background = 'transparent'
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
      // `true` updates canvas CSS width/height so the drawing buffer matches what’s shown (false caused quadrant/misalignment)
      renderer.setSize(w, h, true)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      controls.update()
    }
    resize()
    requestAnimationFrame(() => resize())
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const dotInterval = setInterval(() => {
      dotTimeRef.current = DateTime.now().toMillis()
    }, DOT_UPDATE_INTERVAL_MS)

    function zoomByWheel(deltaY: number) {
      const rect = renderer.domElement.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      renderer.domElement.dispatchEvent(
        new WheelEvent('wheel', { deltaY, clientX: cx, clientY: cy, bubbles: true }),
      )
    }

    const zoomInBtn = document.createElement('button')
    zoomInBtn.type = 'button'
    zoomInBtn.textContent = '+'
    zoomInBtn.setAttribute('aria-label', 'Zoom in')
    Object.assign(zoomInBtn.style, {
      position: 'absolute',
      bottom: '12px',
      right: '44px',
      zIndex: '20',
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      border: '1px solid rgba(255,160,90,0.5)',
      background: 'rgba(200,100,50,0.25)',
      color: 'rgba(255,220,180,0.95)',
      fontSize: '18px',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: '0 0 12px rgba(255,140,80,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      lineHeight: '1',
    })
    zoomInBtn.onclick = () => zoomByWheel(-80)

    const zoomOutBtn = document.createElement('button')
    zoomOutBtn.type = 'button'
    zoomOutBtn.textContent = '−'
    zoomOutBtn.setAttribute('aria-label', 'Zoom out')
    Object.assign(zoomOutBtn.style, {
      position: 'absolute',
      bottom: '12px',
      right: '12px',
      zIndex: '20',
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      border: '1px solid rgba(255,160,90,0.5)',
      background: 'rgba(200,100,50,0.25)',
      color: 'rgba(255,220,180,0.95)',
      fontSize: '18px',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: '0 0 12px rgba(255,140,80,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      lineHeight: '1',
    })
    zoomOutBtn.onclick = () => zoomByWheel(80)
    el.style.position = 'relative'
    el.appendChild(zoomInBtn)
    el.appendChild(zoomOutBtn)

    function tick() {
      controls.update()

      const dotNow = DateTime.fromMillis(dotTimeRef.current)
      const timeForDots = dotNow.isValid ? dotNow : DateTime.now()

      for (let i = 0; i < cityPositions.length; i++) {
        const { city, pos } = cityPositions[i]
        const info = getCityTimeInfo(city.tz, timeForDots)
        const intensity = info.intensity
        const withinWindow = info.absMinutesFromFivePm <= NEAR_FIVE_PM_VISIBLE_MINUTES
        // 1 at exactly 5pm, 0 at ±90 min — drives ring size
        const proximityToFive =
          withinWindow ? 1 - info.absMinutesFromFivePm / NEAR_FIVE_PM_VISIBLE_MINUTES : 0

        tmpObj.position.set(pos.x, pos.y, pos.z)
        if (withinWindow) {
          // Tiny solid core; slight brightening at peak (does not grow huge)
          tmpObj.scale.setScalar(0.88 + intensity * 0.14)
        } else {
          tmpObj.scale.setScalar(0)
        }
        tmpObj.updateMatrix()
        markers.setMatrixAt(i, tmpObj.matrix)

        baseColor.copy(intensityToColor(intensity))
        markers.setColorAt(i, baseColor)

        const spr = ringSprites[i]
        spr.position.set(pos.x, pos.y, pos.z)
        if (withinWindow) {
          // Large soft ring grows as we approach 5pm (proximityToFive → 1)
          const ringScale = 0.055 + proximityToFive * 0.2
          spr.scale.setScalar(ringScale)
          const mat = spr.material as THREE.SpriteMaterial
          mat.opacity = Math.max(0, Math.min(1, 0.28 + proximityToFive * 0.62))
          mat.color.copy(intensityToColor(intensity))
        } else {
          spr.scale.setScalar(0)
          ;(spr.material as THREE.SpriteMaterial).opacity = 0
        }
      }

      if (markers.instanceColor) markers.instanceColor.needsUpdate = true
      markers.instanceMatrix.needsUpdate = true

      const camDist = camera.position.distanceTo(controls.target)
      const labelT = THREE.MathUtils.clamp(
        (LABEL_ZOOM_DIST_FULL - camDist) / (LABEL_ZOOM_DIST_FULL - LABEL_ZOOM_DIST_NONE),
        0,
        1,
      )
      const labelOpacity = labelT * 0.94
      const labelScale = 0.12 + labelT * 0.08
      for (const spr of cityLabelSprites) {
        spr.visible = labelOpacity > 0.02
        spr.scale.setScalar(labelScale)
        const m = spr.material as THREE.SpriteMaterial
        m.opacity = labelOpacity
      }

      renderer.render(scene, camera)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      clearInterval(dotInterval)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      ro.disconnect()
      controls.dispose()
      for (const spr of cityLabelSprites) {
        const m = spr.material as THREE.SpriteMaterial
        m.map?.dispose()
        m.dispose()
        group.remove(spr)
      }
      if (el.contains(zoomInBtn)) el.removeChild(zoomInBtn)
      if (el.contains(zoomOutBtn)) el.removeChild(zoomOutBtn)
      renderer.dispose()
      if (el.contains(canvas)) el.removeChild(canvas)
    }
  }, [cityPositions])

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 w-full flex-1 flex-col items-stretch justify-center overflow-hidden p-0">
        <div
          ref={hostRef}
          className="globe-host globe-host-portrait relative h-full min-h-0 w-full min-w-0 flex-1 touch-none select-none overflow-hidden"
          style={{ touchAction: 'none' }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[1.35rem] ring-1 ring-white/5" />
    </div>
  )
}
