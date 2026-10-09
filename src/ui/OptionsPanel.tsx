import { useDesign } from '../store/design'
import { LayoutOptions } from './options/LayoutOptions'

export function OptionsPanel() {
  const step = useDesign((s) => s.step)
  return (
    <aside className="card options">
      <h2>{step}</h2>
      {step === 'Layout' ? <LayoutOptions /> : <p className="muted">Coming soon.</p>}
    </aside>
  )
}
