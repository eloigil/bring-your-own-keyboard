import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { area, caseAssembly, caseMesh, caseOutline, caseParts, caseShape, caseWell, contains, keyCorners, portSpan, screwPoints, usbPort, wallTopAt, BOTTOM_T, LID_T, PLATE_T, STANDOFF_H, TOP_BEVEL, type PocketFill } from './case'
import { CASE_HEIGHT, PITCH } from './units'
import { alice, caseController, PRESETS, split, tkl } from './layout'
import { CONTROLLERS } from '../data/components'

describe('caseOutline', () => {
  it('gives one body for a TKL and two for a split', () => {
    expect(caseOutline(tkl(), 'MX').filter((p) => area(p) > 0)).toHaveLength(1)
    expect(caseOutline(split(), 'MX').filter((p) => area(p) > 0)).toHaveLength(2)
  })

  it('starts with every pocket flush; an orb at 0 opens a notch where keys were removed', () => {
    const keys = tkl()
    const at = (l: string) => keys.find((k) => k.legend === l)!
    const center = (l: string): [number, number] => [(at(l).x + 0.5) * 19.05, (at(l).y + 0.5) * 19.05]
    const block = ['PrtSc', 'ScrLk', 'Pause', 'Ins', 'Home', 'PgUp', 'Del', 'End', 'PgDn']
    const ks = keys.filter((k) => !block.includes(k.legend ?? ''))
    const shape = caseShape(ks, 'MX')
    expect(shape.pockets.every((p) => p.t === 1)).toBe(true)
    for (const ring of shape.outline) expect(area(hullOf(ring)) - area(ring)).toBeLessThan(2)
    const opened = caseOutline(ks, 'MX', shape.pockets.map((p) => ({ x: p.mouth[0], y: p.mouth[1], t: 0 })))
    expect(contains(opened, center('Home'))).toBe(false)
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
  it('follows the typing angle: flat at 0°, steeper at 12° than at 6°', () => {
    const backMinusFront = (tilt: number) => {
      const g = caseMesh(tkl(), 'MX', [], tilt)!
      g.computeBoundingBox()
      const { min, max } = g.boundingBox!
      const pos = g.attributes.position
      let back = 0, front = 0
      for (let i = 0; i < pos.count; i++) {
        if (pos.getZ(i) < min.z + 5) back = Math.max(back, pos.getY(i))
        if (pos.getZ(i) > max.z - 5) front = Math.max(front, pos.getY(i))
      }
      return back - front
    }
    expect(backMinusFront(0)).toBeLessThan(1)
    expect(backMinusFront(12)).toBeGreaterThan(backMinusFront(6) + 5)
  })

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
      const top = wallTopAt(c[1], maxZ, 'MX')
      expect(hits[0], gone).toBeCloseTo(top, 0)
      // nothing between the rounded top edge band (stretched by the tilt) and the seam where the bottom plate meets
      // the shell: no recessed plate, no stacked floor
      const bandBottom = top - TOP_BEVEL * (top / CASE_HEIGHT.MX) - 0.3
      expect(hits.filter((h) => h > BOTTOM_T + 0.5 && h < bandBottom), gone).toEqual([])
    }
  })

  it('part-filled and untouched pockets end in a straight wall parallel to the opening (even in an L-shaped corner)', () => {
    let checked = 0
    for (const make of [tkl, split, alice]) {
      const ks = make()
      for (const p of caseShape(ks, 'MX').pockets) {
        const at = (t: number) => caseShape(ks, 'MX', [{ x: p.mouth[0], y: p.mouth[1], t }]).outline
        const open = at(0), flush = at(1)
        for (const [half, cut] of [[at(0.5), p.depth * 0.5], [caseShape(ks, 'MX').outline, p.depth * (1 - p.t)]] as const) {
        // points of the half-filled outline that are new: off both the open and the flush outline
        const mids = half.flatMap((r) => r.map((a, i) => [(a[0] + r[(i + 1) % r.length][0]) / 2, (a[1] + r[(i + 1) % r.length][1]) / 2] as [number, number]))
        const fresh = [...half.flat(), ...mids].filter((v) => distToOutline(open, v) > 1.5 && distToOutline(flush, v) > 1.5)
        checked += fresh.length
        for (const v of fresh) {
          const dv = (v[0] - p.mouth[0]) * p.dir[0] + (v[1] - p.mouth[1]) * p.dir[1]
          expect(Math.abs(dv - cut), `${make.name} pocket at ${p.mouth.map(Math.round)}`).toBeLessThan(1.5)
        }
        }
      }
    }
    expect(checked).toBeGreaterThan(5)
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

  it('the top face never folds into the well (no slanted shards around the keys)', () => {
    for (const make of [tkl, split, alice]) {
      const ks = make()
      const outline = caseOutline(ks, 'MX')
      const rings = caseWell(ks, 'MX', outline)
      const well = rings.filter((r) => area(r) > 0)
      const islands = rings.filter((r) => area(r) < 0) // deck pieces fully enclosed by keys are solid
      const g = caseMesh(ks, 'MX')!
      const pos = g.attributes.position, nrm = g.attributes.normal
      const maxZ = Math.max(...outline.flat().map((q) => q[1]))
      let checked = 0
      for (let i = 0; i < pos.count; i += 3) {
        const up = nrm.getY(i) > 0.7 && nrm.getY(i + 1) > 0.7 && nrm.getY(i + 2) > 0.7
        const atTop = [i, i + 1, i + 2].every((j) => Math.abs(wallTopAt(pos.getZ(j), maxZ, 'MX') - pos.getY(j)) < 0.3)
        if (!up || !atTop) continue
        const c: [number, number] = [(pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3]
        checked++
        // a top-face triangle's centre must be on the case, outside every well ring
        expect(contains(outline, c), `${make.name} top triangle off the case at ${c.map(Math.round)}`).toBe(true)
        const inWell = well.some((r) => contains([r], c) && distToOutline([r], c) > 0.3) && !islands.some((r) => contains([r], c))
        expect(inWell, `${make.name} top triangle inside the well at ${c.map(Math.round)}`).toBe(false)
      }
      expect(checked).toBeGreaterThan(50)
    }
  })

  it('fills shallow cut-ins automatically, without an orb', () => {
    expect(caseShape(split(), 'MX').pockets.every((p) => p.depth >= 8)).toBe(true)
  })
})

describe('printable parts', () => {
  const flat = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox()
    return g.boundingBox!
  }

  it('leaves room under the plate for a PCB, its pins and the LEDs, and puts at least four screws in each body', () => {
    const tklParts = caseParts(tkl(), 'MX')!
    expect(tklParts.cavity).toBeGreaterThanOrEqual(5.3) // MX: 5 mm housing + 1.6 mm PCB + 1.7 mm pins + solder, below a 4 mm plate recess
    expect(tklParts.screws).toBeGreaterThanOrEqual(4)
    expect(caseParts(split(), 'MX')!.screws).toBeGreaterThanOrEqual(8) // two bodies
    expect(caseParts(tkl(), 'Choc')!.cavity).toBeGreaterThan(0)
  })

  it('the screw holes sit in the wall: clear of the outline, the cavity under the plate and the well', () => {
    const ks = tkl()
    const outer = caseOutline(ks, 'MX')
    const well = caseWell(ks, 'MX', outer).filter((r) => area(r) > 0)
    for (const pt of screwPoints(outer)) {
      expect(contains(outer, pt)).toBe(true)
      expect(distToOutline(outer, pt)).toBeGreaterThan(1.6 + 0.4) // insert hole radius + wall
      expect(distToOutline(well, pt)).toBeGreaterThan(1.6) // the hole never breaks into the cavity (well inset by the ledge) or the well
      expect(well.some((r) => contains([r], pt))).toBe(false)
    }
  })

  it('plate and bottom are flat sheets that fit inside the shell with clearance', () => {
    const parts = caseParts(tkl(), 'MX')!
    const plate = flat(parts.plate), bottom = flat(parts.bottom), shell = flat(parts.shell)
    expect(plate.min.y).toBeCloseTo(0)
    expect(bottom.max.y).toBeCloseTo(2)
    expect(shell.min.y).toBeCloseTo(0)
    expect(bottom.max.x - bottom.min.x).toBeLessThan(shell.max.x - shell.min.x - 2 * 2.5)
    expect(plate.max.x - plate.min.x).toBeLessThan(bottom.max.x - bottom.min.x)
  })
})

describe('rounded top edge', () => {
  it('every face of the bevel faces outward or up, never down or into the case (no twisted or crossing faces)', () => {
    // an open notch (the learner's screenshot): Pause removed, every pocket's orb pulled all the way out
    const notched = () => tkl().filter((k) => k.legend !== 'Pause' && k.legend !== 'F6')
    const openFills = (ks: ReturnType<typeof tkl>) => caseShape(ks, 'MX').pockets.map((p) => ({ x: p.mouth[0], y: p.mouth[1], t: 0 }))
    for (const [name, ks, fills] of [['tkl', tkl(), []], ['split', split(), []], ['notched', notched(), openFills(notched())]] as const) {
      const make = { name }
      const outline = caseOutline(ks, 'MX', [...fills])
      const shell = caseParts(ks, 'MX', [...fills], 0)!.shell // untilted: the band is a flat ring of heights
      const pos = shell.attributes.position
      const H = CASE_HEIGHT.MX
      let checked = 0
      for (let i = 0; i < pos.count; i += 3) {
        const ys = [pos.getY(i), pos.getY(i + 1), pos.getY(i + 2)]
        if (ys.some((y) => y < H - TOP_BEVEL + 0.01 || y > H - 0.01)) continue // only the sloped band between its two rings
        const ax = pos.getX(i + 1) - pos.getX(i), ay = ys[1] - ys[0], az = pos.getZ(i + 1) - pos.getZ(i)
        const bx = pos.getX(i + 2) - pos.getX(i), by = ys[2] - ys[0], bz = pos.getZ(i + 2) - pos.getZ(i)
        const n = new THREE.Vector3(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx)
        if (n.lengthSq() < 1e-3) continue // clipper leaves 0.01 mm micro-edges on curves; their normals mean nothing
        n.normalize()
        checked++
        expect(n.y, `${make.name}: bevel triangle facing down`).toBeGreaterThan(-0.05)
        // a step along the horizontal part of the normal leaves the case; a step against it stays inside
        const c: [number, number] = [(pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3]
        const h = Math.hypot(n.x, n.z)
        if (h < 0.3) continue
        const dir: [number, number] = [n.x / h, n.z / h]
        expect(contains(outline, [c[0] - dir[0] * 1.5, c[1] - dir[1] * 1.5]), `${make.name}: bevel triangle facing into the case at ${c.map(Math.round)}`).toBe(true)
      }
      expect(checked).toBeGreaterThan(200)
      // and no face of the top band reaches outside the case: sample each triangle's centre and edge midpoints
      for (let i = 0; i < pos.count; i += 3) {
        const v = [0, 1, 2].map((j) => [pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j)])
        if (v.some((p) => p[1] < H - TOP_BEVEL - 0.01)) continue
        const samples: [number, number][] = [
          [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3],
          ...[[0, 1], [1, 2], [2, 0]].map(([a, b]) => [(v[a][0] + v[b][0]) / 2, (v[a][2] + v[b][2]) / 2] as [number, number]),
        ]
        for (const q of samples)
          expect(contains(outline, q) || distToOutline(outline, q) < 0.05, `${make.name}: top-band face spans outside the case at ${q.map(Math.round)}`).toBe(true)
      }
    }
  })
})

describe('controller', () => {
  // a TKL with a controller above the F-row, USB end facing the back wall
  const withBoard = (model: 'pico' | 'zero' | 'xiao' = 'pico', rot = 0) => {
    const part = { id: 'ctrl', type: 'controller' as const, x: 9, y: -3.6, rot, model }
    const ctrl = caseController([part])!
    return { keys: [...tkl(), ctrl.at], ctrl }
  }
  const rayHeights = (g: THREE.BufferGeometry, x: number, z: number) =>
    new THREE.Raycaster(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0))
      .intersectObject(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })))
      .map((h) => Math.round(h.point.y * 10) / 10)
  const solid = (g: THREE.BufferGeometry) => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))

  it('cuts a USB opening through the wall its USB end faces, for every board, below the plate and above the bottom', () => {
    for (const model of ['xiao', 'zero', 'pico'] as const) {
      const { keys, ctrl } = withBoard(model)
      const outer = caseOutline(keys, 'MX')
      const port = usbPort(outer, ctrl, 'MX')!
      expect(port, model).not.toBeNull()
      const span = portSpan('MX', ctrl.board)
      expect(span.h, model).toBeGreaterThanOrEqual(7) // fits a micro-USB or USB-C plug's overmould
      const shell = caseParts(keys, 'MX', [], 0, ctrl)!.shell
      // a horizontal ray along the opening's axis, at the plug's height, goes from outside to the board's end unblocked
      const cx = (ctrl.at.x + ctrl.at.w / 2) * 19.05
      const back = Math.min(...outer.flat().map((q) => q[1]))
      const ray = (g: THREE.BufferGeometry, far: number) =>
        new THREE.Raycaster(new THREE.Vector3(cx, (span.z0 + span.z1) / 2, back - 20), new THREE.Vector3(0, 0, 1), 0, far).intersectObject(solid(g))
      expect(ray(shell, 20 + port.wall), model).toEqual([])
      // and without the controller the same ray hits the wall
      expect(ray(caseParts(keys, 'MX', [], 0)!.shell, 30).length, model).toBeGreaterThan(0)
    }
  })

  it('a low-profile case still gets an opening, shorter, between the bottom plate and the plate', () => {
    for (const board of Object.values(CONTROLLERS)) {
      const span = portSpan('Choc', board)
      expect(span.z0).toBeGreaterThan(BOTTOM_T)
      expect(span.h).toBeGreaterThan(3)
      expect(span.z1).toBeLessThan(CASE_HEIGHT.Choc - 2.5 - 1.3)
    }
  })

  it('stands the Pico on four bored standoffs on the bottom plate', () => {
    const { keys, ctrl } = withBoard('pico')
    const bottom = caseParts(keys, 'MX', [], 0, ctrl)!.bottom
    bottom.computeBoundingBox()
    expect(bottom.boundingBox!.max.y).toBeCloseTo(BOTTOM_T + STANDOFF_H)
    const [cx, cy] = [(ctrl.at.x + ctrl.at.w / 2) * PITCH.MX.x, (ctrl.at.y + ctrl.at.h / 2) * PITCH.MX.y]
    const top = (x: number, z: number) => Math.max(-1, ...rayHeights(bottom, x, z))
    expect(top(cx + 5.7, cy + 23.5)).toBe(-1) // the hole goes right through
    expect(top(cx + 5.7 + 1.8, cy + 23.5)).toBeCloseTo(BOTTOM_T + STANDOFF_H, 1)
  })

  it('holds a board without holes in a tray on a pad: walls on three sides, open towards its USB end', () => {
    const { keys, ctrl } = withBoard('zero')
    const bottom = caseParts(keys, 'MX', [], 0, ctrl)!.bottom
    const { w, l } = ctrl.board
    const [cx, cy] = [(ctrl.at.x + ctrl.at.w / 2) * PITCH.MX.x, (ctrl.at.y + ctrl.at.h / 2) * PITCH.MX.y]
    const top = (x: number, z: number) => Math.max(...rayHeights(bottom, x, z))
    const pad = BOTTOM_T + STANDOFF_H
    expect(top(cx, cy)).toBeCloseTo(pad, 1) // the board lies on the pad, as high as the Pico on its standoffs
    expect(top(cx - w / 2 - 0.9, cy)).toBeGreaterThan(pad + 1) // side walls
    expect(top(cx + w / 2 + 0.9, cy)).toBeGreaterThan(pad + 1)
    expect(top(cx, cy + l / 2 + 0.9)).toBeGreaterThan(pad + 1) // the far end
    expect(top(cx, cy - l / 2 - 0.9)).toBeCloseTo(BOTTOM_T, 1) // nothing past the USB end
  })

  it('the smaller boards take a smaller footprint and window than the Pico', () => {
    const pico = caseController([{ id: 'a', type: 'controller', x: 0, y: 0 }])!.at
    for (const model of ['xiao', 'zero'] as const) {
      const small = caseController([{ id: 'a', type: 'controller', x: 0, y: 0, model }])!.at
      expect(small.h).toBeLessThan(pico.h)
      expect(small.cut![1]).toBeLessThan(pico.cut![1])
      expect(small.cut![0]).toBeGreaterThan(CONTROLLERS[model].w) // the window shows the whole board
      expect(small.cut![1]).toBeGreaterThan(CONTROLLERS[model].l)
    }
  })

  const mounted = (mount: 'window' | 'covered' | 'raised', model: 'pico' | 'zero' = 'pico', screen = false) => {
    const ctrl = caseController([{ id: 'ctrl', type: 'controller', x: 9, y: -3.6, model, mount, screen }])!
    const keys = [...tkl(), ctrl.at]
    const [cx, cy] = [(ctrl.at.x + ctrl.at.w / 2) * PITCH.MX.x, (ctrl.at.y + ctrl.at.h / 2) * PITCH.MX.y]
    return { ctrl, keys, cx, cy, view: caseAssembly(keys, 'MX', [], 0, ctrl)!, print: caseParts(keys, 'MX', [], 0, ctrl)! }
  }
  const plateTop = CASE_HEIGHT.MX - 2.5

  it('raised: a solid plate over the board, its mount on the plate, and a notch open at the top of the wall', () => {
    for (const model of ['pico', 'zero'] as const) {
      const { ctrl, keys, cx, cy, view, print } = mounted('raised', model)
      // no window: straight down through the board's centre, the first thing hit is the plate's top (or the tray on it)
      const first = Math.max(...rayHeights(view.plate, cx, cy))
      expect(first, model).toBeGreaterThanOrEqual(plateTop - 0.05)
      print.bottom.computeBoundingBox()
      expect(print.bottom.boundingBox!.max.y, model).toBeCloseTo(BOTTOM_T, 1) // nothing on the bottom plate
      // the notch: a horizontal ray at the plug's height, from outside to the board's end, meets no wall
      const span = portSpan('MX', ctrl.board, 'raised')
      expect(span.z1).toBeGreaterThan(CASE_HEIGHT.MX) // open at the top
      const back = Math.min(...caseOutline(keys, 'MX').flat().map((q) => q[1]))
      const port = usbPort(caseOutline(keys, 'MX'), ctrl, 'MX')!
      const plug = plateTop + ctrl.board.pcb + ctrl.board.usbH / 2
      const hits = new THREE.Raycaster(new THREE.Vector3(cx, plug, back - 20), new THREE.Vector3(0, 0, 1), 0, 20 + port.wall).intersectObject(solid(view.shell))
      expect(hits, model).toEqual([])
    }
  })

  it('covered: a lid drops into the window and rests on the plate; it prints flange down', () => {
    const { cx, cy, view, print } = mounted('covered')
    expect(view.lid).not.toBeNull()
    expect(Math.max(...rayHeights(view.lid!, cx, cy))).toBeCloseTo(plateTop + LID_T, 1)
    expect(Math.min(...rayHeights(view.lid!, cx, cy))).toBeCloseTo(plateTop - PLATE_T.MX, 1) // the plug fills the window
    const lid = print.lid!
    lid.computeBoundingBox()
    expect(lid.boundingBox!.min.y).toBeCloseTo(0)
    expect(lid.boundingBox!.max.y).toBeCloseTo(LID_T + PLATE_T.MX)
    expect(mounted('window').print.lid).toBeNull()
  })

  it('a screen on top lengthens the footprint so the 38 mm OLED fits', () => {
    expect(mounted('raised', 'zero', true).ctrl.at.h).toBeGreaterThanOrEqual(2.5)
    expect(mounted('raised', 'zero', false).ctrl.at.h).toBe(1.5)
    expect(2.5 * PITCH.Choc.y).toBeGreaterThan(38) // fits at the tighter Choc pitch too
  })

  it('reports a controller buried mid-board as blocked (no wall within reach)', () => {
    const keys = tkl().filter((k) => !(k.y >= 2 && k.y < 5 && k.x >= 4 && k.x < 6))
    const ctrl = caseController([{ id: 'ctrl', type: 'controller', x: 4.5, y: 2, rot: 90 }])!
    expect(usbPort(caseOutline([...keys, ctrl.at], 'MX'), ctrl, 'MX')).toBeNull()
    expect(caseParts([...keys, ctrl.at], 'MX', [], 0, ctrl)!.port).toBe('blocked')
  })
})
