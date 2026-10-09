import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const RED = new THREE.Color('#e5484d')
const ACCENT = new THREE.Color('#5b5bd6')
const BASE = '#3a3940'
const R = 8.5 // mm, a typical encoder knob
const H = 16

/** A rotary encoder knob sitting on the plate, with a marker line on top. Pulses red when it overlaps a key. */
export function Knob({ invalid, selected }: { invalid?: boolean; selected?: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)
  const tint = (t: number) => {
    if (!mat.current) return
    const c = mat.current.color.set(BASE)
    if (selected) c.lerp(ACCENT, 0.4)
    if (invalid) c.lerp(RED, 0.45 + 0.35 * Math.sin(t * 5))
  }
  useEffect(() => (tint(0), invalidate()), [selected, invalid]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock, invalidate }) => {
    if (!invalid) return
    tint(clock.elapsedTime)
    invalidate()
  })
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow>
        <cylinderGeometry args={[R, R, H, 48]} />
        <meshStandardMaterial ref={mat} color={BASE} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, H + 0.05, -R / 2]}>
        <boxGeometry args={[1.2, 0.2, R * 0.8]} />
        <meshStandardMaterial color="#f4f2ec" />
      </mesh>
    </group>
  )
}
