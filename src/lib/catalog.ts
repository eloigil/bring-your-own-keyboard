import switchData from '../data/switches.json'
import type { Family } from './units'

export interface Switch {
  id: string
  brand: string
  type: 'linear' | 'tactile' | 'clicky'
  model: string
  family: Family
  stemColor: string
  forceG: number
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
