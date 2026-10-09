import { describe, expect, it } from 'vitest'
import { defaultDesign, loadDesign, useDesign } from './design'
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

describe('key editing', () => {
  it('snaps moved keys to the 0.25u grid', () => {
    const id = useDesign.getState().design.keys[0].id
    useDesign.getState().moveKey(id, 3.13, 7.9)
    const k = useDesign.getState().design.keys.find((k) => k.id === id)!
    expect([k.x, k.y]).toEqual([3.25, 8])
  })
  it('adds and deletes keys', () => {
    const n = useDesign.getState().design.keys.length
    useDesign.getState().addKey()
    const id = useDesign.getState().selectedId!
    expect(useDesign.getState().design.keys).toHaveLength(n + 1)
    useDesign.getState().deleteKey(id)
    expect(useDesign.getState().design.keys).toHaveLength(n)
  })
  it('keeps one saved fill per pocket', () => {
    useDesign.getState().setPocketFill(100, 50, 3)
    useDesign.getState().setPocketFill(105, 50, 6)
    expect(useDesign.getState().design.pocketFills).toEqual([{ x: 105, y: 50, t: 6 }])
  })
})
