import type { Component, Key } from '../types'
import type { Family } from './units'
import { PITCH } from './units'
import { keyCorners, overlapArea, type Poly } from './case'

/** Footprint of a component (the knob takes one 1u cell). */
export const componentCorners = (c: Component, family: Family, inset = 0) =>
  keyCorners({ id: c.id, x: c.x, y: c.y, w: 1, h: 1, rot: 0 }, family, inset)

/** IDs of keys and components that overlap something. Touching edges don't count. */
export function validate(keys: Key[], components: Component[], family: Family): Set<string> {
  const items: { id: string; poly: Poly }[] = [
    ...keys.map((k) => ({ id: k.id, poly: keyCorners(k, family, 0.5) })),
    ...components.map((c) => ({ id: c.id, poly: componentCorners(c, family, 0.5) })),
  ]
  const box = (p: Poly) => {
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1])
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }
  const boxes = items.map((it) => box(it.poly))
  const bad = new Set<string>()
  const eps = 0.5 * PITCH[family].x // mm²
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const [a, b] = [boxes[i], boxes[j]]
      if (a[0] >= b[2] || b[0] >= a[2] || a[1] >= b[3] || b[1] >= a[3]) continue
      if (overlapArea(items[i].poly, items[j].poly) > eps) bad.add(items[i].id).add(items[j].id)
    }
  return bad
}
