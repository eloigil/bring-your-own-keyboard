import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import type { Design } from '../types'
import { caseMesh } from './case'
import { familyOf } from './catalog'
import { componentFootprint } from './layout'

/**
 * The case as a binary STL in millimetres, the same mesh the 3D view shows (shape, pockets, tilt,
 * switch and knob cutouts). Rotated so +Z is up and the front faces -Y, how slicers expect a part.
 */
export function caseStl(design: Design): ArrayBuffer | null {
  const footprints = [...design.keys, ...design.components.map(componentFootprint)]
  const geometry = caseMesh(footprints, familyOf(design.board.switchId), design.pocketFills, design.board.tiltDeg)
  if (!geometry) return null
  geometry.rotateX(Math.PI / 2) // world Y-up → Z-up
  const result = new STLExporter().parse(new THREE.Mesh(geometry), { binary: true }) as DataView
  geometry.dispose()
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer
}

/** Hand the browser a file to save. */
export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
