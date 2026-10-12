import * as THREE from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ClipperLib from 'clipper-lib'
import type { Key } from '../types'
import { CASE_HEIGHT, CUTOUT, PITCH, type Family } from './units'

/** Clipper works in integers: 1 = 0.01 mm. */
const S = 100

export type Pt = [number, number]
/** A closed polygon in mm, layout orientation (x right, y toward the user). */
export type Poly = Pt[]

export const BEZEL = 7 // mm of case around the keys
export const WALL = 3 // mm wall thickness
export const TILT_DEG = 6 // default typing angle; the user sets it in the Build step
export const TILT_MAX = 12
const PLATE_RECESS = 2.5 // plate top sits this far below the wall top
const FLOOR_T = 2
export const TOP_BEVEL = 1.2 // mm; rounded outer top edge
const BEVEL_STEPS = 6 // slabs tracing the quarter-round
const MIN_ISLAND = 90 // mm²; smaller enclosed deck pieces (about a quarter key) aren't worth a pillar
const WELL_GAP = 0.75 // mm of clearance between keycaps and the well's edge
const WELL_CLOSE = 2 // mm; only hairline cracks between keys merge into the well; any key-sized gap stays at top height

/** A key's footprint corners in mm, rotated around its center. */
export function keyCorners(k: Key, family: Family, inset = 0, size?: number | [number, number]): Poly {
  const p = PITCH[family]
  const cx = (k.x + k.w / 2) * p.x
  const cy = (k.y + k.h / 2) * p.y
  const [sw, sh] = typeof size === 'number' ? [size, size] : size ?? [k.w * p.x, k.h * p.y]
  const hw = sw / 2 - inset
  const hh = sh / 2 - inset
  const a = (k.rot * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => [cx + dx * c - dy * s, cy + dx * s + dy * c])
}

type Path = ClipperLib.IntPoint[]
const toPath = (poly: Poly): Path => poly.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }))
const fromPath = (path: Path): Poly => path.map((pt) => [pt.X / S, pt.Y / S])

function union(polys: Poly[]): Path[] {
  const c = new ClipperLib.Clipper()
  c.AddPaths(polys.map(toPath), ClipperLib.PolyType.ptSubject, true)
  const out: Path[] = []
  c.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return out
}

/** Grow (or shrink, if negative) closed paths by `margin` mm with rounded corners. */
function offset(paths: Path[], margin: number): Path[] {
  const o = new ClipperLib.ClipperOffset(2, 0.05 * S) // arc tolerance 0.05 mm keeps curves smooth
  o.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
  const out: Path[] = []
  o.Execute(out, margin * S)
  return out
}

function clip(type: number, subject: Path[], clipPaths: Path[]): Path[] {
  const c = new ClipperLib.Clipper()
  c.AddPaths(subject, ClipperLib.PolyType.ptSubject, true)
  c.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true)
  const out: Path[] = []
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return out
}
const difference = (a: Path[], b: Path[]) => clip(ClipperLib.ClipType.ctDifference, a, b)
const intersection = (a: Path[], b: Path[]) => clip(ClipperLib.ClipType.ctIntersection, a, b)
const pathsArea = (ps: Path[]) => ps.reduce((n, p) => n + ClipperLib.Clipper.Area(p), 0) / (S * S)

/** Convex hull (monotone chain). */
function hull(pts: Poly): Poly {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Poly) => {
    const h: Poly = []
    for (const q of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop()
      h.push(q)
    }
    h.pop()
    return h
  }
  return [...half(p), ...half([...p].reverse())]
}

