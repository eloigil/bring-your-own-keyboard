import { describe, expect, it } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { defaultDesign } from '../store/design'
import { PRESETS } from './layout'
import { firmwareZip, generateFirmware } from './qmk'
import { caseStl } from './exportStl'
import type { Design } from '../types'

const design = (patch: Partial<Design> = {}, preset: keyof typeof PRESETS = 'TKL'): Design => ({ ...defaultDesign(), keys: PRESETS[preset](), ...patch })
const fw = (d: Design) => {
  const r = generateFirmware(d)
  if (!r.ok) throw new Error(r.reason)
  return r.firmware
}

describe('QMK firmware', () => {
  it('lists every key once in the layout, each at its own matrix position', () => {
    const d = design()
    const { keyboardJson, matrix } = fw(d) as { keyboardJson: { layouts: { LAYOUT: { layout: { matrix: number[] }[] } } }; matrix: Map<string, number[]> }
    const layout = keyboardJson.layouts.LAYOUT.layout
    expect(layout).toHaveLength(d.keys.length)
    expect(new Set(layout.map((l) => l.matrix.join())).size).toBe(d.keys.length)
    expect(matrix.size).toBe(d.keys.length)
  })

  it('every preset fits one Raspberry Pi Pico, full size included, with knob and LEDs', () => {
    for (const name of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
      const d = design({ components: [{ id: 'k', type: 'knob', x: -3, y: -3 }], board: { ...defaultDesign().board, ledEffect: 'wave' } }, name)
      const r = generateFirmware(d)
      expect(r.ok, `${name}: ${!r.ok && r.reason}`).toBe(true)
    }
  })

  it('maps the legends to real keycodes (a TKL has no unknown keys except Fn)', () => {
    const c = fw(design()).keymapC
    expect(c).toContain('KC_ESC')
    expect(c).toContain('KC_LSFT')
    expect(c).toContain('KC_RSFT')
    expect(c).toContain('KC_SPC')
    expect(c).not.toContain('KC_NO')
    expect(fw(design({}, 'Full')).keymapC).toContain('KC_P7') // numpad digits are keypad codes
  })

  it('adds the knob as an encoder (volume) and painted keys as colours', () => {
    const d = design({ components: [{ id: 'k', type: 'knob', x: -3, y: -3 }] })
    d.keys[0] = { ...d.keys[0], led: '#ff0000' }
    const f = fw(d) as { keyboardJson: Record<string, unknown>; keymapC: string }
    expect(f.keyboardJson.encoder).toBeDefined()
    expect(f.keymapC).toContain('KC_VOLU')
    expect(f.keymapC).toContain('{ 0, 255, 0, 0 }')
    expect((f.keyboardJson as { rgb_matrix: { default: { animation: string } } }).rgb_matrix.default.animation).toBe('solid_color')
  })

  it('leaves RGB out entirely when the LEDs were never configured', () => {
    const json = fw(design()).keyboardJson as Record<string, unknown>
    expect(json.rgb_matrix).toBeUndefined()
    expect(json.ws2812).toBeUndefined()
  })

  it('zips keyboard.json, keymap.c and the README into one folder', () => {
    const files = unzipSync(firmwareZip(fw(design())))
    expect(Object.keys(files).filter((f) => !f.endsWith('/')).sort()).toEqual(['byokb/README.md', 'byokb/keyboard.json', 'byokb/keymaps/default/keymap.c'])
    expect(() => JSON.parse(strFromU8(files['byokb/keyboard.json']))).not.toThrow()
  })
})

describe('case STL', () => {
  it('parses back into a solid about as big as the board, lying flat (Z up)', () => {
    const buf = caseStl(design())!
    expect(buf.byteLength).toBeGreaterThan(10_000)
    const g = new STLLoader().parse(buf)
    g.computeBoundingBox()
    const size = g.boundingBox!.getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(350) // a TKL case is ~362 mm wide
    expect(size.x).toBeLessThan(380)
    expect(size.z).toBeLessThan(40) // height, not depth
    expect(g.boundingBox!.min.z).toBeCloseTo(0, 0) // sits on the print bed
  })
})
