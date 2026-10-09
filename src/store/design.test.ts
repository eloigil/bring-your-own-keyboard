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
  it('gives designs saved before transparency and switch colours the defaults: solid caps, dark housings', () => {
    const old = defaultDesign() as unknown as { board: Record<string, unknown> }
    delete old.board.keycapOpacity
    delete old.board.switchColor
    const d = loadDesign(old)
    expect([d.board.keycapOpacity, d.board.switchColor]).toEqual([1, '#2c2b31'])
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

describe('switches and keycaps', () => {
  it('a per-key override changes only that key, and reset clears it', () => {
    useDesign.getState().setPreset('TKL')
    const [a, b] = useDesign.getState().design.keys
    useDesign.getState().setOverride(a.id, { keycapColor: '#ff0000' })
    const keys = useDesign.getState().design.keys
    expect(keys.find((k) => k.id === a.id)!.override?.keycapColor).toBe('#ff0000')
    expect(keys.find((k) => k.id === b.id)!.override).toBeUndefined()
    useDesign.getState().setOverride(a.id, null)
    expect(useDesign.getState().design.keys.find((k) => k.id === a.id)!.override).toBeUndefined()
  })
  it('board-wide switch and keycaps are saved on the design', () => {
    useDesign.getState().setSwitch('kailh-choc-choc-brown')
    useDesign.getState().setKeycaps({ profileId: 'sa', keycapColor: '#123456' })
    const { board } = useDesign.getState().design
    expect([board.switchId, board.profileId, board.keycapColor]).toEqual(['kailh-choc-choc-brown', 'sa', '#123456'])
  })
})

describe('knob', () => {
  it('adds a knob clear of the keys; dropping it onto a row slides those keys aside', async () => {
    const { validate } = await import('../lib/validate')
    useDesign.getState().setPreset('TKL')
    useDesign.getState().addKnob()
    const knobId = useDesign.getState().selectedId!
    let d = useDesign.getState().design
    expect(validate(d.keys, d.components, 'MX').size).toBe(0)
    useDesign.getState().moveKey(knobId, 5.5, 1.25) // onto the number row
    d = useDesign.getState().design
    expect(validate(d.keys, d.components, 'MX').has(knobId)).toBe(true)
    useDesign.getState().dropComponent(knobId)
    d = useDesign.getState().design
    expect(validate(d.keys, d.components, 'MX').size).toBe(0)
    useDesign.getState().deleteKey(knobId)
    expect(useDesign.getState().design.components).toHaveLength(0)
  })
})

describe('LEDs', () => {
  it('are off until a key is painted or an effect is picked; turning them off resets both', async () => {
    const { ledsConfigured } = await import('./design')
    useDesign.getState().setPreset('TKL')
    useDesign.getState().clearLeds()
    expect(ledsConfigured(useDesign.getState().design)).toBe(false)
    const id = useDesign.getState().design.keys[0].id
    useDesign.getState().setLedBrush('#e5484d')
    useDesign.getState().paintKey(id)
    expect(useDesign.getState().design.keys[0].led).toBe('#e5484d')
    expect(ledsConfigured(useDesign.getState().design)).toBe(true)
    useDesign.getState().setLedBrush(null) // eraser
    useDesign.getState().paintKey(id)
    expect(ledsConfigured(useDesign.getState().design)).toBe(false)
    useDesign.getState().setLedEffect('wave')
    expect(ledsConfigured(useDesign.getState().design)).toBe(true)
    useDesign.getState().clearLeds()
    expect(ledsConfigured(useDesign.getState().design)).toBe(false)
  })
})