function segDist([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/** Bodies whose convex hulls overlap become one group (one case piece); far-apart halves stay separate. */
function groupBodies(bodies: Path[]): Path[][] {
  let groups = bodies.map((b) => [b])
  for (let merged = true; merged; ) {
    merged = false
    outer: for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const hi = [toPath(hull(groups[i].flatMap(fromPath)))], hj = [toPath(hull(groups[j].flatMap(fromPath)))]
        if (pathsArea(intersection(hi, hj)) > 1) {
          groups[i] = [...groups[i], ...groups[j]]
          groups = groups.filter((_, k) => k !== j)
          merged = true
          break outer
        }
      }
  }
  return groups
}

/** The keys split into case pieces: keys whose bezels merge (or whose hulls overlap) share one piece. */
export function keyGroups(keys: Key[], family: Family): Key[][] {
  if (!keys.length) return []
  const bodies = offset(union(keys.map((k) => keyCorners(k, family))), BEZEL).filter((p) => ClipperLib.Clipper.Area(p) > 0)
  const p = PITCH[family]
  return groupBodies(bodies)
    .map((group) =>
      keys.filter((k) => {
        const c = toPath([[(k.x + k.w / 2) * p.x, (k.y + k.h / 2) * p.y]])[0]
        return group.some((path) => ClipperLib.Clipper.PointInPolygon(c, path) !== 0)
      }),
    )
    .filter((g) => g.length)
}

/** A dip in the case edge, between the keys' snug outline and the body's convex hull. */
export interface Pocket {
  /** Center of the pocket's opening on the hull (mm). Saved fills are anchored here. */
  mouth: Pt
  /** Unit vector from the mouth into the pocket. */
  dir: Pt
  /** How far the pocket reaches in from the mouth (mm). */
  depth: number
  /** Current fill as a fraction: 0 = open, 1 = flush. The pocket's edge is a straight wall `depth × (1 - t)` in from the mouth. */
  t: number
}

/** A saved orb setting: `t` (0 = open, 1 = flush) for the pocket whose mouth is near (x, y). */
export interface PocketFill { x: number; y: number; t: number }

const MIN_POCKET_AREA = 40 // mm²; smaller dips are filled flush and get no orb
const AUTO_FILL_DEPTH = 8 // mm; shallower cut-ins are filled flush and get no orb
const ANCHOR_MATCH = 19 // mm; a saved fill belongs to the pocket whose mouth is this close

/**
 * The case outline plus its pockets. Each body (a split half) is handled on its own:
 * snug = keys + bezel with internal gaps always filled; each pocket between snug and the
 * convex hull is filled behind a straight wall parallel to its opening, slid in by the orb's saved
 * fraction (untouched pockets start flush). Shallow cut-ins are always filled; enclosed voids are dropped.
 */
export function caseShape(keys: Key[], family: Family, fills: PocketFill[] = [], margin = BEZEL): { outline: Poly[]; pockets: Pocket[] } {
  if (!keys.length) return { outline: [], pockets: [] }
  const bodies = offset(union(keys.map((k) => keyCorners(k, family))), margin).filter((p) => ClipperLib.Clipper.Area(p) > 0)
  const pockets: Pocket[] = []
  const parts: Path[] = []
  for (const body of groupBodies(bodies)) {
    const h = hull(body.flatMap(fromPath))
    const hullPath = [toPath(h)]
    parts.push(...body)
    for (const pocketPath of difference(hullPath, body)) {
      const poly = fromPath(pocketPath)
      // mouth: the pocket's vertices lying on the hull edge; its two farthest-apart ends span the opening
      const onHull = poly.filter((q) => h.some((a, i) => segDist(q, a, h[(i + 1) % h.length]) < 0.5))
      // too small (or too odd) to be worth an orb: fill it flush
      if (Math.abs(area(poly)) < MIN_POCKET_AREA || onHull.length < 2) {
        parts.push(pocketPath)
        continue
      }
      let [A, B] = [onHull[0], onHull[1]], best = -1
      for (const a of onHull) for (const b of onHull) {
        const dd = Math.hypot(a[0] - b[0], a[1] - b[1])
        if (dd > best) { best = dd; A = a; B = b }
      }
      const mouth: Pt = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]
      let n: Pt = [-(B[1] - A[1]) / best, (B[0] - A[0]) / best]
      const depthOf = (q: Pt) => (q[0] - mouth[0]) * n[0] + (q[1] - mouth[1]) * n[1]
      const deep = poly.reduce((m, q) => (Math.abs(depthOf(q)) > Math.abs(depthOf(m)) ? q : m), poly[0])
      if (depthOf(deep) < 0) n = [-n[0], -n[1]]
      const depth = Math.abs(depthOf(deep))
      if (depth < AUTO_FILL_DEPTH) {
        parts.push(pocketPath)
        continue
      }

      const saved = fills
        .map((f) => ({ f, dist: Math.hypot(f.x - mouth[0], f.y - mouth[1]) }))
        .filter((m) => m.dist < ANCHOR_MATCH)
        .sort((a, b) => a.dist - b.dist)[0]?.f
      // untouched pockets start flush (t = 1): a clean solid shape until the user opens one with its orb
      const t = saved ? Math.max(0, Math.min(1, saved.t)) : 1
      // a straight wall parallel to the mouth, slid in by (1 - t) of the depth: the keys' side of it is solid
      const cut = depth * (1 - t)
      const [ux, uy] = [-n[1], n[0]] // along the mouth
      const far = 1e4
      const behind: Poly = [
        [mouth[0] + n[0] * cut - ux * far, mouth[1] + n[1] * cut - uy * far],
        [mouth[0] + n[0] * cut + ux * far, mouth[1] + n[1] * cut + uy * far],
        [mouth[0] + n[0] * far + ux * far, mouth[1] + n[1] * far + uy * far],
        [mouth[0] + n[0] * far - ux * far, mouth[1] + n[1] * far - uy * far],
      ]
      const fill = t <= 0 ? [] : t >= 1 ? [pocketPath] : intersection([pocketPath], [toPath(behind)])
      parts.push(...fill)
      pockets.push({ mouth, dir: n, depth, t })
    }
  }
  // light closing seals the seams between body and fills; enclosed voids are always filled
  const outline = offset(offset(union(parts.map(fromPath)), 1), -1).map(fromPath).filter((r) => area(r) > 0)
  return { outline, pockets }
}

