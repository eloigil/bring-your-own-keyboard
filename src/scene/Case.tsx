import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Design, Key } from '../types'
import type { Family } from '../lib/units'
import { caseAssembly, wallTopAt, type CaseController, type PocketFill } from '../lib/case'
import { plasticGrain } from './textures'

const LIGHT = new THREE.Color('#e4e2e8')

/** The colour each case part shows: top as chosen; walls, plate and bottom as chosen or a lighter tint of the top. */
export function caseColors(board: Design['board']) {
  const tint = '#' + new THREE.Color(board.caseColor).lerp(LIGHT, 0.6).getHexString()
  return { top: board.caseColor, wall: board.wallColor ?? tint, plate: board.plateColor ?? tint, bottom: board.bottomColor ?? tint }
}

/** Planar UVs (1 repeat per cm) so the plastic grain has somewhere to sit; walls get it slightly stretched. */
function grainUVs(g: THREE.BufferGeometry) {
  const pos = g.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) uv.set([pos.getX(i) / 10, (pos.getZ(i) + pos.getY(i)) / 10], i * 2)
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

export function Case({ keys, family, fills, tilt, colors, controller }: { keys: Key[]; family: Family; fills: PocketFill[]; tilt: number; colors: ReturnType<typeof caseColors>; controller?: CaseController }) {
  const parts = useMemo(() => {
    const a = caseAssembly(keys, family, fills, tilt, controller)
    if (!a) return null
    // the shell is two-tone: up-facing triangles at top-face height take the top colour, the rest are walls
    const g = a.shell
    g.computeBoundingBox()
    const maxZ = g.boundingBox!.max.z
    const pos = g.attributes.position, nrm = g.attributes.normal
    const isTop = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i += 3) {
      let top = 1
      for (let j = i; j < i + 3; j++) if (nrm.getY(j) < 0.7 || wallTopAt(pos.getZ(j), maxZ, family, tilt) - pos.getY(j) > 1.5) top = 0
      isTop.fill(top, i, i + 3)
    }
    g.userData.isTop = isTop
    for (const part of [a.shell, a.plate, a.bottom]) grainUVs(part)
    return a
  }, [keys, family, fills, tilt, controller])

  // recolouring doesn't rebuild the geometry
  useMemo(() => {
    if (!parts) return
    const g = parts.shell, isTop = g.userData.isTop as Float32Array
    const top = new THREE.Color(colors.top), wall = new THREE.Color(colors.wall)
    const out = new Float32Array(isTop.length * 3)
    for (let i = 0; i < isTop.length; i++) {
      const c = isTop[i] ? top : wall
      out.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(out, 3))
  }, [parts, colors.top, colors.wall])

  useEffect(() => () => void (parts && Object.values(parts).forEach((g) => g.dispose())), [parts])
  if (!parts) return null
  const grain = plasticGrain()
  return (
    <group>
      <mesh geometry={parts.shell} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.05} bumpMap={grain} bumpScale={0.35} />
      </mesh>
      <mesh geometry={parts.plate} receiveShadow>
        <meshStandardMaterial color={colors.plate} roughness={0.45} metalness={0.1} bumpMap={grain} bumpScale={0.2} />
      </mesh>
      <mesh geometry={parts.bottom} castShadow receiveShadow>
        <meshStandardMaterial color={colors.bottom} roughness={0.5} metalness={0.05} bumpMap={grain} bumpScale={0.35} />
      </mesh>
    </group>
  )
}
