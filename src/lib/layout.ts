import type { Key } from '../types'

/** A row item: a key width, or a negative number for a gap of that size. */
type Row = { y: number; x?: number; items: (number | string)[] }

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

/** Column-staggered split: 6x3 per half plus a 3-key thumb cluster, the outer thumb key angled. */
export function split(): Key[] {
  const stagger = [0.5, 0.5, 0.25, 0, 0.25, 0.35]
  const legends = ['Tab Q W E R T', 'Ctrl A S D F G', 'Shift Z X C V B']
  const rLegends = ['Y U I O P Bksp', "H J K L ; '", 'N M , . / Shift']
  const half = (mirror: boolean, dx: number) => {
    const keys: Key[] = []
    for (let col = 0; col < 6; col++) {
      const c = mirror ? 5 - col : col
      for (let row = 0; row < 3; row++)
        keys.push({ id: newId(), x: dx + col, y: row + stagger[c], w: 1, h: 1, rot: 0, legend: (mirror ? rLegends : legends)[row].split(' ')[col] })
    }
    const thumbs = mirror
      ? [{ x: dx, rot: -15, l: 'Ent' }, { x: dx + 1, rot: 0, l: 'Spc' }, { x: dx + 2, rot: 0, l: 'Alt' }]
      : [{ x: dx + 3, rot: 0, l: 'Gui' }, { x: dx + 4, rot: 0, l: 'Lwr' }, { x: dx + 5, rot: 15, l: 'Spc' }]
    for (const t of thumbs) keys.push({ id: newId(), x: t.x, y: 3.6 + (t.rot ? 0.15 : 0), w: 1, h: 1, rot: t.rot, legend: t.l })
    return keys
  }
  return [...half(false, 0), ...half(true, 9)]
}

/** Alice-style: one board, two halves angled toward each other. */
export function alice(): Key[] {
  const left = fromRows([
    { y: 0, items: ['Esc', ...ones('1 2 3 4 5 6')] },
    { y: 1, items: ['1.5:Tab', ...ones('Q W E R T')] },
    { y: 2, items: ['1.75:Caps', ...ones('A S D F G')] },
    { y: 3, items: ['2.25:Shift', ...ones('Z X C V B')] },
    { y: 4, x: 1.5, items: ['1.25:Alt', '2.25:Space'] },
  ])
  const right = fromRows([
    { y: 0, items: [...ones('7 8 9 0 - ='), '2:Bksp'] },
    { y: 1, x: -0.5, items: [...ones('Y U I O P [ ]'), '1.5:\\'] },
    { y: 2, x: -0.25, items: [...ones("H J K L ; '"), '2.25:Enter'] },
    { y: 3, x: 0.25, items: [...ones('N M , . /'), '1.75:Shift', 'Fn'] },
    { y: 4, items: ['2.75:Space', -2.5, '1.25:Alt', '1.25:Ctrl'] },
  ], 9.6)
  return [...rotateKeys(left, 12, 7, 5), ...rotateKeys(right, -12, 9.6, 5)]
}