/** The case outline: one polygon per separate body (a split board gives two). Holes have negative area. */
export const caseOutline = (keys: Key[], family: Family, fills: PocketFill[] = []) => caseShape(keys, family, fills).outline

/** Area (mm²) where two polygons overlap. */
export const overlapArea = (a: Poly, b: Poly) => pathsArea(intersection([toPath(a)], [toPath(b)]))

/** Signed area in mm² (positive = outer boundary in clipper's orientation). */
export const area = (poly: Poly) => ClipperLib.Clipper.Area(toPath(poly)) / (S * S)

export function contains(polys: Poly[], [x, y]: Pt): boolean {
  // even-odd over all rings handles holes
  let inside = false
  for (const poly of polys)
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
  return inside
}

/** Height (mm) of the wall top at layout depth `y` (mm): the back is raised to give the typing angle. */
export function tiltLift(y: number, maxY: number, tilt = TILT_DEG) {
  return (maxY - y) * Math.tan((tilt * Math.PI) / 180)
}

// Shapes are built in the XY plane with shapeY = -layoutY, then rotated so extrusion goes up (+Y world)
// and layout y maps to world +Z (toward the viewer).
function shapeFrom(outer: Poly, holes: Poly[]) {
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, -y)))
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, -y))))
  return shape
}

/** Group rings into outer boundaries with the holes that sit inside them. */
function nest(rings: Poly[]): { outer: Poly; holes: Poly[] }[] {
  const outers = rings.filter((r) => area(r) > 0).map((outer) => ({ outer, holes: [] as Poly[] }))
  for (const h of rings.filter((r) => area(r) <= 0)) outers.find((o) => contains([o.outer], h[0]))?.holes.push(h)
  return outers
}

export function extrude(rings: Poly[], holes: Poly[], from: number, to: number): THREE.BufferGeometry[] {
  return nest(rings).map(({ outer, holes: inner }) => {
    const extra = holes.filter((h) => contains([outer], h[0]))
    const g = new THREE.ExtrudeGeometry(shapeFrom(outer, [...inner, ...extra]), { depth: Math.max(to - from, 0.1), bevelEnabled: false, curveSegments: 1 })
    g.translate(0, 0, from)
    return g
  })
}

