import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei'
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { N8AOPostPass } from 'n8ao'
import { useDesign } from '../store/design'
import { sky } from './sky'

/** Studio: backdrop, sun / moon lighting, contact shadow, scale grid. No remote HDR, works offline. */
export function Stage({ children, onPointerMissed }: { children: ReactNode; onPointerMissed?: () => void }) {
  return (
    // frameloop="demand": draw only when something changes (orbit, drag, animation) — idle costs nothing
    <Canvas
      shadows
      frameloop="demand"
      onCreated={({ gl }) => {
        gl.transmissionResolutionScale = 0.5 // see-through keycaps: the blurred view behind them doesn't need full resolution
        gl.shadowMap.autoUpdate = false // shadows are refreshed only when the board's shape changes (see Shadows)
      }}
      onPointerMissed={onPointerMissed} camera={{ position: [0, 380, 440], fov: 35, near: 1, far: 5000 }} dpr={[1, 1.5]}>
      <Sky />
      <StudioEnvironment />
      {children}
      {/* scale reference: 1 cm cells, 10 cm sections, fading out in a circle around the board (fadeFrom 0 = from the origin).
          Its colours are driven by Sky. */}
      <Grid
        name="floor-grid"
        position={[0, -0.1, 0]}
        args={[1200, 1200]}
        cellSize={10}
        cellThickness={0.8}
        sectionSize={100}
        sectionThickness={1.4}
        fadeDistance={330}
        fadeStrength={1.3}
        fadeFrom={0}
      />
      <Shadows />
      <Effects />
      <OrbitControls enableDamping makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={120} maxDistance={900} />
    </Canvas>
  )
}

/**
 * Post-processing: ambient occlusion so keys sit in their sockets and the case has weight in its corners,
 * bloom so the LEDs actually glow, and filmic tone mapping. The AO runs at half resolution and only on
 * frames that render anyway (demand frameloop).
 */
