import { describe, expect, it } from 'vitest'
import { area, caseMesh, caseOutline, caseShape, contains, keyCorners } from './case'
import { alice, split, tkl } from './layout'

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

describe('pockets', () => {
  const keys = tkl()
  const pause = keys.find((k) => k.legend === 'Pause')!
  const center: [number, number] = [(pause.x + 0.5) * 19.05, (pause.y + 0.5) * 19.05]
  const without = keys.filter((k) => k !== pause)
  const pocketAt = (fills: { x: number; y: number; d: number }[] = []) =>
    caseShape(without, 'MX', fills).pockets.find((p) => Math.hypot(p.mouth[0] - center[0], p.mouth[1] - center[1]) < 30)!

  it('finds a pocket where a corner key was removed', () => {
    expect(pocketAt()).toBeDefined()
    expect(pocketAt().depth).toBeGreaterThan(5)
  })

  it('opens the pocket at d=0 and fills it flush at d=depth', () => {
    const p = pocketAt()
    const open = caseShape(without, 'MX', [{ x: p.mouth[0], y: p.mouth[1], d: 0 }]).outline
    const flush = caseShape(without, 'MX', [{ x: p.mouth[0], y: p.mouth[1], d: p.depth }]).outline
    expect(contains(open, center)).toBe(false)
    expect(contains(flush, center)).toBe(true)
  })

  it('reports the saved depth on the matching pocket', () => {
    const p = pocketAt()
    expect(pocketAt([{ x: p.mouth[0] + 3, y: p.mouth[1], d: 4 }]).d).toBeCloseTo(4)
  })
})
