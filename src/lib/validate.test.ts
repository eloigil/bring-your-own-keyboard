import { expect, it } from 'vitest'
import { validate } from './validate'
import { PRESETS } from './layout'
import type { Key } from '../types'

const key = (id: string, x: number, y: number): Key => ({ id, x, y, w: 1, h: 1, rot: 0 })

it('flags two overlapping keys and clears once separated', () => {
  expect([...validate([key('a', 0, 0), key('b', 0.5, 0)], [], 'MX')].sort()).toEqual(['a', 'b'])
  expect(validate([key('a', 0, 0), key('b', 1, 0)], [], 'MX').size).toBe(0)
})

it('flags a knob placed on top of a key', () => {
  expect(validate([key('a', 0, 0)], [{ id: 'knob', type: 'knob', x: 0.25, y: 0 }], 'MX').has('knob')).toBe(true)
})

it('finds no problems in any preset', () => {
  for (const make of Object.values(PRESETS)) expect(validate(make(), [], 'MX').size).toBe(0)
})
