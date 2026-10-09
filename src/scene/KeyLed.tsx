import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LedEffect } from '../types'

const OFF = new THREE.Color('#000000')
const HALO = 5 // mm the glow reaches past the key on each axis

/**
 * Per-key underglow, drawn as a bright plate under the keycap so it shows in the gaps.
 * Painted colour wins; otherwise the effect drives it. Only an active effect keeps the frame loop running.
 */
export function KeyLed({ w, d, y, painted, effect, effectColor, phase, hot, glow }: {
  w: number; d: number; y: number; painted?: string; effect: LedEffect; effectColor: string; phase: number; hot: React.RefObject<number>
  /** Shared with the keycap, which uses it as its emissive colour so the light shines through the cap. */
  glow: THREE.Color
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)
  const lit = !!painted || effect !== 'none'
  const colorAt = (t: number, out: THREE.Color) => {
    if (painted) return out.set(painted)
    switch (effect) {
      case 'breathing':
        return out.set(effectColor).multiplyScalar(0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 2)))
      case 'wave':
        return out.setHSL((phase * 0.04 - t * 0.25) % 1 + 1, 0.9, 0.55)
      case 'reactive': {
        const age = t - (hot.current ?? -99) // seconds since the pointer passed over this key
        return age < 0.8 ? out.set(effectColor).multiplyScalar(1 - age / 0.8) : out.copy(OFF)
      }
      default:
        return out.copy(OFF)
    }
  }
  useEffect(() => {
    colorAt(0, glow)
    if (!lit) glow.copy(OFF)
    mat.current?.color.copy(glow)
    invalidate()
  }, [painted, effect, effectColor]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock, invalidate }) => {
    if (!mat.current || painted || effect === 'none') return
    colorAt(clock.elapsedTime, glow)
    mat.current.color.copy(glow)
    if (effect !== 'reactive' || clock.elapsedTime - (hot.current ?? -99) < 0.8) invalidate()
  })
  if (!lit) return null
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w + HALO, d + HALO]} />
      {/* additive: neighbouring glows add up, so the light spills into the gaps like real underglow */}
      <meshBasicMaterial ref={mat} toneMapped={false} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}
