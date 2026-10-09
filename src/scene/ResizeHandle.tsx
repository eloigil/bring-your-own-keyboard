import { useState } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import type * as THREE from 'three'
import { useDesign } from '../store/design'
import { hitLocal } from './pointer'

/** A grip on the board's right edge: drag it to make the board wider or narrower. */
export function ResizeHandle({ x, y, z, minXmm, pitch, offset, onDragging }: {
  x: number; y: number; z: number; minXmm: number; pitch: number; offset: THREE.Vector3; onDragging: (on: boolean) => void
}) {
  const [hover, setHover] = useState(false)
  const [drag, setDrag] = useState(false)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const set = (on: boolean) => {
    setDrag(on)
    onDragging(on)
    if (controls) controls.enabled = !on
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!drag) return
    const hit = hitLocal(e, y, offset)
    if (hit) useDesign.getState().resizeTo((hit[0] - minXmm) / pitch)
  }
  return (
    <mesh
      position={[x, y, z]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={hover || drag ? 1.2 : 1}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
      onPointerDown={(e) => {
        e.stopPropagation()
        ;(e.target as Element).setPointerCapture(e.pointerId)
        set(true)
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        ;(e.target as Element).releasePointerCapture(e.pointerId)
        set(false)
      }}
    >
      <capsuleGeometry args={[3.5, 22, 6, 16]} />
      <meshStandardMaterial color="#5b5bd6" emissive="#5b5bd6" emissiveIntensity={hover || drag ? 0.6 : 0.25} roughness={0.3} />
    </mesh>
  )
}
