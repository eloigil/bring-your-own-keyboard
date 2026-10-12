import { strToU8, zipSync } from 'fflate'
import * as THREE from 'three'
import type { Design, Key, LedEffect } from '../types'
import { switchById } from './catalog'
import { COMPONENTS } from '../data/components'
import type { ComponentType } from '../types'

/**
 * QMK firmware for a hand-wired Raspberry Pi Pico (RP2040), generated from the design.
 * There's no PCB yet, so the wiring is assumed: keys are packed into a near-square matrix so even a
 * full-size board fits the Pico's pins, and the README carries the key → row/column wiring table.
 * Docs: https://docs.qmk.fm/reference_info_json, /features/rgb_matrix, /features/encoders
 */

// Pico GPIOs usable for wiring (GP23–25 are on-board). Parts on a bus claim their fixed pins first, analog
// parts the ADC pins; the matrix takes free pins from the front, the LED data line and encoders from the back.
const PICO_PINS = [...Array.from({ length: 23 }, (_, i) => `GP${i}`), 'GP26', 'GP27', 'GP28']
const ADC_PINS = ['GP26', 'GP27', 'GP28']
const I2C = { sda: 'GP4', scl: 'GP5' }
const SPI = { sck: 'GP18', mosi: 'GP19', miso: 'GP16', cs: 'GP17' }

