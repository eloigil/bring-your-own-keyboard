import { describe, expect, it } from 'vitest'
import { SWITCHES, familyOf, forceCurve, switchById } from './catalog'
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
      expect(s.actuationG).toBeGreaterThan(10)
      expect(s.bottomOutG).toBeGreaterThanOrEqual(s.actuationG)
      expect(s.totalTravel).toBeGreaterThan(s.preTravel)
      expect(['thocky', 'clacky', 'creamy', 'clicky', 'muted']).toContain(s.sound.profile)
      expect(s.materials.stem).toBeTruthy()
      // tactile and clicky switches have a bump, linear ones don't
      expect(!!s.bump).toBe(s.type !== 'linear')
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

describe('force curves', () => {
  it('a linear curve only rises, from below actuation up past the bottom-out force', () => {
    const c = forceCurve(switchById('gateron-oil-king'))
    for (let i = 1; i < c.length; i++) expect(c[i][1]).toBeGreaterThanOrEqual(c[i - 1][1] - 1e-9)
    expect(c[0][1]).toBeLessThan(55)
    expect(c.at(-1)![1]).toBeGreaterThanOrEqual(65)
  })
  it('a tactile curve peaks at its bump, then drops before rising again', () => {
    const s = switchById('drop-holy-panda-x')
    const c = forceCurve(s)
    const peak = c.reduce((m, p) => (p[0] < s.preTravel && p[1] > m[1] ? p : m), [0, 0])
    expect(peak[1]).toBeCloseTo(s.bump!.peakG, -1)
    expect(peak[0]).toBeCloseTo(s.bump!.atMm, 0)
    const after = c.find((p) => p[0] > s.bump!.atMm + 0.5)!
    expect(after[1]).toBeLessThan(peak[1])
  })
  it('a clicky curve dips below the spring line right after the click', () => {
    const s = switchById('cherry-mx-blue')
    const c = forceCurve(s)
    const k = (s.bottomOutG - s.actuationG) / (s.totalTravel - s.preTravel)
    const dip = c.find((p) => p[0] > s.bump!.atMm + 0.2 && p[0] < s.bump!.atMm + 0.35)!
    expect(dip[1]).toBeLessThan(s.actuationG + k * (dip[0] - s.preTravel))
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
