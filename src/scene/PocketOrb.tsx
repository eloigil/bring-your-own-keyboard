import { useState } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import type * as THREE from 'three'
import { wallTopAt, type Pocket } from '../lib/case'
import type { Family } from '../lib/units'
import { useDesign } from '../store/design'
import { hitLocal } from './pointer'

const R = 3.5

/** A handle sitting at a pocket's fill line. Drag toward the edge to fill, inward to open the pocket. */
export function PocketOrb({ pocket, maxZ, family, offset, tilt }: { pocket: Pocket; maxZ: number; family: Family; offset: THREE.Vector3; tilt: number }) {
  const { mouth, dir, depth, t } = pocket
  const [hover, setHover] = useState(false)
  const [drag, setDrag] = useState(false)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  // the orb slides along the pocket's axis: at the mouth = flush (t=1), deepest point = open (t=0)
  const x = mouth[0] + dir[0] * depth * (1 - t), z = mouth[1] + dir[1] * depth * (1 - t)
  const y = wallTopAt(z, maxZ, family, tilt) + R + 1

  const update = (e: ThreeEvent<PointerEvent>) => {
    const hit = hitLocal(e, y, offset)
    if (!hit) return
    const along = (hit[0] - mouth[0]) * dir[0] + (hit[1] - mouth[1]) * dir[1]
    useDesign.getState().setPocketFill(mouth[0], mouth[1], Math.max(0, Math.min(1, 1 - along / depth)))
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
      <meshStandardMaterial color="#f4f4f5" emissive="#ffffff" emissiveIntensity={hover || drag ? 0.45 : 0.12} roughness={0.25} />
    </mesh>
  )
}
