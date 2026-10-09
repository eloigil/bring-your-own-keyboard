import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Switch } from '../lib/catalog'

/** A coil spring along +Y from 0 to `length`, radius `r`. Scaled on Y when compressed. */
function springGeometry(r: number, length: number, turns: number, wire: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= turns * 32; i++) {
    const t = i / 32
    pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 2) * r, (t / turns) * length, Math.sin(t * Math.PI * 2) * r))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 32, wire, 6, false)
}

/** Open-ended square frustum from y=0 to y=h: `bottom`/`top` are side lengths. */
function frustum(bottom: number, top: number, h: number) {
  const g = new THREE.CylinderGeometry(top / Math.SQRT2, bottom / Math.SQRT2, h, 4, 1, true)
  g.rotateY(Math.PI / 4)
  g.translate(0, h / 2, 0)
  return g
}

/** A flat square slab (side `outer`) with a centred rectangular hole, from y=0 to y=depth. */
function holedSlab(outer: number, hole: [number, number], depth: number) {
  const o = outer / 2, [hx, hz] = [hole[0] / 2, hole[1] / 2]
  const shape = new THREE.Shape([new THREE.Vector2(-o, -o), new THREE.Vector2(o, -o), new THREE.Vector2(o, o), new THREE.Vector2(-o, o)])
  shape.holes.push(new THREE.Path([new THREE.Vector2(-hx, -hz), new THREE.Vector2(-hx, hz), new THREE.Vector2(hx, hz), new THREE.Vector2(hx, -hz)]))
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  return g
}

type Style = 'mx' | 'box' | 'choc'
const styleOf = (s: Switch): Style => (s.family === 'Choc' ? 'choc' : s.id.includes('-box-') ? 'box' : 'mx')

// Rough real dimensions (mm), origin at the plate's top surface, +z towards the viewer (LED side).
// col = the stem column that slides through the top housing; mount = what holds the keycap (cross or rails).
const MX = {
  plate: 1.5, plateSide: 19.05, bottomH: 5, bottomSide: 14, flange: 15.6, flangeH: 0.8, topSide: 11.6, topH: 6.6,
  hole: [6.4, 6.4] as [number, number], col: [5.6, 5.6], colY: 2.6, colTop: 7.2, mount: 3.6,
  springR: 2.4, turns: 9, pins: [[-3.81, -2.54], [2.54, -5.08]], pinL: 3.3, post: 4, sidePost: 1.7, sideX: 5.08,
}
const CHOC = {
  plate: 1.2, plateSide: 18, bottomH: 2.2, bottomSide: 13.8, flange: 15, flangeH: 0.8, topSide: 12.6, topH: 3,
  hole: [10.6, 4.6] as [number, number], col: [10, 4], colY: 1.7, colTop: 3.4, mount: 3,
  springR: 1.8, turns: 5, pins: [[0, -5.9], [5, -3.8]], pinL: 3, post: 3.4, sidePost: 1.9, sideX: 5.5,
}
const FIVE_PIN = ['Gateron', 'Akko', 'Durock', 'Zeal', 'Drop']
const METAL = { gold: '#c9a14a', steel: '#c9cdd4', copper: '#c27a4a' }

/**
 * A switch built from its construction: MX-style (cross stem), Kailh Box (cross inside a box) or Kailh Choc
 * (low profile, twin-rail stem). Linear, tactile (bumped legs) and clicky (click jacket or click bar) internals differ,
 * silent switches get dampers, 5-pin switches get the extra posts. `press` is how far the stem is pushed down, in mm.
 */
