import { describe, expect, it } from 'vitest'
import { defaultDesign, loadDesign } from './design'
import { PRESETS } from '../lib/layout'
import { keyCorners } from '../lib/case'

describe('loadDesign', () => {
  it('keeps a valid saved design', () => {
    const d = { ...defaultDesign(), keys: PRESETS['60%']() }
    expect(loadDesign(d)).toBe(d)
  })
  it('resets corrupt or old-version data to TKL', () => {
    for (const bad of [undefined, null, 'x', { version: 0 }, { ...defaultDesign(), keys: [{ id: 'a', x: NaN }] }])
      expect(loadDesign(bad).keys).toHaveLength(PRESETS.TKL().length)
  })
})

describe('presets', () => {
  for (const [name, make] of Object.entries(PRESETS))
    it(`${name} has unique ids and no overlapping keys`, () => {
      const keys = make()
      expect(new Set(keys.map((k) => k.id)).size).toBe(keys.length)
      // bounding boxes of the rotated footprints, shrunk slightly so touching keys don't count
      const boxes = keys.map((k) => {
        const c = keyCorners(k, 'MX', 0.5)
        const xs = c.map((p) => p[0]), ys = c.map((p) => p[1])
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
      })
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]]
          const overlap = a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
          expect(overlap, `${keys[i].legend} overlaps ${keys[j].legend}`).toBe(false)
        }
    })
})
