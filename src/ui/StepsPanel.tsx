import { useDesign } from '../store/design'
import type { Step } from '../types'

const STEPS: { step: Step; hint: string }[] = [
  { step: 'Layout', hint: 'Pick a starting layout' },
  { step: 'Shape', hint: 'Drag keys, fill pockets' },
  { step: 'Components', hint: 'Switches, keycaps, knob' },
  { step: 'LEDs', hint: 'Light it up' },
  { step: 'Export', hint: 'Files to build it' },
]

export function StepsPanel() {
  const current = useDesign((s) => s.step)
  const setStep = useDesign((s) => s.setStep)
  return (
    <nav className="card steps">
      <div className="brand">BYOKb</div>
      {STEPS.map(({ step, hint }, i) => (
        <button key={step} className={`step ${step === current ? 'active' : ''}`} onClick={() => setStep(step)}>
          <span className="num">{i + 1}</span>
          <span>
            <strong>{step}</strong>
            <small>{hint}</small>
          </span>
        </button>
      ))}
    </nav>
  )
}
