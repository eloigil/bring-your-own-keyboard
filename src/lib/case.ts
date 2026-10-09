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
/** Gaps between key groups narrower than ~2× this (mm) get filled, like a real case. */
export const CLOSE = 30
export const WALL = 3 // mm wall thickness
export const TILT_DEG = 6 // typing angle
const PLATE_T = 1.5
const PLATE_RECESS = 2.5 // plate top sits this far below the wall top
const FLOOR_T = 2

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

/** A dip in the case edge, between the keys' snug outline and the body's convex hull. */
export interface Pocket {
  /** Center of the pocket's opening on the hull (mm). Saved fills are anchored here. */
  mouth: Pt
  /** Unit vector from the mouth into the pocket. */
  dir: Pt
  /** How far the pocket reaches in from the mouth (mm). */
  depth: number
  /** Current fill (mm), grown from the keys outward: 0 = open, depth = flush. The case edge sits depth - d in from the mouth. */
  d: number
}

export interface PocketFill { x: number; y: number; d: number }

const MIN_POCKET_AREA = 40 // mm²; smaller dips are just rounding noise
const ANCHOR_MATCH = 19 // mm; a saved fill belongs to the pocket whose mouth is this close

/**
 * The case outline plus its pockets. Each body (a split half) is handled on its own:
 * snug = keys + bezel with internal gaps always filled; each pocket between snug and the
 * convex hull is filled from its mouth by its saved depth, or by a smooth default (closing).
 */
export function caseShape(keys: Key[], family: Family, fills: PocketFill[] = [], margin = BEZEL): { outline: Poly[]; pockets: Pocket[] } {
  if (!keys.length) return { outline: [], pockets: [] }
  const bodies = offset(union(keys.map((k) => keyCorners(k, family))), margin).filter((p) => ClipperLib.Clipper.Area(p) > 0)
  const pockets: Pocket[] = []
  const parts: Path[] = []
  for (const body of bodies) {
    const h = hull(fromPath(body))
    const hullPath = [toPath(h)]
    const smooth = offset(offset([body], CLOSE), -CLOSE) // the default look
    parts.push(body)
    for (const pocketPath of difference(hullPath, [body])) {
      const poly = fromPath(pocketPath)
      if (Math.abs(area(poly)) < MIN_POCKET_AREA) continue
      // mouth: the pocket's vertices lying on the hull edge; its two farthest-apart ends span the opening
      const onHull = poly.filter((q) => h.some((a, i) => segDist(q, a, h[(i + 1) % h.length]) < 0.5))
      if (onHull.length < 2) continue
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

      const saved = fills
        .map((f) => ({ f, dist: Math.hypot(f.x - mouth[0], f.y - mouth[1]) }))
        .filter((m) => m.dist < ANCHOR_MATCH)
        .sort((a, b) => a.dist - b.dist)[0]?.f
      let fill: Path[], d: number
      if (saved) {
        d = Math.min(saved.d, depth)
        // fill grows out from the keys: everything except the band of width (depth - d) next to the mouth
        fill = d <= 0 ? [] : difference([pocketPath], difference(hullPath, offset(hullPath, -(depth - d))))
      } else {
        fill = intersection([pocketPath], smooth)
        d = depth * Math.min(1, pathsArea(fill) / Math.abs(area(poly)))
      }
      parts.push(...fill)
      pockets.push({ mouth, dir: n, depth, d })
    }
  }
  // light closing seals the seams between body and fills
  const outline = offset(offset(union(parts.map(fromPath)), 1), -1).map(fromPath)
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
export function tiltLift(y: number, maxY: number) {
  return (maxY - y) * Math.tan((TILT_DEG * Math.PI) / 180)
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

function extrude(rings: Poly[], holes: Poly[], from: number, to: number, bevel: number) {
  const geos = nest(rings).map(({ outer, holes: inner }) => {
    const extra = holes.filter((h) => contains([outer], h[0]))
    const depth = Math.max(to - from - 2 * bevel, 0.1)
    const g = new THREE.ExtrudeGeometry(shapeFrom(outer, [...inner, ...extra]), {
      depth,
      curveSegments: 6,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelOffset: -bevel,
      bevelSegments: 3,
    })
    g.translate(0, 0, from + bevel)
    return g
  })
  return geos
}

/**
 * The 3D case: a hollow tray (floor + walls) with a plate holding the switch cutouts,
 * tilted so the back is higher. Returned in mm, world orientation (Y up, layout y → +Z).
 */
export function caseMesh(keys: Key[], family: Family, fills: PocketFill[] = []): THREE.BufferGeometry | null {
  const outer = caseOutline(keys, family, fills)
  if (!outer.length) return null
  const inner = offset(outer.map(toPath), -WALL).map(fromPath)
  // inner rings flipped become the holes of the wall ring
  const wallHoles = inner.filter((r) => area(r) > 0)
  const cutouts = keys.map((k) => keyCorners(k, family, 0, CUTOUT[family]).slice().reverse())

  const H = CASE_HEIGHT[family]
  const parts = [
    ...extrude(outer, wallHoles, 0, H, 1.2), // walls, rounded top edge
    ...extrude(inner, [], 0, FLOOR_T, 0), // floor
    ...extrude(inner, cutouts, H - PLATE_RECESS - PLATE_T, H - PLATE_RECESS, 0), // plate
  ]
  const merged = mergeGeometries(parts)!
  merged.rotateX(-Math.PI / 2)

  // typing angle: lift each vertex in proportion to its height, more at the back; floor stays flat
  const pos = merged.attributes.position
  let maxZ = -Infinity
  for (let i = 0; i < pos.count; i++) maxZ = Math.max(maxZ, pos.getZ(i))
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setY(i, y + (y / H) * tiltLift(pos.getZ(i), maxZ))
  }
  // smooth shading across curved walls, sharp where faces meet at > 40° (top edge, cutouts)
  return toCreasedNormals(merged, (40 * Math.PI) / 180)
}

/** World height of the wall top at depth `zWorld`. */
export const wallTopAt = (zWorld: number, maxZ: number, family: Family) => CASE_HEIGHT[family] + tiltLift(zWorld, maxZ)

/** World height of the plate top under a point at layout depth `zWorld`. */
export function plateTopAt(zWorld: number, maxZ: number, family: Family) {
  const H = CASE_HEIGHT[family]
  const y = H - PLATE_RECESS
  return y + (y / H) * tiltLift(zWorld, maxZ)
}