export interface Firmware {
  keyboardJson: object
  keymapC: string
  readme: string
  /** Extra files next to keyboard.json (config.h, halconf.h, mcuconf.h, rules.mk) when a part needs a bus. */
  extra: Record<string, string>
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

const hsv255 = (hex: string) => {
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(hex).getHSL(hsl)
  return { hue: Math.round(hsl.h * 255), sat: Math.round(Math.min(1, hsl.s * 1.2) * 255), val: 200 }
}

const EFFECT_ANIMATION: Record<Exclude<LedEffect, 'none'>, string> = {
  breathing: 'breathing', wave: 'cycle_left_right', rainbow: 'cycle_all', pinwheel: 'pinwheel', raindrops: 'raindrops',
  reactive: 'solid_reactive_simple', ripple: 'solid_reactive_wide',
}

export function generateFirmware(design: Design, name = 'byokb'): FirmwareResult {
  const keys = readingOrder(design.keys)
  if (!keys.length) return { ok: false, reason: 'Add some keys first.' }
  const parts = design.components
  const of = (type: ComponentType) => parts.filter((c) => c.type === type)
  const knobs = of('knob')
  const ledsOn = design.board.ledEffect !== 'none'
  const i2c = parts.some((c) => COMPONENTS[c.type].bus === 'i2c')
  const spi = parts.some((c) => COMPONENTS[c.type].bus === 'spi')
  const pointing = of('trackball').length + of('touchpad').length
  if (pointing > 1) return { ok: false, reason: 'QMK drives one pointing device: keep either one trackball or one touchpad.' }
  if (of('screen').length > 1) return { ok: false, reason: 'One screen: the OLED driver supports a single display.' }

  // analog parts share the three ADC pins
  const adc = [...ADC_PINS]
  const analogPins = parts.filter((c) => COMPONENTS[c.type].bus === 'adc').map((c) => ({ c, pins: adc.splice(0, COMPONENTS[c.type].pins) }))
  if (analogPins.some((a) => a.pins.length < COMPONENTS[a.c.type].pins))
    return { ok: false, reason: `The Pico has 3 analog pins: one joystick (2) and one slider (1), or one of each kind at most.` }

  // near-square matrix: fewest pins for n keys
  const taken = new Set([...(i2c ? Object.values(I2C) : []), ...(spi ? Object.values(SPI) : []), ...analogPins.flatMap((a) => a.pins)])
  const free = PICO_PINS.filter((p) => !taken.has(p))
  const rows = Math.ceil(Math.sqrt(keys.length))
  const cols = Math.ceil(keys.length / rows)
  const reserved = (ledsOn ? 1 : 0) + knobs.length * 2
  if (rows + cols + reserved > free.length)
    return { ok: false, reason: `Too many keys and parts for one Raspberry Pi Pico: needs ${rows + cols + reserved + taken.size} pins, it has ${PICO_PINS.length}.` }
  const rowPins = free.slice(0, rows)
  const colPins = free.slice(rows, rows + cols)
  const back = [...free].reverse()
  const ledPin = ledsOn ? back.shift()! : null
  const encoderPins = knobs.map(() => [back.shift()!, back.shift()!].reverse())
  const joystick = analogPins.find((a) => a.c.type === 'joystick')
  const slider = analogPins.find((a) => a.c.type === 'slider')
  const screen = of('screen').length > 0
  const trackball = of('trackball').length > 0
  const touchpad = of('touchpad').length > 0

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
    features: {
      bootmagic: true, extrakey: true, nkro: true,
      ...(ledsOn && { rgb_matrix: true }), ...(knobs.length && { encoder: true }),
      ...(screen && { oled: true }), ...(pointing && { pointing_device: true }), ...(joystick && { joystick: true }),
    },
    ...(ledsOn && {
      ws2812: { pin: ledPin, driver: 'vendor' },
      rgb_matrix: {
        driver: 'ws2812',
        animations: { [animation]: true },
        default: { animation, hue, sat, val },
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

  const partsC = [
    screen && `
// The screen shows the active layer.
bool oled_task_user(void) {
    oled_write_P(PSTR("BYOKb\n"), false);
    oled_write_P(PSTR("Layer: "), false);
    oled_write_ln(get_u8_str(get_highest_layer(layer_state), ' '), false);
    return false;
}
`,
    joystick && `
// Thumbstick: two analog axes (${joystick.pins.join(', ')}) reported as a gamepad.
joystick_config_t joystick_axes[JOYSTICK_AXIS_COUNT] = {
    JOYSTICK_AXIS_IN(${joystick.pins[0]}, 0, 512, 1023),
    JOYSTICK_AXIS_IN(${joystick.pins[1]}, 0, 512, 1023),
};
`,
    slider && `
// The slider is a volume fader: each step of its travel taps volume up or down.
#include "analog.h"
void housekeeping_task_user(void) {
    static uint16_t last = 0xFFFF;
    static uint32_t timer = 0;
    if (timer_elapsed32(timer) < 50) return;
    timer = timer_read32();
    uint16_t v = analogReadPin(${slider.pins[0]}) / 64; // 0..15
    if (last == 0xFFFF) last = v;
    while (v > last) { tap_code(KC_VOLU); last++; }
    while (v < last) { tap_code(KC_VOLD); last--; }
}
`,
  ].filter(Boolean).join('')
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
` : ''}${partsC}`

  // buses need ChibiOS config that keyboard.json can't carry
  const extra: Record<string, string> = {}
  if (i2c || spi || analogPins.length) {
    extra['halconf.h'] = `#pragma once
${i2c ? '#define HAL_USE_I2C TRUE\n' : ''}${spi ? '#define HAL_USE_SPI TRUE\n' : ''}${analogPins.length ? '#define HAL_USE_ADC TRUE\n' : ''}#include_next <halconf.h>
`
    extra['mcuconf.h'] = `#pragma once
#include_next <mcuconf.h>
${i2c ? '#undef RP_I2C_USE_I2C0\n#define RP_I2C_USE_I2C0 TRUE\n' : ''}${spi ? '#undef RP_SPI_USE_SPI0\n#define RP_SPI_USE_SPI0 TRUE\n' : ''}${analogPins.length ? '#undef RP_ADC_USE_ADC1\n#define RP_ADC_USE_ADC1 TRUE\n' : ''}`
    extra['config.h'] = `#pragma once
${i2c ? `#define I2C_DRIVER I2CD0\n#define I2C1_SDA_PIN ${I2C.sda}\n#define I2C1_SCL_PIN ${I2C.scl}\n` : ''}${spi ? `#define SPI_DRIVER SPID0\n#define SPI_SCK_PIN ${SPI.sck}\n#define SPI_MOSI_PIN ${SPI.mosi}\n#define SPI_MISO_PIN ${SPI.miso}\n#define PMW33XX_CS_PIN ${SPI.cs}\n` : ''}${touchpad ? '#define CIRQUE_PINNACLE_DIAMETER_MM 40\n#define CIRQUE_PINNACLE_TAP_ENABLE\n' : ''}${joystick ? '#define JOYSTICK_AXIS_COUNT 2\n#define JOYSTICK_BUTTON_COUNT 0\n#define JOYSTICK_AXIS_RESOLUTION 10\n' : ''}`
  }
  if (pointing) extra['rules.mk'] = `POINTING_DEVICE_DRIVER = ${trackball ? 'pmw3360' : 'cirque_pinnacle_i2c'}\n`

  const partLines = [
    ...knobs.map((_, i) => `- **Knob ${i + 1} (EC11 encoder):** A → ${encoderPins[i][0]}, B → ${encoderPins[i][1]}, C → GND`),
    screen && `- **Screen (${COMPONENTS.screen.part}):** SDA → ${I2C.sda}, SCL → ${I2C.scl}, VCC → 3V3, GND → GND`,
    touchpad && `- **Touchpad (${COMPONENTS.touchpad.part}, I²C):** SDA → ${I2C.sda}, SCL → ${I2C.scl}, VCC → 3V3, GND → GND`,
    trackball && `- **Trackball (${COMPONENTS.trackball.part}, SPI):** SCK → ${SPI.sck}, MOSI → ${SPI.mosi}, MISO → ${SPI.miso}, CS → ${SPI.cs}, VCC → 3V3, GND → GND`,
    joystick && `- **Joystick (${COMPONENTS.joystick.part}):** X → ${joystick.pins[0]}, Y → ${joystick.pins[1]}, VCC → 3V3, GND → GND`,
    slider && `- **Slider (${COMPONENTS.slider.part}):** wiper → ${slider.pins[0]}, ends → 3V3 and GND`,
  ].filter(Boolean).join('\n')

  const sw = switchById(design.board.switchId)
  const wiring = keys
    .map((k) => {
      const [r, c] = matrix.get(k.id)!
      return `| ${(k.legend ?? '(blank)').replace(/\|/g, '\\|')} | ${r} | ${c} | ${rowPins[r]} | ${colPins[c]} |`
    })
    .join('\n')
  const readme = `# ${name} — QMK firmware from BYOKb

Hand-wired keyboard on a **Raspberry Pi Pico (RP2040)** with ${sw.brand} ${sw.model} switches, ${keys.length} keys${parts.map((c) => `, ${COMPONENTS[c.type].name.toLowerCase()}`).join('')}${ledsOn ? ', per-key RGB' : ''}.

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
${ledPin ? `- **LED data:** ${ledPin}. Chain the LEDs (e.g. SK6812 MINI-E) in the order of the table below, 5 V and GND to every LED.\n` : ''}${partLines}

| Key | Row | Col | Row pin | Col pin |
|---|---|---|---|---|
${wiring}
`
  return { ok: true, firmware: { keyboardJson, keymapC, readme, matrix, extra } }
}

/** The firmware folder as a zip: <name>/keyboard.json, <name>/keymaps/default/keymap.c, <name>/README.md */
export function firmwareZip(fw: Firmware, name = 'byokb'): Uint8Array {
  return zipSync({
    [name]: {
      'keyboard.json': strToU8(JSON.stringify(fw.keyboardJson, null, 2)),
      'README.md': strToU8(fw.readme),
      ...Object.fromEntries(Object.entries(fw.extra).map(([name, text]) => [name, strToU8(text)])),
      keymaps: { default: { 'keymap.c': strToU8(fw.keymapC) } },
    },
  })
}