/** A slab of a stacked solid: its cross-section (clipper paths, holes negative) between two heights. */
interface Slab { section: Path[]; z0: number; z1: number }

/** Just the side walls of an extrusion: the extrusion with its two flat caps stripped. */
function walls(section: Path[], z0: number, z1: number): THREE.BufferGeometry[] {
  return extrude(section.map(fromPath), [], z0, z1).map((g) => {
    const pos = g.attributes.position
    const keep: number[] = []
    for (let i = 0; i < pos.count; i += 3) {
      const zs = [pos.getZ(i), pos.getZ(i + 1), pos.getZ(i + 2)]
      if (!zs.every((z) => Math.abs(z - zs[0]) < 1e-6)) for (let j = i; j < i + 3; j++) keep.push(pos.getX(j), pos.getY(j), pos.getZ(j))
    }
    const out = new THREE.BufferGeometry()
    out.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3))
    g.dispose()
    return out
  })
}

/** A flat face covering `section` at height z, facing up or down. */
function cap(section: Path[], z: number, up: boolean): THREE.BufferGeometry[] {
  return nest(section.map(fromPath)).map(({ outer, holes }) => {
    const g = new THREE.ShapeGeometry(shapeFrom(outer, holes), 1).toNonIndexed()
    g.deleteAttribute('uv')
    g.deleteAttribute('normal')
    if (!up) {
      const pos = g.attributes.position
      for (let i = 0; i < pos.count; i += 3) {
        const [x, y, zz] = [pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)]
        pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2))
        pos.setXYZ(i + 2, x, y, zz)
      }
    }
    g.translate(0, 0, z)
    return g
  })
}

/** `n` points along a ring by arc length, starting at the point nearest `from`. Keeps the ring's direction. */
function resample(ring: Poly, n: number, from?: Pt): Poly {
  const len = ring.map((p, i) => Math.hypot(ring[(i + 1) % ring.length][0] - p[0], ring[(i + 1) % ring.length][1] - p[1]))
  const total = len.reduce((a, b) => a + b, 0)
  const d = (i: number) => (from ? Math.hypot(ring[i][0] - from[0], ring[i][1] - from[1]) : i)
  const start = ring.reduce((best, _, i) => (d(i) < d(best) ? i : best), 0)
  const out: Poly = []
  let i = start, walked = 0
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total
    while (walked + len[i] < target - 1e-9) (walked += len[i]), (i = (i + 1) % ring.length)
    const t = len[i] ? (target - walked) / len[i] : 0
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length]
    out.push([ax + (bx - ax) * t, ay + (by - ay) * t])
  }
  return out
}

/**
 * Quads between two rings that run the same way (one the offset of the other), as triangles.
 * `facing`: 'wall' points away from the solid for clipper-oriented rings (left of the edge); 'up'/'down' are flat caps.
 * Built in shape space (x, -y, z) like everything else here.
 */
function zip(a: Poly, za: number, b: Poly, zb: number, facing: 'wall' | 'up' | 'down'): THREE.BufferGeometry {
  const n = Math.max(a.length, b.length, 8)
  const A = resample(a, n), B = resample(b, n, a[0])
  const v: number[] = []
  const tri = (p: number[], q: number[], r: number[], want: number[]) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], wx = r[0] - p[0], wy = r[1] - p[1], wz = r[2] - p[2]
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx
    if (nx * want[0] + ny * want[1] + nz * want[2] >= 0) v.push(...p, ...q, ...r)
    else v.push(...p, ...r, ...q)
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const P = [A[i][0], -A[i][1], za], Q = [A[j][0], -A[j][1], za], R = [B[j][0], -B[j][1], zb], S = [B[i][0], -B[i][1], zb]
    const want = facing === 'up' ? [0, 0, 1] : facing === 'down' ? [0, 0, -1] : [-(Q[1] - P[1]), Q[0] - P[0], 0]
    tri(P, Q, R, want)
    tri(P, R, S, want)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  return g
}

