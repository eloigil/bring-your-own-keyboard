import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Key } from '../types'
import type { Family } from '../lib/units'
import { caseMesh, wallTopAt, type PocketFill } from '../lib/case'
import { plasticGrain } from './textures'

const LIGHT = new THREE.Color('#e4e2e8')

export function Case({ keys, family, fills, tilt, color }: { keys: Key[]; family: Family; fills: PocketFill[]; tilt: number; color: string }) {
  const geometry = useMemo(() => {
    const g = caseMesh(keys, family, fills, tilt)
    if (!g) return null
    // two-tone: the chosen colour on top, the walls a lighter tint of it
    const TOP = new THREE.Color(color)
    const BASE = TOP.clone().lerp(LIGHT, 0.6)
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
    // planar UVs (1 repeat per cm) so the plastic grain has somewhere to sit; walls get it slightly stretched
    const uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) uv.set([pos.getX(i) / 10, (pos.getZ(i) + pos.getY(i)) / 10], i * 2)
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    return g
  }, [keys, family, fills, tilt, color])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.5} metalness={0.05} bumpMap={plasticGrain()} bumpScale={0.35} />
    </mesh>
  )
}
