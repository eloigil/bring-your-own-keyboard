import type { Component, Key } from '../types'
import { COMPONENTS, controllerOf } from '../data/components'
import { keyGroups, type CaseController } from './case'
import type { Family } from './units'

/** A row item: a key width, or a negative number for a gap of that size. */
type Row = { y: number; x?: number; items: (number | string)[] }

/** Snap a position to the 0.25u drag grid. */
export const snap = (v: number) => Math.round(v * 4) / 4

let nextId = 0
export const newId = () => `k${Date.now().toString(36)}${(nextId++).toString(36)}`

/**
 * Build keys from compact rows. Items: a number = key width, `-n` = gap of n,
 * a string `"w:legend"` or `"legend"` (1u) sets a legend.
 */
export function fromRows(rows: Row[], dx = 0): Key[] {
  const keys: Key[] = []
  for (const row of rows) {
    let x = (row.x ?? 0) + dx
    for (const item of row.items) {
      let w: number, legend: string | undefined
      if (typeof item === 'number') {
        if (item < 0) { x += -item; continue }
        w = item
      } else {
        const [a, b] = item.includes(':') ? item.split(':') : ['1', item]
        w = Number(a); legend = b
      }
      keys.push({ id: newId(), x, y: row.y, w, h: 1, rot: 0, legend })
      x += w
    }
  }
  return keys
}

/** Rotate keys (degrees) around a pivot in units, updating their centers and own rotation. */
export function rotateKeys(keys: Key[], deg: number, px: number, py: number): Key[] {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a)
  return keys.map((k) => {
    const cx = k.x + k.w / 2 - px, cy = k.y + k.h / 2 - py
    const nx = px + cx * c - cy * s, ny = py + cx * s + cy * c
    return { ...k, x: nx - k.w / 2, y: ny - k.h / 2, rot: k.rot + deg }
  })
}

const ones = (s: string) => s.split(' ')

export function tkl(): Key[] {
  return fromRows([
    { y: 0, items: ['Esc', -1, ...ones('F1 F2 F3 F4'), -0.5, ...ones('F5 F6 F7 F8'), -0.5, ...ones('F9 F10 F11 F12'), -0.25, ...ones('PrtSc ScrLk Pause')] },
    { y: 1.25, items: [...ones('` 1 2 3 4 5 6 7 8 9 0 - ='), '2:Bksp', -0.25, ...ones('Ins Home PgUp')] },
    { y: 2.25, items: ['1.5:Tab', ...ones('Q W E R T Y U I O P [ ]'), '1.5:\\', -0.25, ...ones('Del End PgDn')] },
    { y: 3.25, items: ['1.75:Caps', ...ones("A S D F G H J K L ; '"), '2.25:Enter'] },
    { y: 4.25, items: ['2.25:Shift', ...ones('Z X C V B N M , . /'), '2.75:Shift', -1.25, 'Up'] },
    { y: 5.25, items: ['1.25:Ctrl', '1.25:Win', '1.25:Alt', '6.25:Space', '1.25:Alt', '1.25:Fn', '1.25:Menu', '1.25:Ctrl', -0.25, ...ones('Left Down Right')] },
  ])
}

const NUM = ones('` 1 2 3 4 5 6 7 8 9 0 - =')
const QWE = ones('Q W E R T Y U I O P [ ]')
const ASD = ones("A S D F G H J K L ; '")
const ZXC = ones('Z X C V B N M , . /')

export function sixty(): Key[] {
  return fromRows([
    { y: 0, items: [...NUM, '2:Bksp'] },
    { y: 1, items: ['1.5:Tab', ...QWE, '1.5:\\'] },
    { y: 2, items: ['1.75:Caps', ...ASD, '2.25:Enter'] },
    { y: 3, items: ['2.25:Shift', ...ZXC, '2.75:Shift'] },
    { y: 4, items: ['1.25:Ctrl', '1.25:Win', '1.25:Alt', '6.25:Space', '1.25:Alt', '1.25:Fn', '1.25:Menu', '1.25:Ctrl'] },
  ])
}

const sixtyFiveRows = (y0: number) => [
  { y: y0, items: [...NUM, '2:Bksp', 'Del'] },
  { y: y0 + 1, items: ['1.5:Tab', ...QWE, '1.5:\\', 'PgUp'] },
  { y: y0 + 2, items: ['1.75:Caps', ...ASD, '2.25:Enter', 'PgDn'] },
  { y: y0 + 3, items: ['2.25:Shift', ...ZXC, '1.75:Shift', 'Up', 'End'] },
  { y: y0 + 4, items: ['1.25:Ctrl', '1.25:Win', '1.25:Alt', '6.25:Space', 'Alt', 'Fn', 'Ctrl', ...ones('Left Down Right')] },
]

