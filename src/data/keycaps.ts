/**
 * Keycap profiles: per-row height (mm) and top tilt (degrees; positive = top faces the typist),
 * rows from the back (R1) to the front. Approximations of the real profiles, enough to see the difference.
 */
export interface Profile {
  id: string
  name: string
  heights: number[]
  tilts: number[]
  /** How much smaller the top is than the base, per side (mm). */
  inset: number
}

export const PROFILES: Profile[] = [
  { id: 'cherry', name: 'Cherry', heights: [9.4, 8.5, 7.5, 7.2, 7.2], tilts: [8, 4, 0, -4, -6], inset: 2.4 },
  { id: 'oem', name: 'OEM', heights: [11.9, 10.6, 9.6, 9.3, 9.3], tilts: [9, 5, 1, -3, -5], inset: 2.5 },
  { id: 'sa', name: 'SA', heights: [14.9, 12.9, 12.4, 12.9, 13.5], tilts: [12, 6, 0, -6, -10], inset: 2.2 },
  { id: 'mt3', name: 'MT3', heights: [13.5, 11.5, 11, 11.5, 12.5], tilts: [11, 6, 0, -6, -9], inset: 2.6 },
  { id: 'kat', name: 'KAT', heights: [11.8, 10.2, 9.6, 9.6, 9.6], tilts: [8, 4, 0, -3, -5], inset: 2.3 },
  { id: 'dsa', name: 'DSA', heights: [7.6], tilts: [0], inset: 2.6 },
  { id: 'xda', name: 'XDA', heights: [9.1], tilts: [0], inset: 1.2 },
]

const byId = new Map(PROFILES.map((p) => [p.id, p]))
export const profileById = (id: string) => byId.get(id) ?? PROFILES[0]

/** Height and tilt for a row index (0 = back row); uniform profiles have one entry. */
export function rowShape(p: Profile, row: number) {
  const i = Math.max(0, Math.min(p.heights.length - 1, row))
  return { height: p.heights[i], tilt: p.tilts[i] }
}
