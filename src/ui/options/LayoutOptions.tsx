import { useDesign } from '../../store/design'
import { PRESETS, type PresetName } from '../../lib/layout'

export function LayoutOptions() {
  const preset = useDesign((s) => s.preset)
  const { setPreset, setStep } = useDesign.getState()
  return (
    <section>
      <h3>Pick a starting layout</h3>
      <div className="grid">
        {(Object.keys(PRESETS) as PresetName[]).map((p) => (
          <button key={p} className={`tile ${p === preset ? 'active' : ''}`} onClick={() => setPreset(p)}>
            {p}
          </button>
        ))}
      </div>
      <p className="muted">Picking a layout replaces your current board.</p>
      <div className="row">
        <button className="tile active" onClick={() => setStep('Shape')}>Start shaping →</button>
      </div>
    </section>
  )
}
