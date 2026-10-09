import { describe, expect, it } from 'vitest'
import { defaultDesign, loadDesign, useDesign } from './design'
import { PRESETS, PRESET_CATEGORIES } from '../lib/layout'
import { validate } from '../lib/validate'

describe('loadDesign', () => {
  it('keeps a valid saved design', () => {
    const d = { ...defaultDesign(), keys: PRESETS['60%']() }
    expect(loadDesign(d)).toBe(d)
  })
  it('gives designs saved before the tilt slider the default angle', () => {
    const old = defaultDesign() as unknown as { board: Record<string, unknown> }
    delete old.board.tiltDeg
    expect(loadDesign(old).board.tiltDeg).toBe(6)
  })
  it('resets corrupt or old-version data to TKL', () => {
    for (const bad of [undefined, null, 'x', { version: 0 }, { ...defaultDesign(), keys: [{ id: 'a', x: NaN }] }])
      expect(loadDesign(bad).keys).toHaveLength(PRESETS.TKL().length)
  })
})

describe('presets', () => {
  it('every preset sits in exactly one category', () => {
    const listed = PRESET_CATEGORIES.flatMap((c) => c.presets)
    expect([...listed].sort()).toEqual(Object.keys(PRESETS).sort())
  })

  for (const [name, make] of Object.entries(PRESETS))
    it(`${name} has unique ids and no overlapping keys`, () => {
      const keys = make()
      expect(new Set(keys.map((k) => k.id)).size).toBe(keys.length)
      const bad = [...validate(keys, [], 'MX')].map((id) => keys.find((k) => k.id === id)?.legend)
      expect(bad, `${name} overlapping keys`).toEqual([])
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

describe('resizing the board', () => {
  it('snap mode swaps in the nearest standard size', () => {
    const s = useDesign.getState()
    s.setPreset('TKL')
    s.setSnapMode('snap')
    useDesign.getState().resizeTo(15.4)
    expect(useDesign.getState().preset).toBe('60%')
    useDesign.getState().resizeTo(21)
    expect(useDesign.getState().preset).toBe('Full')
  })
  it('freeform trims keys past the edge and keeps the rest', () => {
    const s = useDesign.getState()
    s.setPreset('TKL')
    s.setSnapMode('free')
    useDesign.getState().resizeTo(15)
    const { keys } = useDesign.getState().design
    expect(Math.max(...keys.map((k) => k.x + k.w))).toBeLessThanOrEqual(15)
    expect(useDesign.getState().preset).toBeNull()
  })
})
