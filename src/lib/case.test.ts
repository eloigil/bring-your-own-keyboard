import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { area, caseMesh, caseOutline, caseShape, contains, keyCorners, wallTopAt, type PocketFill } from './case'
import { alice, PRESETS, split, tkl } from './layout'

describe('caseOutline', () => {
  it('gives one body for a TKL and two for a split', () => {
    expect(caseOutline(tkl(), 'MX').filter((p) => area(p) > 0)).toHaveLength(1)
    expect(caseOutline(split(), 'MX').filter((p) => area(p) > 0)).toHaveLength(2)
  })

  it('smooths over a single missing corner key but keeps a notch where a block was removed', () => {
    const keys = tkl()
    const at = (l: string) => keys.find((k) => k.legend === l)!
    const center = (l: string): [number, number] => [(at(l).x + 0.5) * 19.05, (at(l).y + 0.5) * 19.05]
    expect(contains(caseOutline(keys.filter((k) => k.legend !== 'Pause'), 'MX'), center('Pause'))).toBe(true)
    const block = ['PrtSc', 'ScrLk', 'Pause', 'Ins', 'Home', 'PgUp', 'Del', 'End', 'PgDn']
    const notched = caseOutline(keys.filter((k) => !block.includes(k.legend ?? '')), 'MX')
    expect(contains(notched, center('Home'))).toBe(false)
  })

  it('fills the gaps between key groups', () => {
    const keys = tkl()
    const esc = keys.find((k) => k.legend === 'Esc')!
    const gap: [number, number] = [(esc.x + 1.5) * 19.05, (esc.y + 0.5) * 19.05] // between Esc and F1
    const leftOfUp: [number, number] = [(keys.find((k) => k.legend === 'Up')!.x - 0.5) * 19.05, 4.75 * 19.05]
    const outline = caseOutline(keys, 'MX')
    expect(outline.filter((p) => area(p) < 0)).toHaveLength(0)
    expect(contains(outline, gap)).toBe(true)
    expect(contains(outline, leftOfUp)).toBe(true)
  })

  it('wraps rotated keys completely', () => {
    const keys = alice()
    const outline = caseOutline(keys, 'MX')
    for (const k of keys.filter((k) => k.rot !== 0)) for (const c of keyCorners(k, 'MX')) expect(contains(outline, c)).toBe(true)
  })

  it('is empty without keys', () => {
    expect(caseOutline([], 'MX')).toEqual([])
    expect(caseMesh([], 'MX')).toBeNull()
  })
})

describe('caseMesh', () => {
  it('is tilted: the back is taller than the front', () => {
    const g = caseMesh(tkl(), 'MX')!
    g.computeBoundingBox()
    const pos = g.attributes.position
    let back = 0, front = 0
    const { min, max } = g.boundingBox!
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) < min.z + 5) back = Math.max(back, pos.getY(i))
      if (pos.getZ(i) > max.z - 5) front = Math.max(front, pos.getY(i))
    }
    expect(min.y).toBeCloseTo(0)
    expect(back).toBeGreaterThan(front + 5)
  })
})

function hullOf(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (l: [number, number][]) => {
    const h: [number, number][] = []
    for (const q of l) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop()
      h.push(q)
    }
    h.pop()
    return h
  }
  return [...half(p), ...half([...p].reverse())]
}

function distToOutline(polys: [number, number][][], [px, py]: [number, number]) {
  let m = Infinity
  for (const r of polys)
    for (let i = 0; i < r.length; i++) {
      const [ax, ay] = r[i], [bx, by] = r[(i + 1) % r.length]
      const dx = bx - ax, dy = by - ay
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
      m = Math.min(m, Math.hypot(px - ax - t * dx, py - ay - t * dy))
    }
  return m
}

