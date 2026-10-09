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
}
