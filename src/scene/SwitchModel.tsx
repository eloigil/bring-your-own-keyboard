import { useMemo } from 'react'
import * as THREE from 'three'
import type { Switch } from '../lib/catalog'

/** A coil spring along +Y from 0 to `length`, radius `r`. Built once per switch family and scaled when compressed. */
function springGeometry(r: number, length: number, turns: number, wire: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= turns * 32; i++) {
    const t = i / 32
    pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 2) * r, (t / turns) * length, Math.sin(t * Math.PI * 2) * r))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 32, wire, 6, false)
}

/** A square frustum (housing top): `bottom`/`top` are side lengths. */
function frustum(bottom: number, top: number, h: number) {
  const g = new THREE.CylinderGeometry(top / Math.SQRT2, bottom / Math.SQRT2, h, 4, 1)
  g.rotateY(Math.PI / 4)
  return g
}

// Rough real dimensions (mm), origin at the plate's top surface.
const MX = { bottomH: 5, topH: 6.6, side: 15.6, topSide: 11, stemAbove: 3.6, springR: 2.4, springL: 9, springTurns: 9 }
const CHOC = { bottomH: 2.2, topH: 3, side: 15, topSide: 12.5, stemAbove: 2.4, springR: 2, springL: 4.5, springTurns: 5 }

/**
 * A detailed switch: housings (see-through when the switch has clear housings or `xray` is on), stem, spring and pins.
 * `press` is how far the stem is pushed down, in mm.
 */
export function SwitchModel({ s, press, xray }: { s: Switch; press: number; xray: boolean }) {
  const d = s.family === 'Choc' ? CHOC : MX
  const spring = useMemo(() => springGeometry(d.springR, d.springL, d.springTurns, 0.22), [d])
  const top = useMemo(() => frustum(d.side, d.topSide, d.topH), [d])
  const see = xray || s.housing.tint === 'clear'
  const topOpacity = see ? 0.28 : s.housing.tint === 'smoke' ? 0.85 : 1
  const springBase = -d.bottomH + 0.6
  const springTop = d.topH * 0.55 // where the stem's underside sits at rest
  const springScale = (springTop - press - springBase) / d.springL

  return (
    <group>
      {/* bottom housing, sitting below the plate */}
      <mesh position={[0, -d.bottomH / 2, 0]}>
        <boxGeometry args={[d.side - 1, d.bottomH, d.side - 1]} />
        <meshStandardMaterial color={s.housing.bottom} roughness={0.5} transparent={see} opacity={see ? 0.35 : 1} depthWrite={!see} />
      </mesh>
      {/* top housing */}
      <mesh geometry={top} position={[0, d.topH / 2, 0]}>
        <meshStandardMaterial color={s.housing.top} roughness={0.25} transparent={topOpacity < 1} opacity={topOpacity} depthWrite={topOpacity >= 1} />
      </mesh>
      {/* spring, compressed as the stem goes down */}
      <mesh geometry={spring} position={[0, springBase, 0]} scale={[1, Math.max(0.15, springScale), 1]}>
        <meshStandardMaterial color={s.materials.spring.toLowerCase().includes('gold') ? '#d4a64a' : '#c9cdd4'} metalness={0.9} roughness={0.25} />
      </mesh>
      {/* stem: body inside the housing + the part that holds the keycap */}
      <group position={[0, -press, 0]}>
        <mesh position={[0, springTop + 1.2, 0]}>
          <boxGeometry args={[s.family === 'Choc' ? 9 : 7, 2.4, s.family === 'Choc' ? 4 : 5]} />
          <meshStandardMaterial color={s.stemColor} roughness={0.45} />
        </mesh>
        {s.family === 'Choc' ? (
          // Choc: two rails instead of a cross
          [-2.85, 2.85].map((x) => (
            <mesh key={x} position={[x, d.topH + d.stemAbove / 2, 0]}>
              <boxGeometry args={[1.2, d.stemAbove + 1, 3]} />
              <meshStandardMaterial color={s.stemColor} roughness={0.45} />
            </mesh>
          ))
        ) : (
          <>
            <mesh position={[0, d.topH + d.stemAbove / 2 - 0.5, 0]}>
              <boxGeometry args={[4, d.stemAbove + 1, 1.3]} />
              <meshStandardMaterial color={s.stemColor} roughness={0.45} />
            </mesh>
            <mesh position={[0, d.topH + d.stemAbove / 2 - 0.5, 0]}>
              <boxGeometry args={[1.3, d.stemAbove + 1, 4]} />
              <meshStandardMaterial color={s.stemColor} roughness={0.45} />
            </mesh>
          </>
        )}
      </group>
      {/* pins: two metal contacts and the plastic centre post */}
      {[[-3.81, 2.54], [2.54, 5.08]].map(([x, z]) => (
        <mesh key={x} position={[x, -d.bottomH - 1.6, -z + 2.5]}>
          <cylinderGeometry args={[0.5, 0.5, 3.3, 10]} />
          <meshStandardMaterial color="#c9a14a" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, -d.bottomH - 1.5, 0]}>
        <cylinderGeometry args={[1.9, 1.9, 3, 20]} />
        <meshStandardMaterial color={s.housing.bottom} roughness={0.5} />
      </mesh>
    </group>
  )
}
