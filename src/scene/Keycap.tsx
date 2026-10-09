import { RoundedBox } from '@react-three/drei'
import type { Key } from '../types'
import { PITCH, type Family } from '../lib/units'

const CAP_H = 8
const GAP = 1.2 // mm between neighbouring caps

/** A keycap, positioned by its parent. Simple rounded shape for now; profiles come later. */
export function Keycap({ k, family, color }: { k: Key; family: Family; color: string }) {
  const p = PITCH[family]
  return (
    <RoundedBox args={[k.w * p.x - GAP, CAP_H, k.h * p.y - GAP]} radius={1.6} smoothness={3} position={[0, CAP_H / 2, 0]} castShadow>
      <meshStandardMaterial color={color} roughness={0.7} />
    </RoundedBox>
  )
}