export const sixtyFive = (): Key[] => fromRows(sixtyFiveRows(0))

export function seventyFive(): Key[] {
  return fromRows([{ y: 0, items: ['Esc', ...ones('F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 PrtSc Home')] }, ...sixtyFiveRows(1.25)])
}

/** A numpad block: +/Enter are 2u tall, 0 is 2u wide. */
function numpad(dx: number, y0: number): Key[] {
  const pad = fromRows([
    { y: y0, items: ones('NumLk / * -') },
    { y: y0 + 1, items: ones('7 8 9 +') },
    { y: y0 + 2, items: ones('4 5 6') },
    { y: y0 + 3, items: [...ones('1 2 3'), 'Ent'] },
    { y: y0 + 4, items: ['2:0', '.'] },
  ], dx)
  for (const k of pad) if (k.legend === '+' || k.legend === 'Ent') k.h = 2
  return pad
}

export const full = (): Key[] => [...tkl(), ...numpad(18.5, 1.25)]

export function forty(): Key[] {
  return fromRows([
    { y: 0, items: ['1.25:Tab', ...ones('Q W E R T Y U I O P'), '1.75:Bksp'] },
    { y: 1, items: ['1.5:Esc', ...ones('A S D F G H J K L'), '2.5:Enter'] },
    { y: 2, items: ['1.75:Shift', ...ones('Z X C V B N M , . /'), '1.25:Shift'] },
    { y: 3, items: ['1.25:Ctrl', '1.25:Win', '1.25:Alt', '6.25:Space', '1.25:Fn', '1.75:Ctrl'] },
  ])
}

/** 96%: a full layout squeezed together, no gaps. */
export function ninetySix(): Key[] {
  const keys = fromRows([
    { y: 0, items: ['Esc', ...ones('F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 PrtSc Del Home End PgUp PgDn')] },
    { y: 1, items: [...NUM, '2:Bksp', ...ones('NumLk / * -')] },
    { y: 2, items: ['1.5:Tab', ...QWE, '1.5:\\', ...ones('7 8 9 +')] },
    { y: 3, items: ['1.75:Caps', ...ASD, '2.25:Enter', ...ones('4 5 6')] },
    { y: 4, items: ['2.25:Shift', ...ZXC, '1.75:Shift', 'Up', ...ones('1 2 3 Ent')] },
    { y: 5, items: ['1.25:Ctrl', '1.25:Win', '1.25:Alt', '6.25:Space', 'Alt', 'Fn', 'Ctrl', ...ones('Left Down Right 0 .')] },
  ])
  for (const k of keys) if (k.legend === '+' || k.legend === 'Ent') k.h = 2
  return keys
}

/** Ortholinear grid from rows of legends, all 1u. */
const grid = (rows: string[]): Key[] => fromRows(rows.map((r, y) => ({ y, items: ones(r) })))

export const planck = () => grid(['Tab Q W E R T Y U I O P Bksp', "Esc A S D F G H J K L ; '", 'Shift Z X C V B N M , . / Ent', 'Fn Ctrl Alt Gui Lwr Spc Spc Rse Left Down Up Right'])
export const preonic = () => grid(['` 1 2 3 4 5 6 7 8 9 0 Bksp', ...['Tab Q W E R T Y U I O P Del', "Esc A S D F G H J K L ; '", 'Shift Z X C V B N M , . / Ent', 'Fn Ctrl Alt Gui Lwr Spc Spc Rse Left Down Up Right']])
export const orthoNumpad = () => grid(['NumLk / * -', '7 8 9 +', '4 5 6 =', '1 2 3 Ent', 'Fn 0 . Tab'])
export const numpadOnly = () => numpad(0, 0)
export const macropad = () => grid(['F13 F14 F15', 'F16 F17 F18', 'F19 F20 F21'])

/** Move `right` so its leftmost key sits `gap` units past the rightmost key of `left`. */
function sideBySide(left: Key[], right: Key[], gap: number): Key[] {
  const maxL = Math.max(...left.map((k) => k.x + k.w))
  const minR = Math.min(...right.map((k) => k.x))
  return [...left, ...right.map((k) => ({ ...k, x: k.x - minR + maxL + gap }))]
}

