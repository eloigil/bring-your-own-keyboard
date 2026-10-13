import { create } from 'zustand'
import { useDesign } from './design'
import type { Design } from '../types'
import type { PresetName } from '../lib/layout'

type Snapshot = { design: Design; preset: PresetName | null }

const LIMIT = 100
/** Changes closer together than this are one step: a drag, a slider sweep or a colour-picker scrub undoes as a whole. */
const MERGE_MS = 500

/** Undo / redo for the design. Watches the design store; the UI only reads `canUndo` / `canRedo`. */
export const useHistory = create<{ past: Snapshot[]; future: Snapshot[] }>(() => ({ past: [], future: [] }))

let applying = false // undo/redo writes the design itself; don't record that as a new change
let lastChange = 0

useDesign.subscribe((s, prev) => {
  if (s.design === prev.design || applying) return
  const now = performance.now()
  const merge = now - lastChange < MERGE_MS
  lastChange = now
  useHistory.setState((h) => ({
    past: merge && h.past.length ? h.past : [...h.past, { design: prev.design, preset: prev.preset }].slice(-LIMIT),
    future: [],
  }))
})

function step(from: 'past' | 'future') {
  const h = useHistory.getState()
  const target = h[from].at(-1)
  if (!target) return
  const { design, preset } = useDesign.getState()
  const to = from === 'past' ? 'future' : 'past'
  useHistory.setState({ [from]: h[from].slice(0, -1), [to]: [...h[to], { design, preset }] })
  applying = true
  useDesign.setState({ design: target.design, preset: target.preset })
  applying = false
  lastChange = 0 // the next edit starts a fresh step
}

export const undo = () => step('past')
export const redo = () => step('future')
