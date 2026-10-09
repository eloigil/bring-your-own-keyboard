import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Key } from '../types'
import { CUTOUT, PITCH, SWITCH_TRAVEL_HEIGHT, type Family } from '../lib/units'
import { rowShape, type Profile } from '../data/keycaps'
import { KEYCAP_MATERIALS } from '../data/materials'
import type { KeycapMaterial } from '../types'

const GAP = 1.2 // mm between neighbouring caps
const RED = new THREE.Color('#e5484d')
const ACCENT = new THREE.Color('#5b5bd6')

// Keycap and switch geometries are shared between keys with the same shape (a TKL needs only a handful).
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
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)
  const tint = (t: number) => {
    if (!mat.current) return
    const g = KEYCAP_MATERIALS[material].glass
    const c = mat.current.color.set(g && g.transmission >= 1 ? '#ffffff' : color) // fully clear caps carry their colour only as a tint
    if (selected) c.lerp(ACCENT, 0.35)
    if (invalid) c.lerp(RED, 0.45 + 0.35 * Math.sin(t * 5))
  }
  useEffect(() => (tint(0), invalidate()), [color, selected, invalid, material]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => void (mat.current && (mat.current.emissive = glow)), [glow, material])
  // only an invalid key keeps the frame loop running (for its pulse)
  useFrame(({ clock, invalidate }) => {
    if (!invalid) return
    tint(clock.elapsedTime)
    invalidate()
  })
  return (
    <>
      <mesh geometry={geometry} castShadow>
        {/* how much backlight the cap lets through depends on its plastic (see data/materials.ts) */}
        {m.glass ? (
          // frosted/clear: real transmission and refraction (polycarbonate ior). The cap colour only tints the light
          // travelling through it; reflections come from the scene environment, scaled up only on these caps
          <meshPhysicalMaterial
            ref={mat}
            color={m.glass.transmission < 1 ? color : '#ffffff'}
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
          <meshStandardMaterial ref={mat} color={color} roughness={m.roughness} emissiveIntensity={m.glow} />
        )}
      </mesh>
      <mesh geometry={sw.housing}>
        <meshStandardMaterial color={housingColor} roughness={0.6} />
      </mesh>
      <mesh geometry={sw.stem}>
        <meshStandardMaterial color={stemColor} roughness={0.5} />
      </mesh>
    </>
  )
}