interface Thumb { x: number; y: number; rot?: number; w?: number }

/**
 * Column-staggered split. `rows` are the left half's legends (6 per row, outer pinky first),
 * `rRows` the right half's (reading left to right). `stagger[c]` drops column c (0 = outer pinky).
 * `thumbs` are extra left-half keys (thumb cluster, inner keys); the right half mirrors them.
 */
function columnar(rows: string[], rRows: string[], stagger: number[], thumbs: Thumb[], thumbLegends: string[], rThumbLegends: string[]): Key[] {
  const half = (mirror: boolean) => {
    const keys: Key[] = []
    const rowsHere = (mirror ? rRows : rows).map(ones)
    for (let col = 0; col < 6; col++) {
      const c = mirror ? 5 - col : col
      rowsHere.forEach((legends, row) => keys.push({ id: newId(), x: col, y: row + stagger[c], w: 1, h: 1, rot: 0, legend: legends[col] }))
    }
    thumbs.forEach((t, i) => {
      const w = t.w ?? 1
      keys.push({ id: newId(), x: mirror ? 6 - t.x - w : t.x, y: t.y, w, h: 1, rot: mirror ? -(t.rot ?? 0) : (t.rot ?? 0), legend: (mirror ? rThumbLegends : thumbLegends)[i] })
    })
    return keys
  }
  return sideBySide(half(false), half(true), 2.5)
}

const L4 = ['Esc 1 2 3 4 5', 'Tab Q W E R T', 'Ctrl A S D F G', 'Shift Z X C V B']
const R4 = ['6 7 8 9 0 -', 'Y U I O P Bksp', "H J K L ; '", 'N M , . / Shift']

/** Corne: 3x6 per half plus a 3-key thumb cluster, the outer thumb key angled. */
export const split = () =>
  columnar(L4.slice(1), R4.slice(1), [0.5, 0.5, 0.25, 0, 0.25, 0.35],
    [{ x: 3, y: 3.6 }, { x: 4, y: 3.6 }, { x: 5.2, y: 3.75, rot: 15 }], ['Gui', 'Lwr', 'Spc'], ['Alt', 'Spc', 'Ent'])

/** Lily58: 4x6 per half, an inner key on the bottom row, 4 thumb keys. */
export const lily58 = () =>
  columnar(L4, R4, [0.3, 0.3, 0.15, 0, 0.15, 0.25],
    [{ x: 6, y: 2.75 }, { x: 2.5, y: 4.35 }, { x: 3.5, y: 4.35 }, { x: 4.5, y: 4.35 }, { x: 5.6, y: 4.45, rot: 15 }],
    ['[', 'Alt', 'Gui', 'Lwr', 'Spc'], [']', 'Gui', 'Bksp', 'Rse', 'Ent'])

/** Sofle: 4x6 per half and a 5-key thumb row. */
export const sofle = () =>
  columnar(L4, R4, [0.4, 0.4, 0.2, 0, 0.2, 0.3],
    [{ x: 1, y: 4.5 }, { x: 2, y: 4.5 }, { x: 3, y: 4.5 }, { x: 4, y: 4.5 }, { x: 5.15, y: 4.6, rot: 12 }],
    ['Gui', 'Alt', 'Ctrl', 'Lwr', 'Spc'], ['Gui', 'Alt', 'Ctrl', 'Rse', 'Ent'])

/** Kyria: 3x6 per half with strong stagger and a 5-key thumb arc. */
export const kyria = () =>
  columnar(L4.slice(1), R4.slice(1), [0.6, 0.6, 0.25, 0, 0.25, 0.4],
    [{ x: 2.6, y: 3.5 }, { x: 3.7, y: 3.55, rot: 8 }, { x: 4.8, y: 3.75, rot: 16 }, { x: 5.85, y: 4.05, rot: 24 }, { x: 6.8, y: 4.5, rot: 32 }],
    ['Gui', 'Alt', 'Lwr', 'Spc', 'Ent'], ['Bksp', 'Ent', 'Rse', 'Alt', 'Gui'])

