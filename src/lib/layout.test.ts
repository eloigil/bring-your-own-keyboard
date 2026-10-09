import { describe, expect, it } from 'vitest'
import { snapAside, tkl } from './layout'
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
