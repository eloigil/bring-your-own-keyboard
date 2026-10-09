/** Layout units: 1u = one key width. See devpost/spec.md > Data Model. */
export type Unit = number

export interface Key {
  id: string
  x: Unit
  y: Unit
  w: Unit
  h: Unit
  /** Degrees, around the key's own center. */
  rot: number
  legend?: string
  override?: { switchId?: string; keycapColor?: string; profileId?: string }
  /** Painted LED hex color; undefined = not painted. */
  led?: string
}

export interface Component {
  id: string
  type: 'knob'
  x: Unit
  y: Unit
}

export type LedEffect = 'none' | 'breathing' | 'wave' | 'reactive'

export interface Design {
  version: 1
  keys: Key[]
  components: Component[]
  board: {
    switchId: string
    profileId: string
    keycapColor: string
    ledEffect: LedEffect
    /** Typing angle in degrees (back raised). */
    tiltDeg: number
    /** Colour the LED effect runs in. */
    ledColor: string
  }
  /** Pocket fills set by orbs (t: 0 = open, 1 = flush), anchored at the pocket's mouth (mm, layout coords). */
  pocketFills: { x: number; y: number; t: number }[]
}

export type Step = 'Layout' | 'Build' | 'LEDs' | 'Export'