const aliceLeftRows = [
  { y: 0, items: ['Esc', ...ones('1 2 3 4 5 6')] },
  { y: 1, items: ['1.5:Tab', ...ones('Q W E R T')] },
  { y: 2, items: ['1.75:Caps', ...ones('A S D F G')] },
  { y: 3, items: ['2.25:Shift', ...ones('Z X C V B')] },
  { y: 4, x: 1.5, items: ['1.25:Alt', '2.25:Space'] },
]
const aliceRightRows = [
  { y: 0, items: [...ones('7 8 9 0 - ='), '2:Bksp'] },
  { y: 1, x: -0.5, items: [...ones('Y U I O P [ ]'), '1.5:\\'] },
  { y: 2, x: -0.25, items: [...ones("H J K L ; '"), '2.25:Enter'] },
  { y: 3, x: 0.25, items: [...ones('N M , . /'), '1.75:Shift', 'Fn'] },
  { y: 4, items: ['2.75:Space', -2.5, '1.25:Alt', '1.25:Ctrl'] },
]

/** Alice-style: one board, two halves angled toward each other. */
export function alice(): Key[] {
  return [...rotateKeys(fromRows(aliceLeftRows), 12, 7, 5), ...rotateKeys(fromRows(aliceRightRows, 9.6), -12, 9.6, 5)]
}

/** Arisu: an Alice with an extra navigation column on the far left. */
export function arisu(): Key[] {
  const nav = fromRows(ones('Ins Del PgUp PgDn').map((l, y) => ({ y, x: -1.25, items: [l] })))
  return [...rotateKeys([...nav, ...fromRows(aliceLeftRows)], 12, 7, 5), ...rotateKeys(fromRows(aliceRightRows, 9.6), -12, 9.6, 5)]
}

/** Row-staggered split: the Alice halves kept straight, pulled apart. */
export const rowSplit = (): Key[] => sideBySide(fromRows(aliceLeftRows), fromRows(aliceRightRows), 2.5)

export const PRESETS = {
  '40%': forty,
  '60%': sixty,
  '65%': sixtyFive,
  '75%': seventyFive,
  TKL: tkl,
  '96%': ninetySix,
  Full: full,
  Alice: alice,
  Arisu: arisu,
  'Row split': rowSplit,
  Corne: split,
  Lily58: lily58,
  Sofle: sofle,
  Kyria: kyria,
  Planck: planck,
  Preonic: preonic,
  'Ortho pad': orthoNumpad,
  Numpad: numpadOnly,
  Macropad: macropad,
} satisfies Record<string, () => Key[]>
export type PresetName = keyof typeof PRESETS

export const PRESET_CATEGORIES: { name: string; presets: PresetName[] }[] = [
  { name: 'Standard', presets: ['40%', '60%', '65%', '75%', 'TKL', '96%', 'Full'] },
  { name: 'Ergonomic', presets: ['Alice', 'Arisu', 'Row split'] },
  { name: 'Split columnar', presets: ['Corne', 'Lily58', 'Sofle', 'Kyria'] },
  { name: 'Ortholinear', presets: ['Planck', 'Preonic', 'Ortho pad'] },
  { name: 'Small', presets: ['Numpad', 'Macropad'] },
]

/**
 * Keycap row (0 = back) for each key, for sculpted profiles: rows are the board's rounded y positions,
 * and a board with more than 5 rows folds the extra back rows (e.g. a TKL's F-row) into row 0.
 */
export function keyRows(keys: Key[]): Map<string, number> {
  const rowOf = (k: Key) => Math.round(k.y + k.h / 2 - 0.5)
  const distinct = [...new Set(keys.map(rowOf))].sort((a, b) => a - b)
  const extra = Math.max(0, distinct.length - 5)
  return new Map(keys.map((k) => [k.id, Math.max(0, distinct.indexOf(rowOf(k)) - extra)]))
}

/** A component's footprint as a key, so the case, well, plate cutout and overlap checks treat it like one. */
export const componentFootprint = (c: Component): Key => {
  const b = c.type === 'controller' ? controllerOf(c) : null
  const [w, h] = b ? b.footprint : [COMPONENTS[c.type].w, COMPONENTS[c.type].h]
  return { id: c.id, x: c.x, y: c.y, w, h, rot: c.rot ?? 0, cut: b ? b.cut : COMPONENTS[c.type].cut }
}

/** The design's controller as the case needs it (where, and which board), if one is placed. */
export function caseController(components: Component[]): CaseController | undefined {
  const c = components.find((c) => c.type === 'controller')
  return c && { at: componentFootprint(c), board: controllerOf(c) }
}

/** Axis-aligned box around a (possibly rotated) key, in units. */
export function bounds(k: Key) {
  const a = (k.rot * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a))
  const hw = (k.w * c + k.h * s) / 2, hh = (k.w * s + k.h * c) / 2
  const cx = k.x + k.w / 2, cy = k.y + k.h / 2
  return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh }
}

