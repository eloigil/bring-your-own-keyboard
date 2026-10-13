import { useDesign } from '../store/design'
import { STEPS } from './steps'
import { UndoRedo } from './UndoRedo'
import { ThemeToggle } from './ThemeToggle'

/** Wordmark left, the four steps centred, undo / redo / theme right. Floats over the scene. */
export function TopBar() {
  const current = useDesign((s) => s.step)
  const setStep = useDesign((s) => s.setStep)
  return (
    <header className="topbar">
      <div className="app-mark">BYOKb</div>
      <nav className="surface stepper" aria-label="Steps">
        {STEPS.map(({ step, label, icon: Icon }) => (
          <button key={step} className={step === current ? 'active' : ''} onClick={() => setStep(step)} aria-current={step === current ? 'step' : undefined}>
            <Icon size={16} weight={step === current ? 'fill' : 'regular'} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="surface actions">
        <UndoRedo />
        <ThemeToggle />
      </div>
    </header>
  )
}
