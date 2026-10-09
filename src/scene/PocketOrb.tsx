import { useState } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import type * as THREE from 'three'
import { wallTopAt, type Pocket } from '../lib/case'
import type { Family } from '../lib/units'
import { useDesign } from '../store/design'
import { hitLocal } from './pointer'

const R = 3.5

/** A handle sitting at a pocket's fill line. Drag toward the edge to fill, inward to open the pocket. */
export function PocketOrb({ pocket, maxZ, family, offset }: { pocket: Pocket; maxZ: number; family: Family; offset: THREE.Vector3 }) {
  const { mouth, dir, depth, d } = pocket
  const [hover, setHover] = useState(false)
  const [drag, setDrag] = useState(false)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  // the fill grows from the keys outward, so the case edge (and the orb) sits `depth - d` in from the mouth
  const x = mouth[0] + dir[0] * (depth - d), z = mouth[1] + dir[1] * (depth - d)
  const y = wallTopAt(z, maxZ, family) + R + 1

  const update = (e: ThreeEvent<PointerEvent>) => {
    const hit = hitLocal(e, y, offset)
    if (!hit) return
    const along = (hit[0] - mouth[0]) * dir[0] + (hit[1] - mouth[1]) * dir[1]
    useDesign.getState().setPocketFill(mouth[0], mouth[1], Math.max(0, Math.min(depth, depth - along)))
  }

  return (
    <mesh
      position={[x, y, z]}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
      onPointerDown={(e) => {
        e.stopPropagation()
        ;(e.target as Element).setPointerCapture(e.pointerId)
        if (controls) controls.enabled = false
        setDrag(true)
      }}
      onPointerMove={(e) => drag && update(e)}
      onPointerUp={(e) => {
        ;(e.target as Element).releasePointerCapture(e.pointerId)
        if (controls) controls.enabled = true
        setDrag(false)
      }}
      scale={hover || drag ? 1.3 : 1}
    >
      <sphereGeometry args={[R, 24, 16]} />
      <meshStandardMaterial color="#5b5bd6" emissive="#5b5bd6" emissiveIntensity={hover || drag ? 0.6 : 0.25} roughness={0.3} />
    </mesh>
  )
}
