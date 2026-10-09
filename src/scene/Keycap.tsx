import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { Key } from '../types'
import { PITCH, type Family } from '../lib/units'

const CAP_H = 8
const GAP = 1.2 // mm between neighbouring caps
const RED = new THREE.Color('#e5484d')
const ACCENT = new THREE.Color('#5b5bd6')

/** A keycap, positioned by its parent. Pulses red when invalid, tinted when selected. */
export function Keycap({ k, family, color, invalid, selected }: { k: Key; family: Family; color: string; invalid?: boolean; selected?: boolean }) {
  const p = PITCH[family]
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const base = new THREE.Color(color)
  useFrame(({ clock }) => {
    if (!mat.current) return
    const c = mat.current.color.copy(base)
    if (selected) c.lerp(ACCENT, 0.35)
    if (invalid) c.lerp(RED, 0.45 + 0.35 * Math.sin(clock.elapsedTime * 5))
  })
  return (
    <RoundedBox args={[k.w * p.x - GAP, CAP_H, k.h * p.y - GAP]} radius={1.6} smoothness={3} position={[0, CAP_H / 2, 0]} castShadow>
      <meshStandardMaterial ref={mat} color={color} roughness={0.7} />
    </RoundedBox>
  )
}
