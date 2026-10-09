import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'

/** Where a pointer ray hits the horizontal plane at `height`, in board-local mm (layout x, layout y). */
export function hitLocal(e: ThreeEvent<PointerEvent>, height: number, offset: THREE.Vector3): [number, number] | null {
  const hit = e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3())
  return hit ? [hit.x - offset.x, hit.z - offset.z] : null
}
