import { describe, expect, it } from 'vitest'
import { area, caseMesh, caseOutline, contains, keyCorners } from './case'
import { alice, split, tkl } from './layout'

describe('caseOutline', () => {
  it('gives one body for a TKL and two for a split', () => {
    expect(caseOutline(tkl(), 'MX').filter((p) => area(p) > 0)).toHaveLength(1)
    expect(caseOutline(split(), 'MX').filter((p) => area(p) > 0)).toHaveLength(2)
  })

  it('leaves a notch where a corner key was deleted', () => {
    const keys = tkl()
    const pause = keys.find((k) => k.legend === 'Pause')!
    const before = caseOutline(keys, 'MX')
    const after = caseOutline(keys.filter((k) => k !== pause), 'MX')
    const center: [number, number] = [(pause.x + 0.5) * 19.05, (pause.y + 0.5) * 19.05]
    expect(contains(before, center)).toBe(true)
    expect(contains(after, center)).toBe(false)
    expect(area(after[0])).toBeLessThan(area(before[0]))
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
