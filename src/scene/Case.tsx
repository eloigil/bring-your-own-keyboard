import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Key } from '../types'
import type { Family } from '../lib/units'
import { caseMesh, wallTopAt, type PocketFill } from '../lib/case'

const BASE = new THREE.Color('#d9d6de')
const TOP = new THREE.Color('#ff8a1f')

export function Case({ keys, family, fills, tilt }: { keys: Key[]; family: Family; fills: PocketFill[]; tilt: number }) {
  const geometry = useMemo(() => {
    const g = caseMesh(keys, family, fills, tilt)
    if (!g) return null
    // paint the upper face: up-facing triangles at top-face height (not the recessed plate)
    g.computeBoundingBox()
    const maxZ = g.boundingBox!.max.z
    const pos = g.attributes.position, nrm = g.attributes.normal
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i += 3) {
      let top = true
      for (let j = i; j < i + 3; j++) if (nrm.getY(j) < 0.7 || wallTopAt(pos.getZ(j), maxZ, family, tilt) - pos.getY(j) > 1.5) top = false
      const c = top ? TOP : BASE
      for (let j = i; j < i + 3; j++) colors.set([c.r, c.g, c.b], j * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [keys, family, fills, tilt])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.55} metalness={0.05} />
    </mesh>
  )
}
