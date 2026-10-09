import { useDesign } from '../../store/design'

export function ShapeOptions() {
  const selectedId = useDesign((s) => s.selectedId)
  const { addKey, deleteKey } = useDesign.getState()
  return (
    <section>
      <h3>Shape it</h3>
      <div className="row">
        <button className="tile" onClick={addKey}>+ Add key</button>
        <button className="tile" disabled={!selectedId} onClick={() => selectedId && deleteKey(selectedId)}>Delete key</button>
      </div>
      <p className="muted">Drag keys to reshape your board. Drag the purple orbs to fill or open the dips in the case.</p>
    </section>
  )
}
