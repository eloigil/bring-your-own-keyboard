import { useDesign } from '../../store/design'

const CASE_COLORS = ['#ff8a1f', '#2b2b30', '#f4f2ec', '#2f4f7f', '#8fae8b', '#a68bd8', '#c8383e', '#2fb8b0']

export function ShapeOptions() {
  const selectedId = useDesign((s) => s.selectedId)
  const caseColor = useDesign((s) => s.design.board.caseColor)
  const { addKey, deleteKey, setKeycaps } = useDesign.getState()
  return (
    <section>
      <h3>Shape it</h3>
      <div className="row">
        <button className="tile" onClick={addKey}>+ Add key</button>
        <button className="tile" disabled={!selectedId} onClick={() => selectedId && deleteKey(selectedId)}>Delete key</button>
      </div>
      <p className="muted">Drag keys to reshape your board. Drag the purple orbs to fill or open the dips in the case.</p>
      <h3>Case colour</h3>
      <div className="swatches" aria-label="Case colour">
        {CASE_COLORS.map((c) => (
          <button key={c} className={`swatch ${c === caseColor ? 'active' : ''}`} style={{ background: c }} title={c} onClick={() => setKeycaps({ caseColor: c })} />
        ))}
        <input type="color" value={caseColor} onChange={(e) => setKeycaps({ caseColor: e.target.value })} title="Custom case colour" />
      </div>
    </section>
  )
}
