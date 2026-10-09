import type { KeycapMaterial } from '../types'

export interface KeycapLook {
  name: string
  note: string
  roughness: number
  /** How much LED light the cap itself gives off. */
  glow: number
  /** See-through plastics (frosted, clear) are rendered with real transmission; solid is opaque. */
  glass?: {
    /** Light passing through is tinted by the cap colour over this distance (mm): smaller = stronger tint. */
    tintDistance: number
    /** Share of light passing through (1 = fully see-through). Below 1, the cap's own colour shows, like milky plastic. */
    transmission: number
    /** Surface reflections, relative to the faint scene environment. */
    reflections: number
    clearcoat: number
  }
}

/** How real keycap plastics look and pass the backlight. */
export const KEYCAP_MATERIALS: Record<KeycapMaterial, KeycapLook> = {
  solid: { name: 'Solid', note: 'PBT / ABS: blocks the light, which shows only in the gaps.', roughness: 0.7, glow: 0 },
  // the same see-through plastic as clear, but with a rough, bead-blasted surface: light gets through,
  // scattered, so the switch is a soft blur and the whole cap glows evenly
  frosted: {
    name: 'Frosted',
    note: 'Bead-blasted translucent: light gets through blurred, the whole cap glows evenly.',
    roughness: 0.55,
    glow: 0.75,
    // half transmission: the milky body colour carries the cap (white stays white), blurred light still gets through
    glass: { transmission: 0.5, tintDistance: 4, reflections: 4, clearcoat: 0 },
  },
  // smooth polycarbonate: light passes straight through, you see the switch and LED inside
  clear: {
    name: 'Clear',
    note: 'Polycarbonate: see-through to the switch and LED.',
    roughness: 0.07,
    glow: 0.4,
    glass: { transmission: 1, tintDistance: 7, reflections: 14, clearcoat: 1 },
  },
}
