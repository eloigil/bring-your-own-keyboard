import { describe, expect, it } from 'vitest'
import { boardBounds, PRESETS, resizeFree, SNAP_SIZES, snapSize, tkl } from './layout'

describe('snap resize', () => {
  it('always lands on a standard size, and each size snaps to itself', () => {
    for (let w = 5; w <= 30; w += 0.25) expect(SNAP_SIZES.map((s) => s.name)).toContain(snapSize(w))
    for (const s of SNAP_SIZES) expect(snapSize(s.width)).toBe(s.name)
  })
  it('the snap widths match the real presets', () => {
    for (const s of SNAP_SIZES) {
      const { minX, maxX } = boardBounds(PRESETS[s.name]())
      if (s.name !== '75%') expect(maxX - minX).toBeCloseTo(s.width)
    }
  })
})

describe('freeform resize', () => {
  it('removes keys past the new edge', () => {
    const keys = resizeFree(tkl(), 15)
    expect(Math.max(...keys.map((k) => k.x + k.w))).toBeLessThanOrEqual(15)
    expect(keys.some((k) => k.legend === 'Up')).toBe(false)
  })
  it('fills each straight row out to the new edge when growing', () => {
    const before = tkl()
    const keys = resizeFree(before, 20.25)
    expect(keys.length).toBeGreaterThan(before.length)
    expect(Math.max(...keys.map((k) => k.x + k.w))).toBeCloseTo(20.25)
  })
  it('leaves the board alone at its own width', () => {
    const before = tkl()
    expect(resizeFree(before, 18.25)).toHaveLength(before.length)
  })
})

describe('knob snap-aside', () => {
  it('pushes the overlapped row clear of the knob and leaves other rows alone', async () => {
    const { snapAside } = await import('./layout')
    const { validate } = await import('./validate')
    const keys = tkl()
    const knob = { id: 'knob', type: 'knob' as const, x: 5.5, y: 1.25 } // on top of the number row
    const after = snapAside(keys, knob)
    expect(validate(after, [knob], 'MX').size).toBe(0)
    const moved = after.filter((k, i) => k.x !== keys[i].x)
    expect(moved.length).toBeGreaterThan(0)
    expect(moved.every((k) => k.y === 1.25)).toBe(true)
  })
})
