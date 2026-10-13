import { ArrowArcLeft, ArrowArcRight } from '@phosphor-icons/react'
import { redo, undo, useHistory } from '../store/history'

const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = mac ? '⌘' : 'Ctrl+'

/** Undo and redo; the shortcuts do the same: ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y). */
export function UndoRedo() {
  const canUndo = useHistory((h) => h.past.length > 0)
  const canRedo = useHistory((h) => h.future.length > 0)
  return (
    <>
      <button className="icon" onClick={undo} disabled={!canUndo} aria-label="Undo" title={`Undo (${mod}Z)`}><ArrowArcLeft size={18} /></button>
      <button className="icon" onClick={redo} disabled={!canRedo} aria-label="Redo" title={`Redo (${mac ? '⇧⌘Z' : 'Ctrl+Y'})`}><ArrowArcRight size={18} /></button>
    </>
  )
}
