import { useEffect, useMemo } from 'react'
import type { Key } from '../types'
import type { Family } from '../lib/units'
import { caseMesh, type PocketFill } from '../lib/case'

export function Case({ keys, family, fills }: { keys: Key[]; family: Family; fills: PocketFill[] }) {
  const geometry = useMemo(() => caseMesh(keys, family, fills), [keys, family, fills])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#d9d6de" roughness={0.55} metalness={0.05} />
    </mesh>
  )
}
