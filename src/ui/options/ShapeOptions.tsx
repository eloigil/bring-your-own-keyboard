import { useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { useDesign } from '../../store/design'
import { caseColors } from '../../scene/Case'

const CASE_COLORS = ['#ff8a1f', '#2b2b30', '#f4f2ec', '#2f4f7f', '#8fae8b', '#a68bd8', '#c8383e', '#2fb8b0', '#c9cdd4']
const PARTS = [
  { id: 'caseColor', label: 'Top' },
  { id: 'wallColor', label: 'Sides' },
  { id: 'plateColor', label: 'Plate' },
  { id: 'bottomColor', label: 'Bottom' },
] as const
type Part = (typeof PARTS)[number]['id']
const SHOWN = { caseColor: 'top', wallColor: 'wall', plateColor: 'plate', bottomColor: 'bottom' } as const

export function ShapeOptions() {
  const selectedId = useDesign((s) => s.selectedId)
  const board = useDesign((s) => s.design.board)
  const { addKey, deleteKey, setKeycaps } = useDesign.getState()
  const [part, setPart] = useState<Part>('caseColor')
  const shown = caseColors(board)[SHOWN[part]]
  const auto = part !== 'caseColor' && board[part] === undefined
  return (
    <section>
      <div className="row">
        <button className="button" onClick={addKey}><Plus size={14} weight="bold" /> Add key</button>
        <button className="button" disabled={!selectedId} onClick={() => selectedId && deleteKey(selectedId)}><Trash size={14} /> Delete key</button>
      </div>
      <p className="muted">Drag keys to reshape the board. Drag the orbs to fill or open the dips in the case.</p>
      <h3>Colour</h3>
      <div className="segmented" aria-label="Case part">
        {PARTS.map((p) => (
          <button key={p.id} className={part === p.id ? 'active' : ''} onClick={() => setPart(p.id)}>
            <span className="dot" style={{ background: caseColors(board)[SHOWN[p.id]], width: 9, height: 9, marginRight: 5, borderRadius: 3 }} />
            {p.label}
          </button>
        ))}
      </div>
      <div className="swatches" style={{ marginTop: 10 }} aria-label={`${PARTS.find((p) => p.id === part)!.label} colour`}>
        {part !== 'caseColor' && (
          <button className={`swatch eraser ${auto ? 'active' : ''}`} title="Auto: a lighter tint of the top" onClick={() => setKeycaps({ [part]: undefined })}>A</button>
        )}
        {CASE_COLORS.map((c) => (
          <button key={c} className={`swatch ${!auto && c === shown ? 'active' : ''}`} style={{ background: c }} title={c} onClick={() => setKeycaps({ [part]: c })} />
        ))}
        <input type="color" value={shown} onChange={(e) => setKeycaps({ [part]: e.target.value })} title="Custom colour" />
      </div>
    </section>
  )
}
