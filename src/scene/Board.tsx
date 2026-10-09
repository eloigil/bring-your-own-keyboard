import { useMemo } from 'react'
import type { Key } from '../types'
import { PITCH, SWITCH_TRAVEL_HEIGHT, CASE_HEIGHT, type Family } from '../lib/units'
import { caseOutline, plateTopAt, TILT_DEG } from '../lib/case'
import { Case } from './Case'
import { Keycap } from './Keycap'

/** Plate slope: the plate tilts a little less than the wall top because it sits lower. */
function plateTilt(family: Family) {
  const H = CASE_HEIGHT[family]
  return Math.atan(((H - 2.5) / H) * Math.tan((TILT_DEG * Math.PI) / 180))
}

/** The keyboard: case + keycaps, centered on the origin. */
export function Board({ keys, family }: { keys: Key[]; family: Family }) {
  const p = PITCH[family]
  const { cx, cz, maxZ } = useMemo(() => {
    const pts = caseOutline(keys, family).flat()
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1])
    const maxZ = Math.max(...zs)
    return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cz: (Math.min(...zs) + maxZ) / 2, maxZ }
  }, [keys, family])
  const tilt = plateTilt(family)

  return (
    <group position={[-cx, 0, -cz]}>
      <Case keys={keys} family={family} />
      {keys.map((k) => {
        const x = (k.x + k.w / 2) * p.x
        const z = (k.y + k.h / 2) * p.y
        const y = plateTopAt(z, maxZ, family) + SWITCH_TRAVEL_HEIGHT[family]
        return (
          <group key={k.id} position={[x, y, z]} rotation={[tilt, (-k.rot * Math.PI) / 180, 0]}>
            <Keycap k={k} family={family} color={k.w > 1 ? '#a9adb6' : '#f4f2ec'} />
          </group>
        )
      })}
    </group>
  )
}
