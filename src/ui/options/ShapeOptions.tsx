import { useDesign } from '../../store/design'

export function ShapeOptions() {
  const selectedId = useDesign((s) => s.selectedId)
  const mode = useDesign((s) => s.design.board.snap)
  const { addKey, deleteKey, setSnapMode } = useDesign.getState()
  return (
    <section>
      <h3>Shape it</h3>
      <div className="row">
        <button className="tile" onClick={addKey}>+ Add key</button>
        <button className="tile" disabled={!selectedId} onClick={() => selectedId && deleteKey(selectedId)}>Delete key</button>
      </div>
      <p className="muted">Drag keys to reshape your board. Drag the purple orbs to fill or open the dips in the case.</p>
      <h3>Resize</h3>
      <div className="row">
        <button className={`tile ${mode === 'snap' ? 'active' : ''}`} onClick={() => setSnapMode('snap')}>Snap to sizes</button>
        <button className={`tile ${mode === 'free' ? 'active' : ''}`} onClick={() => setSnapMode('free')}>Freeform</button>
      </div>
      <p className="muted">
        Drag the purple handle on the board's right edge. {mode === 'snap' ? 'Snap jumps between 60%, 65%, 75%, TKL and Full (this swaps in that layout).' : 'Freeform removes keys past the edge, or adds keys in the new space.'}
      </p>
    </section>
  )
}