/** The ring shrunk by `by` mm, or null if that splits it or makes it vanish. */
function shrunk(ring: Poly, by: number): Poly | null {
  const out = offset([toPath(ring)], -by).map(fromPath).filter((r) => area(r) > 0)
  return out.length === 1 ? out[0] : null
}

/**
 * A flat ring between `ring` and the same ring shrunk by `by`: zipped between its two edges when the shrink keeps
 * one ring (earcut mangles thin rings whose edges nearly coincide), otherwise triangulated as a plain region.
 */
function ringCap(ring: Poly, by: number, z: number, up: boolean): THREE.BufferGeometry[] {
  const inner = shrunk(ring, by)
  return inner ? [zip(inner, z, ring, z, up ? 'up' : 'down')] : cap(difference([toPath(ring)], offset([toPath(ring)], -by)), z, up)
}

/**
 * Slabs with different cross-sections stacked into one shell: walls per slab, caps at the ends unless left open,
 * and at each interface only the parts of the section that end there — no faces buried inside the solid,
 * which stacked extrusions would leave (slicers and ray tests both trip over those).
 */
function stack(slabs: Slab[], open: { bottom?: boolean; top?: boolean } = {}): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = []
  slabs.forEach((s, i) => {
    parts.push(...walls(s.section, s.z0, s.z1))
    if (i === 0) {
      if (!open.bottom) parts.push(...cap(s.section, s.z0, false))
    } else {
      const below = slabs[i - 1].section
      parts.push(...cap(difference(below, s.section), s.z0, true), ...cap(difference(s.section, below), s.z0, false))
    }
    if (i === slabs.length - 1 && !open.top) parts.push(...cap(s.section, s.z1, true))
  })
  return parts
}

/**
 * The well: the recess the plate sits in. It covers only the keys (hairline gaps between keys merge),
 * never closer than WALL to the outside. Everything else — bezel and filled pockets — is full top height.
 */
export function caseWell(keys: Key[], family: Family, outer: Poly[]): Poly[] {
  const keyArea = union(keys.map((k) => keyCorners(k, family)))
  return intersection(offset(offset(keyArea, WELL_CLOSE + WELL_GAP), -WELL_CLOSE), offset(outer.map(toPath), -WALL))
    .map(fromPath)
    .filter((r) => area(r) > 0 || -area(r) > MIN_ISLAND) // slivers enclosed between keys join the well
}

// ---- The printed case: three parts that each print flat, no supports.
//   shell  – walls with the rounded top edge; a ledge the plate rests on; a rebate the bottom plate drops into;
//            M2 heat-set insert holes in the wall, reached through the bottom plate
//   plate  – the switch plate with its cutouts (and any deck pieces enclosed by keys standing on it)
//   bottom – a flat sheet with clearance holes, flush with the shell's underside
export const BOTTOM_T = 2 // mm; bottom plate thickness
const WALL_LOW = 2.5 // mm; wall thickness around the rebate
const LEDGE = 2 // mm of wall the plate rests on, all around
const FIT = 0.15 // mm; clearance so the plate and the bottom drop in
const SCREW_INSET = 4.5 // mm; screw centres in from the outer face
const SCREW_SPACING = 100 // mm along the edge between screws (at least 4 per body)
const INSERT_D = 3.2, INSERT_H = 6 // M2 heat-set insert: hole diameter and depth
const CLEAR_D = 2.4 // M2 clearance hole in the bottom plate
export const PLATE_T: Record<Family, number> = { MX: 1.5, Choc: 1.3 } // switches clip into this thickness

const circle = (cx: number, cy: number, d: number, n = 24): Poly =>
  Array.from({ length: n }, (_, i) => [cx + (d / 2) * Math.cos((2 * Math.PI * i) / n), cy + (d / 2) * Math.sin((2 * Math.PI * i) / n)])

