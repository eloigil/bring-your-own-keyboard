import { useDesign } from '../../store/design'
import { PRESETS, type PresetName } from '../../lib/layout'

export function LayoutOptions() {
  const preset = useDesign((s) => s.preset)
  const setPreset = useDesign((s) => s.setPreset)
  return (
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
  )
}
