import { strToU8, zipSync } from 'fflate'
import * as THREE from 'three'
import type { Design, Key } from '../types'
import { switchById } from './catalog'

/**
 * QMK firmware for a hand-wired Raspberry Pi Pico (RP2040), generated from the design.
 * There's no PCB yet, so the wiring is assumed: keys are packed into a near-square matrix so even a
 * full-size board fits the Pico's pins, and the README carries the key → row/column wiring table.
 * Docs: https://docs.qmk.fm/reference_info_json, /features/rgb_matrix, /features/encoders
 */

// Pico GPIOs usable for wiring (GP23–25 are on-board). Matrix takes pins from the front,
// the LED data line and encoders from the back.
const PICO_PINS = [...Array.from({ length: 23 }, (_, i) => `GP${i}`), 'GP26', 'GP27', 'GP28']

export interface Firmware {
  keyboardJson: object
  keymapC: string
  readme: string
  /** key id → [row, col] */
  matrix: Map<string, [number, number]>
}

export type FirmwareResult = { ok: true; firmware: Firmware } | { ok: false; reason: string }

/** Keys in reading order: top row first, left to right (rows grouped within half a unit). */
function readingOrder(keys: Key[]) {
  return [...keys].sort((a, b) => (Math.abs(a.y - b.y) < 0.5 ? a.x - b.x : a.y - b.y))
}

// Legend → QMK keycode. Side-specific modifiers (Shift, Ctrl…) get L/R from the key's side of the board.
const SIMPLE: Record<string, string> = {
  Esc: 'KC_ESC', Tab: 'KC_TAB', Caps: 'KC_CAPS', Space: 'KC_SPC', Spc: 'KC_SPC', Enter: 'KC_ENT', Ent: 'KC_ENT',
  Bksp: 'KC_BSPC', Del: 'KC_DEL', Ins: 'KC_INS', Home: 'KC_HOME', End: 'KC_END', PgUp: 'KC_PGUP', PgDn: 'KC_PGDN',
  Left: 'KC_LEFT', Right: 'KC_RGHT', Up: 'KC_UP', Down: 'KC_DOWN', PrtSc: 'KC_PSCR', ScrLk: 'KC_SCRL', Pause: 'KC_PAUS',
  Menu: 'KC_APP', NumLk: 'KC_NUM', Fn: 'MO(1)', Lwr: 'MO(1)', Rse: 'MO(2)',
  '`': 'KC_GRV', '-': 'KC_MINS', '=': 'KC_EQL', '[': 'KC_LBRC', ']': 'KC_RBRC', '\\': 'KC_BSLS', ';': 'KC_SCLN',
  "'": 'KC_QUOT', ',': 'KC_COMM', '.': 'KC_DOT', '/': 'KC_SLSH',
}
const SIDED: Record<string, string> = { Shift: 'SFT', Ctrl: 'CTL', Alt: 'ALT', Win: 'GUI', Gui: 'GUI' }
const KEYPAD: Record<string, string> = { '/': 'KC_PSLS', '*': 'KC_PAST', '-': 'KC_PMNS', '+': 'KC_PPLS', '.': 'KC_PDOT', Ent: 'KC_PENT' }

export function keycode(k: Key, centerX: number, numpadX: number | null): string {
  const l = k.legend
  if (!l) return 'KC_NO'
  if (numpadX !== null && k.x >= numpadX - 0.01) {
    if (/^\d$/.test(l)) return `KC_P${l}`
    if (KEYPAD[l]) return KEYPAD[l]
  }
  if (/^[A-Z]$/.test(l)) return `KC_${l}`
  if (/^\d$/.test(l)) return `KC_${l}`
  if (/^F\d{1,2}$/.test(l)) return `KC_${l}`
  if (SIDED[l]) return `KC_${k.x + k.w / 2 < centerX ? 'L' : 'R'}${SIDED[l]}`
  return SIMPLE[l] ?? 'KC_NO'
}

const hexRgb = (hex: string) => {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b].map((v) => Math.round(v * 255))
}
const hsv255 = (hex: string) => {
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(hex).getHSL(hsl)
  return { hue: Math.round(hsl.h * 255), sat: Math.round(Math.min(1, hsl.s * 1.2) * 255), val: 200 }
}

