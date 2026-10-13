import type { Component, ComponentType, ControllerId } from '../types'

/**
 * Parts that aren't keys. Footprint in key units (what the case and overlap checks reserve), the plate
 * cutout in mm, and how the firmware wires it (which Pico pins it claims). Sizes are typical modules.
 */
export const COMPONENTS: Record<ComponentType, {
  name: string
  /** Footprint, in key units. */
  w: number
  h: number
  /** Plate cutout [width, depth] in mm. */
  cut: [number, number]
  /** Bus the part uses; shared buses have fixed pins, 'gpio' takes free pins, 'adc' takes analog pins. */
  bus: 'gpio' | 'i2c' | 'spi' | 'adc'
  /** Pins taken: count for gpio/adc, fixed for i2c/spi. */
  pins: number
  part: string
  note: string
  /** Default colour of the part's visible piece. */
  color: string
}> = {
  controller: { name: 'Controller', w: 1.25, h: 3.25, cut: [23, 53], bus: 'gpio', pins: 0, part: 'RP2040 controller board', note: 'Runs the firmware. Shows through a window in the plate; the case gets a USB opening where its USB end points. Rotate it to choose the wall.', color: '#2e6b3c' },
  knob: { name: 'Knob', w: 1, h: 1, cut: [7.5, 7.5], bus: 'gpio', pins: 2, part: 'EC11 rotary encoder', note: 'Turns the volume; press to mute.', color: '#3a3940' },
  screen: { name: 'Screen', w: 2, h: 1, cut: [30, 12], bus: 'i2c', pins: 2, part: '0.91" 128×32 OLED (SSD1306)', note: 'Shows the active layer and a logo.', color: '#1d2a3a' },
  trackball: { name: 'Trackball', w: 2, h: 2, cut: [32, 32], bus: 'spi', pins: 4, part: '34 mm trackball on a PMW3360 sensor', note: 'Moves the mouse.', color: '#6b2a2f' },
  joystick: { name: 'Joystick', w: 1.5, h: 1.5, cut: [20, 20], bus: 'adc', pins: 2, part: 'Thumbstick (2-axis analog)', note: 'A gamepad axis pair.', color: '#4a4950' },
  touchpad: { name: 'Touchpad', w: 2.25, h: 2.25, cut: [36, 36], bus: 'i2c', pins: 2, part: 'Cirque 40 mm trackpad', note: 'Moves the mouse; tap to click.', color: '#2a2930' },
  slider: { name: 'Slider', w: 4, h: 1, cut: [64, 3], bus: 'adc', pins: 1, part: '60 mm slide potentiometer', note: 'A fader: volume by default.', color: '#26252c' },
}

export const COMPONENT_TYPES = Object.keys(COMPONENTS) as ComponentType[]

/**
 * Controller boards, smallest to largest. All RP2040, so one firmware; they differ in size, USB socket, how they
 * mount, and which pins reach the outside. Sizes and pin maps from the makers' docs:
 * Seeed wiki (XIAO RP2040), Waveshare wiki (RP2040-Zero), Raspberry Pi datasheet (Pico).
 */
export interface ControllerBoard {
  name: string
  /** Label on the size slider. */
  short: string
  /** Board size across × along, mm; the USB end is along. */
  w: number
  l: number
  pcb: number
  usb: 'micro-USB' | 'USB-C'
  /** Height of the USB socket above the board, mm. */
  usbH: number
  /** M2 mounting holes in the board's frame (x across, y along), or null: it sits in a printed tray instead. */
  holes: [number, number][] | null
  /** Footprint on the board in key units (fits both MX and Choc pitch with clearance), and the plate window, mm. */
  footprint: [number, number]
  cut: [number, number]
  /** GPIOs on the edge pins, in the order the matrix takes them; analog pins; bus pins (peripheral number + pins). */
  pins: string[]
  adc: string[]
  i2c: { n: 0 | 1; sda: string; scl: string }
  spi: { n: 0 | 1; sck: string; mosi: string; miso: string; cs: string }
  boot: string
  color: string
}

const gp = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `GP${from + i}`)

export const CONTROLLERS: Record<ControllerId, ControllerBoard> = {
  xiao: {
    name: 'Seeed XIAO RP2040', short: 'XIAO', w: 17.8, l: 21, pcb: 1, usb: 'USB-C', usbH: 3.2, holes: null,
    footprint: [1.25, 1.5], cut: [19.8, 23],
    // D0–D10: GP26–29, GP6, GP7, GP0–GP4 (GP5 isn't broken out)
    pins: ['GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP6', 'GP7', 'GP26', 'GP27', 'GP28', 'GP29'],
    adc: ['GP26', 'GP27', 'GP28', 'GP29'],
    i2c: { n: 1, sda: 'GP6', scl: 'GP7' },
    spi: { n: 0, sck: 'GP2', mosi: 'GP3', miso: 'GP4', cs: 'GP1' },
    boot: 'B (BOOT)', color: '#26272c',
  },
  zero: {
    name: 'Waveshare RP2040-Zero', short: 'Zero', w: 18, l: 23.5, pcb: 1, usb: 'USB-C', usbH: 3.2, holes: null,
    footprint: [1.25, 1.5], cut: [20, 25.5],
    // edge pins only: GP0–GP15 and GP26–GP29 (GP17–GP25 are solder pads underneath; GP16 drives the on-board LED)
    pins: [...gp(0, 15), ...gp(26, 29)],
    adc: ['GP26', 'GP27', 'GP28', 'GP29'],
    i2c: { n: 0, sda: 'GP4', scl: 'GP5' },
    spi: { n: 1, sck: 'GP10', mosi: 'GP11', miso: 'GP12', cs: 'GP13' },
    boot: 'BOOT', color: '#1f1f24',
  },
  pico: {
    name: 'Raspberry Pi Pico', short: 'Pico', w: 21, l: 51, pcb: 1, usb: 'micro-USB', usbH: 2.6,
    holes: [[-5.7, -23.5], [5.7, -23.5], [-5.7, 23.5], [5.7, 23.5]], // 11.4 mm apart across, 47 mm along
    footprint: [1.25, 3.25], cut: [23, 53],
    pins: [...gp(0, 22), ...gp(26, 28)], // GP23–25 are used on the board
    adc: ['GP26', 'GP27', 'GP28'],
    i2c: { n: 0, sda: 'GP4', scl: 'GP5' },
    spi: { n: 0, sck: 'GP18', mosi: 'GP19', miso: 'GP16', cs: 'GP17' },
    boot: 'BOOTSEL', color: '#2e6b3c',
  },
}
export const CONTROLLER_ORDER: ControllerId[] = ['xiao', 'zero', 'pico']
/** The board a controller part uses; the Pico when unset (and for designs without a controller). */
export const controllerOf = (c?: Component) => CONTROLLERS[c?.model ?? 'pico']
/** A part's colour: its own, else the default for its type (or its controller board). */
export const partColor = (c: Component) => c.color ?? (c.type === 'controller' ? controllerOf(c).color : COMPONENTS[c.type].color)
