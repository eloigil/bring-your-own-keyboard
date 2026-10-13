import { redo, undo, useHistory } from '../store/history'

const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = mac ? '⌘' : 'Ctrl+'

/** Top-right, beside the theme toggle. The shortcuts do the same: ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y). */
export function UndoRedo() {
  const canUndo = useHistory((h) => h.past.length > 0)
  const canRedo = useHistory((h) => h.future.length > 0)
  return (
    <div className="card undo-redo">
      <button onClick={undo} disabled={!canUndo} aria-label="Undo" title={`Undo (${mod}Z)`}>↶</button>
      <button onClick={redo} disabled={!canRedo} aria-label="Redo" title={`Redo (${mac ? '⇧⌘Z' : 'Ctrl+Y'})`}>↷</button>
    </div>
  )
}
