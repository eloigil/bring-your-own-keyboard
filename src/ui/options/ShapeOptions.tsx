import { useDesign } from '../../store/design'
import { TILT_MAX } from '../../lib/case'

export function ShapeOptions() {
  const selectedId = useDesign((s) => s.selectedId)
  const tilt = useDesign((s) => s.design.board.tiltDeg)
  const { addKey, deleteKey, setTilt } = useDesign.getState()
  return (
    <section>
      <h3>Shape it</h3>
      <div className="row">
        <button className="tile" onClick={addKey}>+ Add key</button>
        <button className="tile" disabled={!selectedId} onClick={() => selectedId && deleteKey(selectedId)}>Delete key</button>
      </div>
      <p className="muted">Drag keys to reshape your board. Drag the purple orbs to fill or open the dips in the case.</p>
      <h3>Typing angle</h3>
      <label className="slider">
        <input type="range" min={0} max={TILT_MAX} step={0.5} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} />
        <span>{tilt}°</span>
      </label>
    </section>
  )
}
