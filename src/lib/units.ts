export type Family = 'MX' | 'Choc'

/** One key unit (1u) in mm, per switch family. */
export const PITCH: Record<Family, { x: number; y: number }> = {
  MX: { x: 19.05, y: 19.05 },
  Choc: { x: 18, y: 17 },
}

/** Square plate cutout size in mm. */
export const CUTOUT: Record<Family, number> = { MX: 14, Choc: 13.8 }

/** Case wall height in mm (low-profile switches need a shallower case). */
export const CASE_HEIGHT: Record<Family, number> = { MX: 15, Choc: 11 }

/** Plate top to keycap bottom, in mm. */
export const SWITCH_TRAVEL_HEIGHT: Record<Family, number> = { MX: 6.6, Choc: 3 }