function Effects() {
  const { scene, camera, size } = useThree()
  const ao = useMemo(() => {
    const pass = new N8AOPostPass(scene, camera, size.width, size.height)
    const c = pass.configuration
    c.aoRadius = 9 // mm: about half a keycap, so the gaps between keys and the well's walls darken, not whole rows
    c.distanceFalloff = 3
    c.intensity = 2.2
    c.halfRes = true
    c.screenSpaceRadius = false
    pass.setQualityMode('Low')
    return pass
  }, [scene, camera]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <EffectComposer multisampling={4}>
      <primitive object={ao} />
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.9} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

/** Soft studio reflections, built from shapes (no HDR download). Memoised so re-renders don't reset the intensity Sky animates. */
const StudioEnvironment = memo(() => (
  <Environment resolution={128} environmentIntensity={0.12}>
    <Lightformer form="rect" intensity={3} position={[0, 400, 0]} rotation-x={Math.PI / 2} scale={[600, 300, 1]} />
    <Lightformer form="rect" intensity={1.5} position={[-500, 150, 200]} rotation-y={Math.PI / 2} scale={[400, 120, 1]} />
    <Lightformer form="rect" intensity={1} position={[500, 100, -200]} rotation-y={-Math.PI / 2} scale={[300, 100, 1]} />
  </Environment>
))

const c = (hex: string) => new THREE.Color(hex)
/** Colour at `t` (0–1) along evenly spaced stops. */
function ramp(stops: THREE.Color[], t: number, out: THREE.Color) {
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1)
  const i = Math.min(Math.floor(x), stops.length - 2)
  return out.copy(stops[i]).lerp(stops[i + 1], x - i)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const band = (a: number, b: number, t: number) => smooth(Math.min(Math.max((t - a) / (b - a), 0), 1))

// day → golden hour → dusk → night
const BG = [c('#e9e8ec'), c('#efd2bd'), c('#c98a7a'), c('#3a2c45'), c('#0f0e13')]
const SKY = [c('#ffffff'), c('#ffe2c4'), c('#ffb08a'), c('#7c7fb8'), c('#6d7fc0')]
const SUN = [c('#ffffff'), c('#fff1dc'), c('#ffb066'), c('#ff7a3d'), c('#ff7a3d')]
const CELL = [c('#bdb7c8'), c('#d0b6a6'), c('#a8786e'), c('#3b3048'), c('#24222c')]
const SECTION = [c('#b8b2c5'), c('#c9ab99'), c('#9e6c62'), c('#43374f'), c('#2e2b38')]
const SECONDS = 3

/**
 * Light ↔ dark as a sunset / sunrise: the sun travels one continuous arc — overhead at noon, down to the west as it
 * sets (warming to orange, shadows stretching), and back up from the east when the lights come on again — so it
 * never jumps between the two. The room goes through golden hour and dusk, the backlight flickers on as the sun
 * drops below the horizon, then a cool moonlight takes over. `night` runs 0 (noon) → 1 (night) and only animates
 * while it moves — idle frames stay free.
 */
function Sky() {
  const dark = useDesign((s) => s.dark)
  const { scene, gl, invalidate } = useThree()
  const sun = useRef<THREE.DirectionalLight>(null!)
  const moon = useRef<THREE.DirectionalLight>(null!)
  const fill = useRef<THREE.DirectionalLight>(null!)
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const night = useRef(dark ? 1 : 0)
  const side = useRef(1) // 1: towards the west (setting), -1: from the east (rising)
  const bg = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    side.current = dark ? 1 : -1
    invalidate()
  }, [dark, invalidate])

  useFrame((_, delta) => {
    const target = dark ? 1 : 0
    const moving = night.current !== target
    if (moving) {
      const step = Math.min(delta, 0.1) / SECONDS
      night.current = target > night.current ? Math.min(target, night.current + step) : Math.max(target, night.current - step)
      gl.shadowMap.needsUpdate = true // the sun moves, so its shadows do too
      invalidate()
    }
    const t = smooth(night.current)

    // the sun's arc: straight up at noon, 8° below the west horizon by t = 0.8 (or the mirror, rising from the east)
    const a = Math.PI / 2 + side.current * (Math.PI / 2 + THREE.MathUtils.degToRad(8)) * Math.min(t / 0.8, 1)
    sun.current.position.set(340 * Math.cos(a), 340 * Math.sin(a), 220)
    sun.current.intensity = 2.2 * Math.max(0, Math.sin(a)) ** 0.6
    // the backlight powers on just as the sun disappears: two quick blinks, then steady
    const u = (t - 0.74) / 0.16
    sky.led = dark && u > 0 && u < 1 ? (u < 0.22 ? 0.1 : u < 0.4 ? 1 : u < 0.52 ? 0.25 : 1) : 1
    ramp(SUN, t, sun.current.color)
    moon.current.intensity = 0.3 * band(0.6, 1, t)
    fill.current.intensity = lerp(0.6, 0.08, t)
    hemi.current.intensity = lerp(1.4, 0.12, band(0, 0.85, t))
    ramp(SKY, t, hemi.current.color)
    scene.background = ramp(BG, t, bg)
    scene.environmentIntensity = lerp(0.12, 0.04, t)
    const grid = scene.getObjectByName('floor-grid') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | undefined
    if (grid) {
      ramp(CELL, t, grid.material.uniforms.cellColor.value)
      ramp(SECTION, t, grid.material.uniforms.sectionColor.value)
    }
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#c9c6cf', 1.4]} />
      <directionalLight ref={sun} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-300, 300, 300, -300, 1, 1000]} />
      </directionalLight>
      <directionalLight ref={moon} position={[120, 300, 160]} color="#a9bcff" intensity={0} />
      <directionalLight ref={fill} position={[200, 120, -150]} intensity={0.6} />
    </>
  )
}

/**
 * Shadows only depend on the board's shape, not on LED colours or the camera. So instead of re-rendering the
 * shadow map and the contact shadow on every frame (4 scene renders per frame during an LED effect), refresh
 * them while the shape is changing (keys glide for ~0.6 s) and once more when it settles.
 */
function Shadows() {
  const opacity = useDesign((s) => (s.dark ? 0.6 : 0.35))
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const until = useRef(performance.now() + 600)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const changed = () => {
      until.current = performance.now() + 600
      invalidate()
      clearTimeout(timer)
      timer = setTimeout(() => setVersion((v) => v + 1), 650) // re-render the contact shadow once it has settled
    }
    changed()
    // shape-affecting parts of the design only
    const unsub = useDesign.subscribe((s, prev) => {
      const a = s.design, b = prev.design
      if (a.keys !== b.keys || a.components !== b.components || a.pocketFills !== b.pocketFills || a.board.tiltDeg !== b.board.tiltDeg || a.board.switchId !== b.board.switchId || a.board.profileId !== b.board.profileId || a.board.keycapMaterial !== b.board.keycapMaterial) changed()
    })
    return () => (unsub(), clearTimeout(timer))
  }, [invalidate])
  useFrame(() => {
    if (performance.now() < until.current) gl.shadowMap.needsUpdate = true
  })
  return <ContactShadows key={version} frames={1} position={[0, -0.2, 0]} scale={700} blur={2.6} opacity={opacity} far={60} resolution={1024} />
}
