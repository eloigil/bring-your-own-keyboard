import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Key } from '../types'
import { CUTOUT, PITCH, SWITCH_TRAVEL_HEIGHT, type Family } from '../lib/units'
import { rowShape, type Profile } from '../data/keycaps'
import { KEYCAP_MATERIALS } from '../data/materials'
import type { KeycapMaterial } from '../types'
import { plasticGrain } from './textures'

const GAP = 1.2 // mm between neighbouring caps
const RED = new THREE.Color('#e5484d')
const ACCENT = new THREE.Color('#e8590c') // the UI accent: selection
/** mm a selected key or part rises out of the board: picked up, so it can't be missed. Its LED stays on the plate. */
export const LIFT = 9

// Keycap and switch geometries are shared between keys with the same shape (a TKL needs only a handful).
/**
 * A see-through cap's base colour also tints the light passing through it (three multiplies transmission by it),
 * so the clearer the plastic, the closer to white it stays — otherwise the colour is applied twice and goes murky.
 * Frosted (half transmission) keeps its full milky colour; clear only gets a touch of it.
 */
function bodyColor(color: string, material: KeycapMaterial) {
  const g = KEYCAP_MATERIALS[material].glass
  if (!g) return color
  return '#' + new THREE.Color('#ffffff').lerp(new THREE.Color(color), Math.min(1, (1 - g.transmission) * 2)).getHexString()
}

const capCache = new Map<string, THREE.BufferGeometry>()
function capGeometry(w: number, d: number, height: number, tilt: number, inset: number) {
  const key = [w, d, height, tilt, inset].map((v) => v.toFixed(2)).join()
  let g = capCache.get(key)
  if (!g) {
    g = new RoundedBoxGeometry(w, height, d, 3, 1.6)
    g.translate(0, height / 2, 0)
    // taper toward the top and tilt the top surface: the higher a vertex, the more it's inset and tilted
    const pos = g.attributes.position
    const tan = Math.tan((tilt * Math.PI) / 180)
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / height
      const x = pos.getX(i), z = pos.getZ(i)
      const sx = 1 - (2 * inset * t) / w, sz = 1 - (2 * inset * t) / d
      pos.setXYZ(i, x * sx, pos.getY(i) - z * sz * tan * t, z * sz)
    }
    g.computeVertexNormals()
    capCache.set(key, g)
  }
  return g
}

const legendCache = new Map<string, THREE.CanvasTexture>()
/** A key's legend, printed top-left like a real cap. Drawn once per legend, colour and cap proportion. */
function legendTexture(text: string, ink: string, aspect: number) {
  const key = [text, ink, aspect.toFixed(2)].join()
  let tex = legendCache.get(key)
  if (!tex) {
    const h = 128, w = Math.round(h * aspect)
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h })
    const g = canvas.getContext('2d')!
    g.fillStyle = ink
    g.textBaseline = 'top'
    g.font = `500 ${text.length > 2 ? 26 : 38}px "Geist Variable", system-ui, sans-serif`
    g.fillText(text, 16, 16)
    tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    legendCache.set(key, tex)
  }
  return tex
}

const switchCache = new Map<Family, { housing: THREE.BufferGeometry; stem: THREE.BufferGeometry; hh: number }>()
function switchGeometry(family: Family) {
  let s = switchCache.get(family)
  if (!s) {
    const travel = SWITCH_TRAVEL_HEIGHT[family]
    const hh = Math.min(4.5, travel - 1) // housing height above the plate
    const housing = new THREE.BoxGeometry(CUTOUT[family], hh, CUTOUT[family]).translate(0, -travel + hh / 2, 0)
    const stem = new THREE.BoxGeometry(4, travel - hh, 4).translate(0, -(travel - hh) / 2, 0)
    s = { housing, stem, hh }
    switchCache.set(family, s)
  }
  return s
}

