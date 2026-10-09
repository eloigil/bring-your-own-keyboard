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
const PLATE_T = 1.5
const PLATE_RECESS = 2.5 // plate top sits this far below the wall top
const FLOOR_T = 2
export const TOP_BEVEL = 1.2 // mm; rounded outer top edge
const BEVEL_STEPS = 6 // slabs tracing the quarter-round
const MIN_ISLAND = 90 // mm²; smaller enclosed deck pieces (about a quarter key) aren't worth a pillar
const WELL_GAP = 0.75 // mm of clearance between keycaps and the well's edge
const WELL_CLOSE = 2 // mm; only hairline cracks between keys merge into the well; any key-sized gap stays at top height

/** A key's footprint corners in mm, rotated around its center. */
export function keyCorners(k: Key, family: Family, inset = 0, size?: number): Poly {
  const p = PITCH[family]
  const cx = (k.x + k.w / 2) * p.x
  const cy = (k.y + k.h / 2) * p.y
  const hw = (size ?? k.w * p.x) / 2 - inset
  const hh = (size ?? k.h * p.y) / 2 - inset
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

/**
 * The 3D case: a hollow tray (floor + walls) with a plate holding the switch cutouts,
 * tilted so the back is higher. Returned in mm, world orientation (Y up, layout y → +Z).
 */
export function caseMesh(keys: Key[], family: Family, fills: PocketFill[] = [], tilt = TILT_DEG): THREE.BufferGeometry | null {
  const outer = caseOutline(keys, family, fills)
  if (!outer.length) return null
  const inner = caseWell(keys, family, outer)
  const wellHoles = inner.filter((r) => area(r) > 0)
  const islands = inner.filter((r) => area(r) < 0).map((r) => [...r].reverse()) // deck left standing inside the well
  const cutouts = keys.map((k) => keyCorners(k, family, 0, CUTOUT[family]).slice().reverse())

  // The body is a stack of straight slabs, each inset a little more, tracing a quarter-round top edge.
  // ponytail: stairs instead of a true loft — three's ExtrudeGeometry bevel triangulates a shifted
  // contour that folds over itself at the pockets' sharp corners. A loft would give one smooth shell.
  const H = CASE_HEIGHT[family]
  const parts: THREE.BufferGeometry[] = []
  let z = 0
  for (let k = 0; k <= BEVEL_STEPS; k++) {
    const th = (k / BEVEL_STEPS) * (Math.PI / 2)
    const top = k === 0 ? H - TOP_BEVEL : H - TOP_BEVEL + TOP_BEVEL * Math.sin(th)
    const inset = TOP_BEVEL * (1 - Math.cos(th))
    const rings = inset ? offset(outer.map(toPath), -inset).map(fromPath) : outer
    parts.push(...extrude(rings, wellHoles, z, top))
    z = top
  }
  parts.push(
    ...extrude(islands, [], 0, H),
    ...extrude(inner, [], 0, FLOOR_T), // floor
    ...extrude(inner, cutouts, H - PLATE_RECESS - PLATE_T, H - PLATE_RECESS), // plate
  )
  const merged = mergeGeometries(parts)!
  merged.rotateX(-Math.PI / 2)

  // typing angle: lift each vertex in proportion to its height, more at the back; floor stays flat
  const pos = merged.attributes.position
  let maxZ = -Infinity
  for (let i = 0; i < pos.count; i++) maxZ = Math.max(maxZ, pos.getZ(i))
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setY(i, y + (y / H) * tiltLift(pos.getZ(i), maxZ, tilt))
  }
  // smooth shading across curved walls, sharp where faces meet at > 40° (top edge, cutouts)
  return toCreasedNormals(merged, (40 * Math.PI) / 180)
}

/** World height of the wall top at depth `zWorld`. */
export const wallTopAt = (zWorld: number, maxZ: number, family: Family, tilt = TILT_DEG) => CASE_HEIGHT[family] + tiltLift(zWorld, maxZ, tilt)

/** World height of the plate top under a point at layout depth `zWorld`. */
export function plateTopAt(zWorld: number, maxZ: number, family: Family, tilt = TILT_DEG) {
  const H = CASE_HEIGHT[family]
  const y = H - PLATE_RECESS
  return y + (y / H) * tiltLift(zWorld, maxZ, tilt)
}