/** Screw centres: evenly along each body's edge, SCREW_INSET in from the outer face. */
export function screwPoints(outer: Poly[]): Pt[] {
  const pts: Pt[] = []
  for (const ring of offset(outer.map(toPath), -SCREW_INSET).map(fromPath).filter((r) => area(r) > 0)) {
    const seg = ring.map((p, i) => Math.hypot(ring[(i + 1) % ring.length][0] - p[0], ring[(i + 1) % ring.length][1] - p[1]))
    const perimeter = seg.reduce((a, b) => a + b, 0)
    const n = Math.max(4, Math.round(perimeter / SCREW_SPACING))
    const step = perimeter / n
    let next = step / 2, walked = 0
    for (let i = 0; i < ring.length && pts.length < 1000; i++) {
      while (next <= walked + seg[i] && next < perimeter) {
        const t = (next - walked) / seg[i]
        const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length]
        pts.push([ax + (bx - ax) * t, ay + (by - ay) * t])
        next += step
      }
      walked += seg[i]
    }
  }
  return pts
}

/** The parts as flat extrusions in layout coordinates (x, y, z up), untilted; each starts at z = 0. */
function buildParts(keys: Key[], family: Family, fills: PocketFill[]) {
  const outer = caseOutline(keys, family, fills)
  if (!outer.length) return null
  const inner = caseWell(keys, family, outer)
  const well = inner.filter((r) => area(r) > 0)
  const islands = inner.filter((r) => area(r) < 0).map((r) => [...r].reverse()) // deck left standing inside the well
  const cutouts = keys.map((k) => keyCorners(k, family, 0, k.cut ?? CUTOUT[family]).slice().reverse())
  const H = CASE_HEIGHT[family]
  const plateBottom = H - PLATE_RECESS - PLATE_T[family]
  const screws = screwPoints(outer)
  const holeTop = Math.min(BOTTOM_T + INSERT_H, plateBottom - 0.5)
  const P = (polys: Poly[]) => polys.map(toPath)
  const outerP = P(outer), wellP = P(well)
  const bodies = outer.filter((r) => area(r) > 0)
  const rebate = offset(outerP, -WALL_LOW)
  const cavity = offset(wellP, -LEDGE)
  const inserts = P(screws.map(([x, y]) => circle(x, y, INSERT_D)))

  // Shell, bottom up: rim around the rebate; wall with the insert holes; wall up to the ledge; straight wall around
  // the well; the rounded top edge. Thin rings (rim underside, ledge, bevel) are zipped between their two edges.
  const slabs: Slab[] = [
    { section: difference(outerP, rebate), z0: 0, z1: BOTTOM_T },
    { section: difference(outerP, [...cavity, ...inserts]), z0: BOTTOM_T, z1: holeTop },
    { section: difference(outerP, cavity), z0: holeTop, z1: plateBottom },
  ]
  const shell: THREE.BufferGeometry[] = [
    ...bodies.flatMap((r) => ringCap(r, WALL_LOW, 0, false)), // underside of the rim
    ...stack(slabs, { bottom: true, top: true }),
    ...well.flatMap((r) => ringCap(r, LEDGE, plateBottom, true)), // the ledge the plate rests on
    ...walls(difference(outerP, wellP), plateBottom, H - TOP_BEVEL), // straight wall around the well
  ]
  // the rounded top edge: a loft through rings inset along a quarter circle, then the flat top
  for (const r of bodies) {
    const rings = Array.from({ length: BEVEL_STEPS + 1 }, (_, k) => {
      const th = (k / BEVEL_STEPS) * (Math.PI / 2)
      return { ring: k ? shrunk(r, TOP_BEVEL * (1 - Math.cos(th))) : r, z: H - TOP_BEVEL + TOP_BEVEL * Math.sin(th) }
    })
    for (let k = 0; k < BEVEL_STEPS; k++) {
      const a = rings[k], b = rings[k + 1]
      if (a.ring && b.ring) shell.push(zip(a.ring, a.z, b.ring, b.z, 'wall'))
    }
  }
  shell.push(...cap(difference(offset(outerP, -TOP_BEVEL), wellP), H, true))
  // the well's walls continue up through the bevel band (holes: clipper's hole direction, so reversed)
  for (const r of well) shell.push(zip([...r].reverse(), H - TOP_BEVEL, [...r].reverse(), H, 'wall'))
  for (const r of outer.filter((o) => area(o) < 0)) shell.push(zip(r, H - TOP_BEVEL, r, H, 'wall'))

  // plate: drops onto the ledge; enclosed deck pieces stand on it up to deck height
  const plate = stack([
    { section: difference(offset(wellP, -FIT), P(cutouts)), z0: 0, z1: PLATE_T[family] },
    ...(islands.length ? [{ section: P(islands), z0: PLATE_T[family], z1: PLATE_T[family] + PLATE_RECESS }] : []),
  ])
  // bottom: fills the rebate, screws up into the inserts
  const bottom = stack([{ section: difference(offset(outerP, -(WALL_LOW + FIT)), P(screws.map(([x, y]) => circle(x, y, CLEAR_D)))), z0: 0, z1: BOTTOM_T }])
  return { shell, plate, bottom, plateBottom, screws, H }
}

