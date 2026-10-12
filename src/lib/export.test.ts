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

  it('adds the knob as an encoder (volume) and the effect as the default animation in its colour', () => {
    const d = design({ components: [{ id: 'k', type: 'knob', x: -3, y: -3 }], board: { ...defaultDesign().board, ledEffect: 'breathing', ledColor: '#ff0000' } })
    const f = fw(d) as { keyboardJson: Record<string, unknown>; keymapC: string }
    expect(f.keyboardJson.encoder).toBeDefined()
    expect(f.keymapC).toContain('KC_VOLU')
    expect((f.keyboardJson as { rgb_matrix: { default: { animation: string; hue: number } } }).rgb_matrix.default).toMatchObject({ animation: 'breathing', hue: 0 })
  })

  it('wires the other parts on a 60%: buses claim fixed pins, analog parts the ADC pins, the matrix avoids them (a TKL with all of them is 3 pins over)', () => {
    const parts = [
      { id: 's', type: 'screen' as const, x: -3, y: -3 },
      { id: 't', type: 'trackball' as const, x: -6, y: -3 },
      { id: 'j', type: 'joystick' as const, x: -9, y: -3 },
      { id: 'f', type: 'slider' as const, x: -14, y: -3 },
    ]
    const f = fw(design({ components: parts, board: { ...defaultDesign().board, ledEffect: 'ripple' } }, '60%')) as { keyboardJson: { features: Record<string, boolean>; matrix_pins: { rows: string[]; cols: string[] }; ws2812: { pin: string }; rgb_matrix: { default: { animation: string } } }; keymapC: string; extra: Record<string, string> }
    expect(f.keyboardJson.features).toMatchObject({ oled: true, pointing_device: true, joystick: true })
    const used = [...f.keyboardJson.matrix_pins.rows, ...f.keyboardJson.matrix_pins.cols, f.keyboardJson.ws2812.pin]
    for (const fixed of ['GP4', 'GP5', 'GP16', 'GP17', 'GP18', 'GP19', 'GP26', 'GP27', 'GP28']) expect(used).not.toContain(fixed)
    expect(f.keymapC).toContain('JOYSTICK_AXIS_IN(GP26')
    expect(f.keymapC).toContain('analogReadPin(GP28)')
    expect(f.extra['rules.mk']).toContain('pmw3360')
    expect(f.extra['config.h']).toContain('I2C1_SDA_PIN GP4')
    expect(f.keyboardJson.rgb_matrix.default.animation).toBe('solid_reactive_wide')
    const names = Object.keys(unzipSync(firmwareZip(f as never))).filter((n) => !n.endsWith('/'))
    expect(names).toContain('byokb/halconf.h')
  })

  it('refuses what one Pico cannot drive: two joysticks, or two pointing devices', () => {
    const two = (type: 'joystick' | 'trackball') => generateFirmware(design({ components: [{ id: 'a', type, x: -3, y: -3 }, { id: 'b', type, x: -6, y: -3 }] }))
    expect(two('joystick').ok).toBe(false)
    expect(two('trackball').ok).toBe(false)
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