describe('pockets', () => {
  const keys = tkl()
  const pause = keys.find((k) => k.legend === 'Pause')!
  const center: [number, number] = [(pause.x + 0.5) * 19.05, (pause.y + 0.5) * 19.05]
  const without = keys.filter((k) => k !== pause)
  const pocketAt = (fills: PocketFill[] = []) =>
    caseShape(without, 'MX', fills).pockets.find((p) => Math.hypot(p.mouth[0] - center[0], p.mouth[1] - center[1]) < 30)!

  it('finds a pocket where a corner key was removed', () => {
    expect(pocketAt()).toBeDefined()
  })

  it('opens the pocket at t=0 and fills it flush at t=1', () => {
    const { mouth } = pocketAt()
    expect(contains(caseShape(without, 'MX', [{ x: mouth[0], y: mouth[1], t: 0 }]).outline, center)).toBe(false)
    expect(contains(caseShape(without, 'MX', [{ x: mouth[0], y: mouth[1], t: 1 }]).outline, center)).toBe(true)
  })

  it('a filled pocket is solid at top-face height (no recessed or stacked plate)', () => {
    for (const gone of ['Pause', 'F6', 'F1']) {
      const ks = keys.filter((k) => k.legend !== gone)
      const k = keys.find((k) => k.legend === gone)!
      const c: [number, number] = [(k.x + 0.5) * 19.05, (k.y + 0.5) * 19.05]
      const fills = caseShape(ks, 'MX').pockets.map((p) => ({ x: p.mouth[0], y: p.mouth[1], t: 1 }))
      const mesh = caseMesh(ks, 'MX', fills)!
      const hits = new THREE.Raycaster(new THREE.Vector3(c[0], 500, c[1]), new THREE.Vector3(0, -1, 0))
        .intersectObject(new THREE.Mesh(mesh, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })))
        .map((h) => Math.round(h.point.y * 10) / 10)
        .filter((y, i, a) => a.indexOf(y) === i) // a ray on a shared triangle edge reports it twice
      const maxZ = Math.max(...caseOutline(ks, 'MX', fills).flat().map((q) => q[1]))
      expect(hits[0], gone).toBeCloseTo(wallTopAt(c[1], maxZ, 'MX'), 0)
      expect(hits, gone).toHaveLength(2) // top face, then the bottom — nothing in between
    }
  })

  it('reports the saved fill on the matching pocket', () => {
    const p = pocketAt()
    expect(pocketAt([{ x: p.mouth[0] + 3, y: p.mouth[1], t: 0.4 }]).t).toBeCloseTo(0.4)
  })

  it('never traps a void inside the case, at any fill', () => {
    for (const make of [tkl, split, alice]) {
      const ks = make().filter((k) => !['Ctrl', 'Win'].includes(k.legend ?? ''))
      for (const p of caseShape(ks, 'MX').pockets)
        for (const t of [0, 0.3, 0.6, 1]) {
          const outline = caseShape(ks, 'MX', [{ x: p.mouth[0], y: p.mouth[1], t }]).outline
          expect(outline.every((r) => area(r) > 0)).toBe(true)
          const mesh = caseMesh(ks, 'MX', [{ x: p.mouth[0], y: p.mouth[1], t }])!
          // nothing of the case (plate included) sticks out past the outline
          const pos = mesh.attributes.position
          for (let i = 0; i < pos.count; i += 7) {
            const q: [number, number] = [pos.getX(i), pos.getZ(i)]
            expect(contains(outline, q) || distToOutline(outline, q) < 0.6).toBe(true)
          }
        }
    }
  })

  it('is perfectly flat (equals its convex hull) when every orb is flush', () => {
    for (const make of [tkl, split, alice]) {
      const ks = make()
      const flush = caseShape(ks, 'MX', caseShape(ks, 'MX').pockets.map((p) => ({ x: p.mouth[0], y: p.mouth[1], t: 1 })))
      for (const ring of flush.outline) expect(area(hullOf(ring)) - area(ring)).toBeLessThan(2)
    }
  })

  it('can be made perfectly flat after random edits (deleted and nudged keys)', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const names = Object.keys(PRESETS) as (keyof typeof PRESETS)[]
    for (let trial = 0; trial < 200; trial++) {
      let ks = PRESETS[names[trial % names.length]]()
      for (let i = 0; i < 4; i++) ks.splice(Math.floor(rnd() * ks.length), 1)
      ks = ks.map((k) => (rnd() < 0.08 ? { ...k, x: k.x + Math.round((rnd() - 0.5) * 8) / 4, y: k.y + Math.round((rnd() - 0.5) * 8) / 4 } : k))
      const flush = caseShape(ks, 'MX', caseShape(ks, 'MX').pockets.map((p) => ({ x: p.mouth[0], y: p.mouth[1], t: 1 })))
      for (const ring of flush.outline) expect(area(hullOf(ring)) - area(ring), `trial ${trial}`).toBeLessThan(2)
    }
  })

  it('fills shallow cut-ins automatically, without an orb', () => {
    expect(caseShape(split(), 'MX').pockets.every((p) => p.depth >= 8)).toBe(true)
  })
})
