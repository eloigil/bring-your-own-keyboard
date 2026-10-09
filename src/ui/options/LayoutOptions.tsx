import { useDesign } from '../../store/design'
import { PRESETS, type PresetName } from '../../lib/layout'

export function LayoutOptions() {
  const preset = useDesign((s) => s.preset)
  const selectedId = useDesign((s) => s.selectedId)
  const { setPreset, addKey, deleteKey } = useDesign.getState()
  return (
    <>
      <section>
        <h3>Start from a preset</h3>
        <div className="grid">
          {(Object.keys(PRESETS) as PresetName[]).map((p) => (
            <button key={p} className={`tile ${p === preset ? 'active' : ''}`} onClick={() => setPreset(p)}>
              {p}
            </button>
          ))}
        </div>
        <p className="muted">Picking a preset replaces your current board.</p>
      </section>
      <section>
        <h3>Shape it</h3>
        <div className="row">
          <button className="tile" onClick={addKey}>+ Add key</button>
          <button className="tile" disabled={!selectedId} onClick={() => selectedId && deleteKey(selectedId)}>Delete key</button>
        </div>
        <p className="muted">Drag keys to reshape your board. Drag the purple orbs to fill or open the dips in the case.</p>
      </section>
    </>
  )
}
