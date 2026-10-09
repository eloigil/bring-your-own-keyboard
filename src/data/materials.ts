import type { KeycapMaterial } from '../types'

/**
 * How real keycap plastics look and pass the backlight.
 * `opacity`/`roughness` shape the cap; `glow` is how much LED light the cap itself gives off.
 */
export const KEYCAP_MATERIALS: Record<KeycapMaterial, { name: string; note: string; opacity: number; roughness: number; glow: number }> = {
  solid: { name: 'Solid', note: 'PBT / ABS: blocks the light, which shows only in the gaps.', opacity: 1, roughness: 0.7, glow: 0 },
  // milky plastic scatters the light, so the whole cap lights up evenly — brighter than clear
  frosted: { name: 'Frosted', note: 'Milky translucent: the whole cap glows evenly.', opacity: 0.88, roughness: 0.9, glow: 1.1 },
  // clear plastic lets light straight through: you see the LED and switch inside, the cap itself barely glows
  clear: { name: 'Clear', note: 'Polycarbonate: see-through to the switch and LED.', opacity: 1, roughness: 0.03, glow: 0.05 },
}
