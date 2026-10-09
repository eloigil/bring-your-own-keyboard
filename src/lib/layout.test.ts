import { describe, expect, it } from 'vitest'
import { magnetSnap, resizeKey, snapAside, tkl } from './layout'
import { validate } from './validate'

describe('knob snap-aside', () => {
  it('pushes the overlapped row clear of the knob and leaves other rows alone', () => {
    const keys = tkl()
    const knob = { id: 'knob', type: 'knob' as const, x: 5.5, y: 1.25 } // on top of the number row
    const after = snapAside(keys, knob)
    expect(validate(after, [knob], 'MX').size).toBe(0)
    const moved = after.filter((k, i) => k.x !== keys[i].x)
    expect(moved.length).toBeGreaterThan(0)
    expect(moved.every((k) => k.y === 1.25)).toBe(true)
  })
})

describe('key size', () => {
  const keys = tkl()
  const id = (l: string) => keys.find((k) => k.legend === l)!.id
  const at = (ks: typeof keys, l: string) => ks.find((k) => k.legend === l)!

  it('widening a key slides the rest of its row and nothing overlaps', () => {
    const after = resizeKey(keys, id('Tab'), 2, 1)
    expect(at(after, 'Tab').w).toBe(2)
    expect(at(after, 'Q').x).toBeCloseTo(at(keys, 'Q').x + 0.5)
    expect(at(after, 'A').x).toBe(at(keys, 'A').x) // other rows stay put
    expect(validate(after, [], 'MX').size).toBe(0)
  })
  it('narrowing a key pulls the rest of its row in, leaving no gap', () => {
    const after = resizeKey(keys, id('Space'), 2.25, 1)
    const space = at(after, 'Space')
    const next = after.filter((k) => k.y === space.y && k.x > space.x).sort((a, b) => a.x - b.x)[0]
    expect(space.w).toBe(2.25)
    expect(next.x).toBeCloseTo(space.x + 2.25)
  })
  it('a 2u-tall key only changes its own height', () => {
    const after = resizeKey(keys, id('Enter'), 2.25, 2)
    expect(at(after, 'Enter').h).toBe(2)
    expect(after.filter((k, i) => k.x !== keys[i].x || k.y !== keys[i].y)).toHaveLength(0)
  })
})

describe('magnetic drag snapping', () => {
  const a = { id: 'a', x: 0, y: 0, w: 1.25, h: 1, rot: 0 }
  it('snaps flush against a neighbour when close, aligned to its row', () => {
    expect(magnetSnap([a], 1.4, 0.15, 1, 1)).toEqual([1.25, 0]) // 0.15u past the edge, a bit low → flush, same row
    expect(magnetSnap([a], 1.1, -0.1, 1, 1)).toEqual([1.25, 0]) // overlapping a little → pushed flush
  })
  it('falls back to the 0.25u grid away from other keys', () => {
    expect(magnetSnap([a], 5.13, 3.9, 1, 1)).toEqual([5.25, 4])
  })
  it('stacks flush below a key', () => {
    expect(magnetSnap([a], 0.1, 1.2, 1, 1)).toEqual([0, 1])
  })
})
