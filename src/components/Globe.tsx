import { useEffect, useMemo, useRef } from 'react'
import { DateTime } from 'luxon'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { City } from '../data/cities'
import { latLonToVector3 } from '../lib/geo'
import { getCityTimeInfo } from '../lib/time'

const DAY_MAP_URL =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'

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
    // eslint-disable-next-line no-console
    console.log('Zoom enabled - min/max distance:', controls.minDistance, controls.maxDistance)

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
        // eslint-disable-next-line no-console
        console.log('Pastel texture loaded successfully')
        earthMat.map = tex
        earthMat.needsUpdate = true
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
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

    const markerGeo = new THREE.SphereGeometry(0.012, 8, 8)
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xff9a62,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthTest: true,
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
      // Tighter gradient so glow is contained (no large halo)
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 24)
      g.addColorStop(0, 'rgba(255,220,160,1)')
      g.addColorStop(0.5, 'rgba(255,160,90,0.6)')
      g.addColorStop(1, 'rgba(255,120,60,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 128)
    }
    const spriteTex = new THREE.CanvasTexture(spriteCanvas)
    const spriteMat = new THREE.SpriteMaterial({
      map: spriteTex,
      color: 0xffb56b,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    })

    const sprites: THREE.Sprite[] = []
    for (let i = 0; i < cityPositions.length; i++) {
      const s = new THREE.Sprite(spriteMat.clone())
      s.scale.setScalar(0.1)
      group.add(s)
      sprites.push(s)
    }
    // eslint-disable-next-line no-console
    console.log('Dot glow restored - additive blending, opacity 0.9')

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
        spr.scale.setScalar(0.06 + intensity * 0.12)
        ;(spr.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.min(1, 0.4 + intensity * 0.6))
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
      controls.dispose()
      if (el.contains(zoomInBtn)) el.removeChild(zoomInBtn)
      if (el.contains(zoomOutBtn)) el.removeChild(zoomOutBtn)
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