const EFFECT_ANIMATION = { breathing: 'breathing', wave: 'cycle_left_right', reactive: 'solid_reactive_simple' } as const

export function generateFirmware(design: Design, name = 'byokb'): FirmwareResult {
  const keys = readingOrder(design.keys)
  if (!keys.length) return { ok: false, reason: 'Add some keys first.' }
  const knobs = design.components.filter((c) => c.type === 'knob')
  const ledsOn = design.board.ledEffect !== 'none' || keys.some((k) => k.led)

  // near-square matrix: fewest pins for n keys
  const rows = Math.ceil(Math.sqrt(keys.length))
  const cols = Math.ceil(keys.length / rows)
  const reserved = (ledsOn ? 1 : 0) + knobs.length * 2
  if (rows + cols + reserved > PICO_PINS.length)
    return { ok: false, reason: `Too many keys for one Raspberry Pi Pico: needs ${rows + cols + reserved} pins, it has ${PICO_PINS.length}.` }
  const rowPins = PICO_PINS.slice(0, rows)
  const colPins = PICO_PINS.slice(rows, rows + cols)
  const back = [...PICO_PINS].reverse()
  const ledPin = ledsOn ? back.shift()! : null
  const encoderPins = knobs.map(() => [back.shift()!, back.shift()!].reverse())

  const matrix = new Map(keys.map((k, i) => [k.id, [Math.floor(i / cols), i % cols] as [number, number]]))
  const minX = Math.min(...keys.map((k) => k.x)), minY = Math.min(...keys.map((k) => k.y))
  const maxX = Math.max(...keys.map((k) => k.x + k.w)), maxY = Math.max(...keys.map((k) => k.y + k.h))
  const r2 = (v: number) => Math.round(v * 100) / 100

  const layout = keys.map((k) => ({
    matrix: matrix.get(k.id),
    x: r2(k.x - minX),
    y: r2(k.y - minY),
    ...(k.w !== 1 && { w: k.w }),
    ...(k.h !== 1 && { h: k.h }),
    ...(k.rot && { r: k.rot, rx: r2(k.x - minX + k.w / 2), ry: r2(k.y - minY + k.h / 2) }),
    ...(k.legend && { label: k.legend }),
  }))

  // RGB matrix coordinates live in a 224×64 box
  const ledLayout = keys.map((k) => ({
    matrix: matrix.get(k.id),
    x: Math.round(((k.x + k.w / 2 - minX) / Math.max(maxX - minX, 1)) * 224),
    y: Math.round(((k.y + k.h / 2 - minY) / Math.max(maxY - minY, 1)) * 64),
    flags: 4,
  }))

  const effect = design.board.ledEffect
  const animation = effect === 'none' ? 'solid_color' : EFFECT_ANIMATION[effect]
  const { hue, sat, val } = hsv255(design.board.ledColor)

  const keyboardJson = {
    manufacturer: 'BYOKb',
    keyboard_name: name,
    maintainer: 'byokb',
    url: '',
    usb: { vid: '0xFEED', pid: '0xB10C', device_version: '1.0.0' },
    processor: 'RP2040',
    bootloader: 'rp2040',
    diode_direction: 'COL2ROW',
    matrix_pins: { rows: rowPins, cols: colPins },
    features: { bootmagic: true, extrakey: true, nkro: true, ...(ledsOn && { rgb_matrix: true }), ...(knobs.length && { encoder: true }) },
    ...(ledsOn && {
      ws2812: { pin: ledPin, driver: 'vendor' },
      rgb_matrix: {
        driver: 'ws2812',
        animations: { [animation]: true },
        // with no effect, the board stays dark except the painted keys (set in keymap.c)
        default: { animation, hue, sat, val: effect === 'none' ? 0 : val },
        layout: ledLayout,
      },
    }),
    ...(knobs.length && { encoder: { rotary: encoderPins.map(([a, b]) => ({ pin_a: a, pin_b: b })) } }),
    layouts: { LAYOUT: { layout } },
  }

  const centerX = (minX + maxX) / 2
  const numLk = keys.find((k) => k.legend === 'NumLk')
  const codes = keys.map((k) => keycode(k, centerX, numLk ? numLk.x : null))
  const usesLayer = (n: number) => codes.some((c) => c === `MO(${n})`)
  const layerCount = usesLayer(2) ? 3 : usesLayer(1) ? 2 : 1
  const perLine = (list: string[]) => list.map((c, i) => (i % 10 === 0 ? '\n        ' : ' ') + c + ',').join('').replace(/,$/, '')
  const layers = Array.from({ length: layerCount }, (_, n) =>
    `    [${n}] = LAYOUT(${perLine(n === 0 ? codes : codes.map(() => '_______'))}\n    )`,
  ).join(',\n')

  const painted = keys.map((k, i) => (k.led ? `        { ${i}, ${hexRgb(k.led).join(', ')} },` : null)).filter(Boolean)
  const keymapC = `// Generated by BYOKb. Layer 0 follows the key legends; extra layers are left transparent for you to fill.
#include QMK_KEYBOARD_H

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
${layers}
};
${knobs.length ? `
// The knob turns the volume.
bool encoder_update_user(uint8_t index, bool clockwise) {
    tap_code(clockwise ? KC_VOLU : KC_VOLD);
    return false;
}
` : ''}${painted.length ? `
// Keys painted in BYOKb keep their colour on top of the effect. { led index, r, g, b }
static const uint8_t painted[][4] = {
${painted.join('\n')}
};

bool rgb_matrix_indicators_advanced_user(uint8_t led_min, uint8_t led_max) {
    for (uint8_t i = 0; i < sizeof(painted) / sizeof(painted[0]); i++) {
        RGB_MATRIX_INDICATOR_SET_COLOR(painted[i][0], painted[i][1], painted[i][2], painted[i][3]);
    }
    return false;
}
` : ''}`

  const sw = switchById(design.board.switchId)
  const wiring = keys
    .map((k) => {
      const [r, c] = matrix.get(k.id)!
      return `| ${(k.legend ?? '(blank)').replace(/\|/g, '\\|')} | ${r} | ${c} | ${rowPins[r]} | ${colPins[c]} |`
    })
    .join('\n')
  const readme = `# ${name} — QMK firmware from BYOKb

Hand-wired keyboard on a **Raspberry Pi Pico (RP2040)** with ${sw.brand} ${sw.model} switches, ${keys.length} keys${knobs.length ? `, ${knobs.length} knob` : ''}${ledsOn ? ', per-key RGB' : ''}.

> Generated, not hand-tuned: run \`qmk lint -kb ${name}\` before your first build. The wiring below is an
> assumed hand-wire layout (there is no PCB yet) — follow it exactly, or change \`matrix_pins\` to match yours.

## Build and flash

1. Install QMK: https://docs.qmk.fm/newbs_getting_started
2. Copy this folder to \`qmk_firmware/keyboards/${name}\`
3. \`qmk compile -kb ${name} -km default\`
4. Hold the Pico's **BOOTSEL** button while plugging it in, then drag the \`.uf2\` file onto the drive that appears.

## Wiring

- **Matrix:** ${rows} rows × ${cols} columns, diodes **COL2ROW** (the diode's black band points toward the row wire).
- **Row pins:** ${rowPins.join(', ')}
- **Column pins:** ${colPins.join(', ')}
${ledPin ? `- **LED data:** ${ledPin}. Chain the LEDs (e.g. SK6812 MINI-E) in the order of the table below, 5 V and GND to every LED.\n` : ''}${knobs.map((_, i) => `- **Knob ${i + 1} (EC11 encoder):** A → ${encoderPins[i][0]}, B → ${encoderPins[i][1]}, C → GND`).join('\n')}

| Key | Row | Col | Row pin | Col pin |
|---|---|---|---|---|
${wiring}
`
  return { ok: true, firmware: { keyboardJson, keymapC, readme, matrix } }
}

/** The firmware folder as a zip: <name>/keyboard.json, <name>/keymaps/default/keymap.c, <name>/README.md */
export function firmwareZip(fw: Firmware, name = 'byokb'): Uint8Array {
  return zipSync({
    [name]: {
      'keyboard.json': strToU8(JSON.stringify(fw.keyboardJson, null, 2)),
      'README.md': strToU8(fw.readme),
      keymaps: { default: { 'keymap.c': strToU8(fw.keymapC) } },
    },
  })
}
