import { useDesign } from '../../store/design'
import { PRESET_CATEGORIES } from '../../lib/layout'

export function LayoutOptions() {
  const preset = useDesign((s) => s.preset)
  const { setPreset, setStep } = useDesign.getState()
  return (
    <>
      {PRESET_CATEGORIES.map(({ name, presets }) => (
        <section key={name}>
          <h3>{name}</h3>
          <div className="grid">
            {presets.map((p) => (
              <button key={p} className={`tile ${p === preset ? 'active' : ''}`} onClick={() => setPreset(p)}>
                {p}
              </button>
            ))}
          </div>
        </section>
      ))}
      <p className="muted">Picking a layout replaces your current board.</p>
      <div className="row">
        <button className="tile active" onClick={() => setStep('Build')}>Start building →</button>
      </div>
    </>
  )
}
