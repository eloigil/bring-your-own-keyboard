import type { ComponentType } from '../types'

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
  knob: { name: 'Knob', w: 1, h: 1, cut: [7.5, 7.5], bus: 'gpio', pins: 2, part: 'EC11 rotary encoder', note: 'Turns the volume; press to mute.', color: '#3a3940' },
  screen: { name: 'Screen', w: 2, h: 1, cut: [30, 12], bus: 'i2c', pins: 2, part: '0.91" 128×32 OLED (SSD1306)', note: 'Shows the active layer and a logo.', color: '#1d2a3a' },
  trackball: { name: 'Trackball', w: 2, h: 2, cut: [32, 32], bus: 'spi', pins: 4, part: '34 mm trackball on a PMW3360 sensor', note: 'Moves the mouse.', color: '#6b2a2f' },
  joystick: { name: 'Joystick', w: 1.5, h: 1.5, cut: [20, 20], bus: 'adc', pins: 2, part: 'Thumbstick (2-axis analog)', note: 'A gamepad axis pair.', color: '#4a4950' },
  touchpad: { name: 'Touchpad', w: 2.25, h: 2.25, cut: [36, 36], bus: 'i2c', pins: 2, part: 'Cirque 40 mm trackpad', note: 'Moves the mouse; tap to click.', color: '#2a2930' },
  slider: { name: 'Slider', w: 4, h: 1, cut: [64, 3], bus: 'adc', pins: 1, part: '60 mm slide potentiometer', note: 'A fader: volume by default.', color: '#26252c' },
}

export const COMPONENT_TYPES = Object.keys(COMPONENTS) as ComponentType[]