/** Layout-space extrusion → world (Y up, layout y → +Z), then the typing angle: everything above the bottom plate
 *  is lifted in proportion to its height, more at the back. The bottom stays flat. */
function toWorld(g: THREE.BufferGeometry, H: number, tilt: number) {
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position
  let maxZ = -Infinity
  for (let i = 0; i < pos.count; i++) maxZ = Math.max(maxZ, pos.getZ(i))
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setY(i, y + (Math.max(0, y - BOTTOM_T) / (H - BOTTOM_T)) * tiltLift(pos.getZ(i), maxZ, tilt))
  }
  return g
}

/**
 * The three printable parts in world orientation (Y up): the shell with the typing angle built in, the plate
 * and the bottom flat (they print flat and sit in the tilted shell). Plus the screw count for the notes.
 */
export function caseParts(keys: Key[], family: Family, fills: PocketFill[] = [], tilt = TILT_DEG) {
  const b = buildParts(keys, family, fills)
  if (!b) return null
  const flat = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts)!.rotateX(-Math.PI / 2)
  return {
    shell: toCreasedNormals(toWorld(mergeGeometries(b.shell)!, b.H, tilt), (40 * Math.PI) / 180),
    plate: flat(b.plate),
    bottom: flat(b.bottom),
    screws: b.screws.length,
    /** mm of room under the plate for the PCB or wiring, above the bottom plate. */
    cavity: b.plateBottom - BOTTOM_T,
  }
}

/**
 * The assembled case for the 3D view: shell, plate on its ledge and bottom in its rebate, tilted together.
 * Returned in mm, world orientation (Y up, layout y → +Z).
 */
export function caseMesh(keys: Key[], family: Family, fills: PocketFill[] = [], tilt = TILT_DEG): THREE.BufferGeometry | null {
  const b = buildParts(keys, family, fills)
  if (!b) return null
  const merged = mergeGeometries([...b.shell, ...b.plate.map((g) => g.translate(0, 0, b.plateBottom)), ...b.bottom])!
  // smooth shading across curved walls, sharp where faces meet at > 40° (top edge, cutouts)
  return toCreasedNormals(toWorld(merged, b.H, tilt), (40 * Math.PI) / 180)
}

/** World height of the wall top at depth `zWorld`. */
export const wallTopAt = (zWorld: number, maxZ: number, family: Family, tilt = TILT_DEG) => CASE_HEIGHT[family] + tiltLift(zWorld, maxZ, tilt)

/** World height of the plate top under a point at layout depth `zWorld`. */
export function plateTopAt(zWorld: number, maxZ: number, family: Family, tilt = TILT_DEG) {
  const H = CASE_HEIGHT[family]
  const y = H - PLATE_RECESS
  return y + ((y - BOTTOM_T) / (H - BOTTOM_T)) * tiltLift(zWorld, maxZ, tilt)
}

/** Plate slope (radians): it tilts a little less than the wall top because it sits lower. */
export function plateTilt(family: Family, tilt = TILT_DEG) {
  const H = CASE_HEIGHT[family]
  return Math.atan(((H - PLATE_RECESS - BOTTOM_T) / (H - BOTTOM_T)) * Math.tan((tilt * Math.PI) / 180))
}