/**
 * Make room for a component: in each row it overlaps, the keys from the first overlapping one rightward
 * shift right just enough to clear it. Other rows (and rotated keys) stay put.
 */
export function snapAside(keys: Key[], c: Component): Key[] {
  const eps = 1e-6
  const b = bounds(componentFootprint(c))
  const rows = new Map<number, Key[]>()
  for (const k of keys)
    if (k.rot === 0 && k.y < b.y1 - eps && k.y + k.h > b.y0 + eps) rows.set(k.y, [...(rows.get(k.y) ?? []), k])
  const shift = new Map<string, number>()
  for (const row of rows.values()) {
    const hit = row.filter((k) => k.x < b.x1 - eps && k.x + k.w > b.x0 + eps).sort((a, b) => a.x - b.x)[0]
    if (!hit) continue
    const by = snap(b.x1 - hit.x + 0.249)
    for (const k of row) if (k.x >= hit.x - eps) shift.set(k.id, by)
  }
  return shift.size ? keys.map((k) => (shift.has(k.id) ? { ...k, x: k.x + shift.get(k.id)! } : k)) : keys
}

/**
 * Keep separate case pieces separate: if a dropped component bridges two pieces (a split board's halves),
 * the piece it doesn't belong to slides away along x, a quarter unit at a time, until the pieces part again.
 */
export function pushApart(keys: Key[], c: Component, family: Family): Key[] {
  const before = keyGroups(keys, family)
  if (before.length < 2) return keys
  const fp = componentFootprint(c)
  const cx = c.x + fp.w / 2
  const dist = (k: Key) => Math.hypot(k.x + k.w / 2 - cx, k.y + k.h / 2 - (c.y + fp.h / 2))
  const nearest = keys.reduce((a, b) => (dist(a) <= dist(b) ? a : b))
  const home = before.find((g) => g.includes(nearest))!
  const ids = new Set(home.map((k) => k.id))
  let out = keys
  // ponytail: step-and-retest instead of solving the overlap exactly; a drop is rare and each test is cheap
  for (let step = 0; step < 40 && keyGroups([...out, fp], family).length < before.length; step++)
    out = out.map((k) => {
      if (ids.has(k.id)) return k
      const side = Math.sign(k.x + k.w / 2 - cx) || 1
      return { ...k, x: k.x + side * 0.25 }
    })
  return out
}

/**
 * Resize one key. A width change slides the keys to its right in the same row by the same amount,
 * so the row stays packed (growing never overlaps, shrinking leaves no gap). Height changes move nothing.
 */
export function resizeKey(keys: Key[], id: string, w: number, h: number): Key[] {
  const k = keys.find((k) => k.id === id)
  if (!k) return keys
  const dw = snap(w) - k.w
  return keys.map((o) => {
    if (o.id === id) return { ...o, w: snap(w), h: snap(h) }
    const rightOfIt = dw !== 0 && k.rot === 0 && o.rot === 0 && o.y === k.y && o.x >= k.x + k.w - 1e-6
    return rightOfIt ? { ...o, x: o.x + dw } : o
  })
}

const MAGNET = 0.35 // units: within this distance an edge snaps to a neighbour's edge

/**
 * Where a dragged item (w×h units) lands: flush against a nearby key's edge or aligned with its row/column
 * when within MAGNET, otherwise on the 0.25u grid. x and y snap independently. Rotated keys aren't magnets.
 */
export function magnetSnap(others: Key[], x: number, y: number, w: number, h: number): [number, number] {
  let bx = snap(x), by = snap(y), dx = MAGNET, dy = MAGNET
  for (const o of others) {
    if (o.rot !== 0) continue
    // only neighbours near enough to touch on the other axis count
    const nearY = y < o.y + o.h + MAGNET && y + h > o.y - MAGNET
    const nearX = x < o.x + o.w + MAGNET && x + w > o.x - MAGNET
    if (nearY)
      for (const c of [o.x + o.w, o.x - w, o.x, o.x + o.w - w]) {
        const d = Math.abs(c - x)
        if (d < dx) (dx = d), (bx = c)
      }
    if (nearX)
      for (const c of [o.y, o.y + o.h, o.y - h, o.y + o.h - h]) {
        const d = Math.abs(c - y)
        if (d < dy) (dy = d), (by = c)
      }
  }
  return [bx, by]
}
