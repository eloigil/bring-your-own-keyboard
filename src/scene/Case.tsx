import { useEffect, useMemo } from 'react'
import type { Key } from '../types'
import type { Family } from '../lib/units'
import { caseMesh } from '../lib/case'

export function Case({ keys, family }: { keys: Key[]; family: Family }) {
  const geometry = useMemo(() => caseMesh(keys, family), [keys, family])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#d9d6de" roughness={0.55} metalness={0.05} />
    </mesh>
  )
}
