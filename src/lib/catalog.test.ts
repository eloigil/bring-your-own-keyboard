import { describe, expect, it } from 'vitest'
import { SWITCHES, familyOf, switchById } from './catalog'
import { PROFILES, rowShape } from '../data/keycaps'
import { area, caseOutline } from './case'
import { keyRows, tkl } from './layout'

describe('switch catalog', () => {
  it('has unique ids, a valid family, type, colour and force for every switch', () => {
    expect(new Set(SWITCHES.map((s) => s.id)).size).toBe(SWITCHES.length)
    for (const s of SWITCHES) {
      expect(['MX', 'Choc']).toContain(s.family)
      expect(['linear', 'tactile', 'clicky']).toContain(s.type)
      expect(s.stemColor).toMatch(/^#[0-9a-f]{6}$/)
      expect(s.forceG).toBeGreaterThan(10)
    }
  })
  it('knows the default switch and both families', () => {
    expect(switchById('cherry-mx-red').model).toBe('MX Red')
    expect(familyOf('kailh-choc-choc-brown')).toBe('Choc')
  })
  it('a Choc case is smaller than an MX case for the same layout', () => {
    const keys = tkl()
    const size = (f: 'MX' | 'Choc') => caseOutline(keys, f).reduce((n, r) => n + area(r), 0)
    expect(size('Choc')).toBeLessThan(size('MX') * 0.92)
  })
})

describe('keycap profiles', () => {
  it('every profile has matching heights and tilts', () => {
    for (const p of PROFILES) expect(p.heights).toHaveLength(p.tilts.length)
  })
  it('sculpted rows: a TKL folds its F-row into the top row and its spacebar row is the bottom', () => {
    const keys = tkl()
    const rows = keyRows(keys)
    const at = (l: string) => rows.get(keys.find((k) => k.legend === l)!.id)
    expect(at('Esc')).toBe(0)
    expect(at('1')).toBe(0)
    expect(at('A')).toBe(2)
    expect(at('Space')).toBe(4)
    const sa = PROFILES.find((p) => p.id === 'sa')!
    expect(rowShape(sa, at('1')!).height).toBeGreaterThan(rowShape(sa, at('A')!).height)
  })
})