/** A keycap on its switch, positioned by its parent at the keycap's bottom. Pulses red when invalid, tinted when selected. */
export function Keycap({ k, family, color, profile, row, stemColor, housingColor, material, invalid, selected, glow }: {
  k: Key; family: Family; color: string; profile: Profile; row: number; stemColor: string; housingColor: string
  material: KeycapMaterial
  invalid?: boolean; selected?: boolean
  /** The key's live LED colour (black when off), shared with its underglow. */
  glow: THREE.Color
}) {
  const p = PITCH[family]
  const m = KEYCAP_MATERIALS[material]
  const shape = rowShape(profile, row)
  // Choc switches take low-profile caps: same profile character at a bit over half the height
  const height = family === 'Choc' ? shape.height * 0.55 : shape.height, tilt = family === 'Choc' ? shape.tilt * 0.5 : shape.tilt
  const geometry = useMemo(() => capGeometry(k.w * p.x - GAP, k.h * p.y - GAP, height, tilt, profile.inset), [k.w, k.h, p.x, p.y, height, tilt, profile.inset])
  const sw = switchGeometry(family)
  // legend on the cap's top face: tapered by the profile's inset and tilted with it
  const top = [k.w * p.x - GAP - 2 * profile.inset - 1.5, k.h * p.y - GAP - 2 * profile.inset - 1.5]
  const ink = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55 ? '#2b2b30' : '#f4f4f6'
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)
  const tint = (t: number) => {
    if (!mat.current) return
    const c = mat.current.color.set(bodyColor(color, material))
    if (selected) c.lerp(ACCENT, 0.75)
    if (invalid) c.lerp(RED, 0.45 + 0.35 * Math.sin(t * 5))
  }
  useEffect(() => (tint(0), invalidate()), [color, selected, invalid, material]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => void (mat.current && (mat.current.emissive = glow)), [glow, material])
  const lift = useRef<THREE.Group>(null)
  useEffect(() => invalidate(), [selected, invalidate])
  // only an invalid key (its pulse) or a key rising / settling keeps the frame loop running
  useFrame(({ clock, invalidate }, dt) => {
    const g = lift.current
    if (g) {
      const to = selected ? LIFT : 0
      g.position.y = THREE.MathUtils.damp(g.position.y, to, 14, dt)
      if (Math.abs(g.position.y - to) > 0.01) invalidate()
      else g.position.y = to
    }
    if (!invalid) return
    tint(clock.elapsedTime)
    invalidate()
  })
  return (
    <group ref={lift}>
      <mesh geometry={geometry} castShadow>
        {/* how much backlight the cap lets through depends on its plastic (see data/materials.ts) */}
        {m.glass ? (
          // frosted/clear: real transmission and refraction (polycarbonate ior). The cap colour only tints the light
          // travelling through it; reflections come from the scene environment, scaled up only on these caps
          <meshPhysicalMaterial
            ref={mat}
            color={bodyColor(color, material)}
            transmission={m.glass.transmission}
            thickness={4}
            ior={1.58}
            roughness={m.roughness}
            clearcoat={m.glass.clearcoat}
            clearcoatRoughness={0.03}
            attenuationColor={color}
            attenuationDistance={m.glass.tintDistance}
            envMapIntensity={m.glass.reflections}
            emissiveIntensity={m.glow}
          />
        ) : (
          <meshStandardMaterial ref={mat} color={color} roughness={m.roughness} emissiveIntensity={m.glow} bumpMap={plasticGrain()} bumpScale={0.12} />
        )}
      </mesh>
      {k.legend && (
        <mesh position={[0, height + 0.02, 0]} rotation-x={-Math.PI / 2 + (tilt * Math.PI) / 180}>
          <planeGeometry args={[top[0], top[1]]} />
          <meshStandardMaterial map={legendTexture(k.legend, ink, top[0] / top[1])} transparent depthWrite={false} roughness={m.roughness} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
      <mesh geometry={sw.housing}>
        <meshStandardMaterial color={housingColor} roughness={0.6} />
      </mesh>
      <mesh geometry={sw.stem}>
        <meshStandardMaterial color={stemColor} roughness={0.5} />
      </mesh>
    </group>
  )
}