export function SwitchModel({ s, press, xray }: { s: Switch; press: number; xray: boolean }) {
  const style = styleOf(s)
  const d = style === 'choc' ? CHOC : MX
  const see = xray || s.housing.tint === 'clear'
  const topOpacity = see ? 0.28 : s.housing.tint === 'smoke' ? 0.85 : 1

  const geo = useMemo(() => {
    const springBase = -d.bottomH + 0.5
    return {
      springBase,
      spring: springGeometry(d.springR, d.colY - springBase, d.turns, 0.22),
      plate: holedSlab(d.plateSide, [14, 14], d.plate),
      flange: holedSlab(d.flange, [d.flange - 2, d.flange - 2], d.flangeH),
      body: frustum(d.flange - 0.6, d.topSide, d.topH - d.flangeH),
      roof: holedSlab(d.topSide, d.hole, 0.8),
    }
  }, [d])

  const mat = useMemo(() => {
    const m = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o })
    const glassy = (color: string, opacity: number) => m(color, { roughness: 0.25, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide })
    return {
      top: glassy(s.housing.top, topOpacity),
      bottom: glassy(s.housing.bottom, see ? 0.35 : 1),
      stem: m(s.stemColor),
      plate: m('#9aa0a8', { metalness: 0.6, roughness: 0.4, transparent: xray, opacity: xray ? 0.25 : 1, depthWrite: !xray }),
      gold: m(METAL.gold, { metalness: 0.9, roughness: 0.3 }),
      steel: m(s.materials.spring.toLowerCase().includes('gold') ? '#d4a64a' : METAL.steel, { metalness: 0.9, roughness: 0.25 }),
      copper: m(METAL.copper, { metalness: 0.8, roughness: 0.35 }),
      jacket: m('#f4f4f2'),
      damper: m('#3a3a40', { roughness: 0.9 }),
      led: m('#111', { transparent: true, opacity: 0.55 }),
    }
  }, [s, see, topOpacity, xray])
  useEffect(() => () => Object.values(mat).forEach((m) => m.dispose()), [mat])

  const box = (key: string, pos: [number, number, number], size: [number, number, number], material: THREE.Material) => (
    <mesh key={key} position={pos} material={material}><boxGeometry args={size} /></mesh>
  )
  const [cx, cz] = d.col
  const legZ = cz / 2 + 0.4
  const springScale = Math.max(0.12, (d.colY - press - geo.springBase) / (d.colY - geo.springBase))
  const clickBar = s.type === 'clicky' && style !== 'mx'
  const silent = s.id.includes('silent')

  return (
    <group>
      {/* the plate the switch clips into */}
      <mesh geometry={geo.plate} position={[0, -d.plate, 0]} material={mat.plate} />

      {/* bottom housing, under the plate, with its plate clips */}
      {box('bottom', [0, -d.bottomH / 2, 0], [d.bottomSide, d.bottomH, d.bottomSide], mat.bottom)}
      {[-1, 1].map((sx) => box(`clip${sx}`, [sx * (d.bottomSide / 2 + 0.35), -d.plate - 0.6, 0], [0.7, 1.2, 5], mat.bottom))}

      {/* top housing: flange on the plate, sloped walls, roof with the stem opening and an LED window */}
      <mesh geometry={geo.flange} material={mat.top} />
      <mesh geometry={geo.body} position={[0, d.flangeH, 0]} material={mat.top} />
      <mesh geometry={geo.roof} position={[0, d.topH - 0.8, 0]} material={mat.top} />
      {box('led', [0, d.topH + 0.02, (d.hole[1] / 2 + d.topSide / 2) / 2], [4, 0.04, 1.4], mat.led)}

      {/* spring around the centre guide, compressed as the stem goes down */}
      <mesh geometry={geo.spring} position={[0, geo.springBase, 0]} scale={[1, springScale, 1]} material={mat.steel} />
      {box('guide', [0, geo.springBase + 1, 0], [1.2, 2, 1.2], mat.bottom)}

      {/* contacts: a copper leaf the stem legs slide past (Box switches seal theirs away) */}
      {style !== 'box' && box('leaf', [0, (geo.springBase + d.colY) / 2, legZ + 0.9], [style === 'choc' ? 5 : 4.6, d.colY - geo.springBase, 0.25], mat.copper)}
      {/* click bar: a steel wire the stem snaps past (Kailh Box and Choc clickies) */}
      {clickBar && (
        <mesh position={[0, d.colY + 0.3, legZ + 0.5]} rotation={[0, 0, Math.PI / 2]} material={mat.steel}>
          <cylinderGeometry args={[0.22, 0.22, cx + 1.5, 8]} />
        </mesh>
      )}

      {/* stem: column, legs, keycap mount */}
      <group position={[0, -press, 0]}>
        {box('col', [0, (d.colY + d.colTop) / 2, 0], [cx, d.colTop - d.colY, cz], mat.stem)}
        {[-1, 1].flatMap((sx) => [
          box(`leg${sx}`, [sx * cx * 0.3, d.colY - 1.2, legZ - 0.2], [0.9, 2.4, 0.8], mat.stem),
          // tactile: a bump on each leg that has to ride over the leaf
          s.type === 'tactile' && box(`bump${sx}`, [sx * cx * 0.3, d.colY - 1.6, legZ + 0.35], [0.9, 0.8, 0.5], mat.stem),
        ])}
        {/* clicky MX-style: a separate white click jacket around the column */}
        {s.type === 'clicky' && style === 'mx' && box('jacket', [0, d.colY + 0.7, 0], [cx + 1, 1.4, cz + 1], mat.jacket)}
        {silent && [-1, 1].flatMap((sx) => [
          box(`damp-lo${sx}`, [sx * cx * 0.3, d.colY + 0.25, -cz / 2 + 0.6], [1.2, 0.5, 1.2], mat.damper),
          box(`damp-hi${sx}`, [sx * cx * 0.3, d.colTop - 0.6, cz / 2 + 0.25], [1.2, 0.5, 0.5], mat.damper),
        ])}
        {style === 'choc'
          ? [-2.85, 2.85].map((x) => box(`rail${x}`, [x, d.colTop + d.mount / 2, 0], [1.2, d.mount, 3], mat.stem))
          : [
              box('crossX', [0, d.colTop + d.mount / 2, 0], [4, d.mount, 1.2], mat.stem),
              box('crossZ', [0, d.colTop + d.mount / 2, 0], [1.2, d.mount, 4], mat.stem),
              // Kailh Box: a square wall around the cross
              ...(style === 'box'
                ? [0, 1, 2, 3].map((i) => {
                    const along = i < 2, sign = i % 2 ? 1 : -1, h = d.mount - 0.5
                    return box(`wall${i}`, along ? [0, d.colTop + h / 2, sign * 2.6] : [sign * 2.6, d.colTop + h / 2, 0], along ? [5.8, h, 0.6] : [0.6, h, 5.8], mat.stem)
                  })
                : []),
            ]}
      </group>

      {/* under the bottom: two metal pins, the centre post and, on 5-pin switches, two side posts */}
      {d.pins.map(([x, z]) => box(`pin${x}`, [x, -d.bottomH - d.pinL / 2, z], [0.5, d.pinL, style === 'choc' ? 1.2 : 1], mat.gold))}
      {[[0, d.post], ...(style === 'choc' || FIVE_PIN.includes(s.brand) ? [[-d.sideX, d.sidePost], [d.sideX, d.sidePost]] : [])].map(([x, dia]) => (
        <mesh key={`post${x}`} position={[x, -d.bottomH - 1.4, 0]} material={mat.bottom}>
          <cylinderGeometry args={[dia / 2, dia / 2, 2.8, 20]} />
        </mesh>
      ))}
    </group>
  )
}
