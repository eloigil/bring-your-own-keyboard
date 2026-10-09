import switchData from '../data/switches.json'
import type { Family } from './units'

export type SoundProfile = 'thocky' | 'clacky' | 'creamy' | 'clicky' | 'muted'

export interface Switch {
  id: string
  brand: string
  type: 'linear' | 'tactile' | 'clicky'
  model: string
  family: Family
  stemColor: string
  /** Force (g) at the actuation point and when bottomed out. */
  actuationG: number
  bottomOutG: number
  /** Travel (mm) to actuation and to the bottom. */
  preTravel: number
  totalTravel: number
  /** Tactile bump / click: peak force (g) and where it happens (mm). */
  bump?: { peakG: number; atMm: number }
  sound: { profile: SoundProfile; pitch: 'deep' | 'mid' | 'high'; loudness: number }
  /** 1 (scratchy) – 5 (glassy smooth). */
  smoothness: number
  materials: { stem: string; topHousing: string; bottomHousing: string; spring: string; factoryLubed: boolean }
  housing: { tint: 'clear' | 'smoke' | 'solid'; top: string; bottom: string }
}

/** Best-effort catalog (public specs, hand-entered). See README. */
export const SWITCHES = switchData as Switch[]
const byId = new Map(SWITCHES.map((s) => [s.id, s]))
export const switchById = (id: string) => byId.get(id) ?? SWITCHES[0]
export const familyOf = (switchId: string): Family => switchById(switchId).family

/** Switches grouped "Brand · type" for the picker, in catalog order. */
export function switchGroups(filter?: (s: Switch) => boolean) {
  const groups = new Map<string, Switch[]>()
  for (const s of SWITCHES.filter(filter ?? (() => true))) {
    const label = `${s.brand} · ${s.type}`
    groups.set(label, [...(groups.get(label) ?? []), s])
  }
  return [...groups]
}

/**
 * Downstroke force curve (g over mm), modelled from the specs — not a measurement.
 * The spring is a straight line through actuation and bottom-out force; a tactile bump is an asymmetric hump
 * (slow rise, quicker drop) peaking at bump.atMm; a click drops sharply and dips below the spring; the last
 * fraction of a millimetre is the stem hitting the housing.
 */
export function forceCurve(s: Switch, samples = 80): [number, number][] {
  const k = (s.bottomOutG - s.actuationG) / (s.totalTravel - s.preTravel)
  const spring = (x: number) => Math.max(5, s.actuationG + k * (x - s.preTravel))
  const clicky = s.type === 'clicky'
  const pts: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * s.totalTravel
    let f = spring(x)
    if (s.bump) {
      const { peakG, atMm } = s.bump
      const h = peakG - spring(atMm)
      const w = x <= atMm ? atMm * 0.6 : clicky ? 0.06 : 0.3
      f += h * Math.exp(-(((x - atMm) / w) ** 2))
      if (clicky && x > atMm) f -= h * 0.35 * Math.exp(-(((x - atMm - 0.25) / 0.2) ** 2)) // the click's dip
    }
    const toBottom = s.totalTravel - x
    if (toBottom < 0.15) f += (1 - toBottom / 0.15) * s.bottomOutG * 0.5 // hitting the housing
    pts.push([x, Math.max(0, f)])
  }
  return pts
}
