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
  /** Plate cutout [width, depth] in mm when it isn't the family's switch cutout (component footprints). */
  cut?: [number, number]
}

export type ComponentType = 'knob' | 'screen' | 'trackball' | 'joystick' | 'touchpad' | 'slider'

export interface Component {
  id: string
  type: ComponentType
  x: Unit
  y: Unit
  /** Degrees, around the part's own centre. */
  rot?: number
  /** The part's visible colour (knob body, trackball, joystick cap, screen bezel, touchpad frame, fader cap). */
  color?: string
}

export type KeycapMaterial = 'solid' | 'frosted' | 'clear'

export type LedEffect = 'none' | 'breathing' | 'wave' | 'rainbow' | 'pinwheel' | 'raindrops' | 'reactive' | 'ripple'

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
    /** Keycap plastic: solid (PBT/ABS), frosted (milky translucent) or clear (polycarbonate). */
    keycapMaterial: KeycapMaterial
    /** Switch housing colour. */
    switchColor: string
    /** Case colour (the top face). */
    caseColor: string
    /** Side walls, switch plate and bottom plate; unset = a lighter tint of the top. */
    wallColor?: string
    plateColor?: string
    bottomColor?: string
  }
  /** Pocket fills set by orbs (t: 0 = open, 1 = flush), anchored at the pocket's mouth (mm, layout coords). */
  pocketFills: { x: number; y: number; t: number }[]
}

export type Step = 'Layout' | 'Build' | 'LEDs' | 'Export'
