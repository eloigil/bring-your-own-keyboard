import { useState } from 'react'
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
      <h3>Shape it</h3>
      <div className="row">
        <button className="tile" onClick={addKey}>+ Add key</button>
        <button className="tile" disabled={!selectedId} onClick={() => selectedId && deleteKey(selectedId)}>Delete key</button>
      </div>
      <p className="muted">Drag keys to reshape your board. Drag the purple orbs to fill or open the dips in the case.</p>
      <h3>Case colour</h3>
      <div className="chips" aria-label="Case part">
        {PARTS.map((p) => (
          <button key={p.id} className={`chip ${part === p.id ? 'active' : ''}`} onClick={() => setPart(p.id)}>
            <span className="dot" style={{ background: caseColors(board)[SHOWN[p.id]], marginRight: 6 }} />
            {p.label}
          </button>
        ))}
      </div>
      <div className="swatches" aria-label={`${PARTS.find((p) => p.id === part)!.label} colour`}>
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
