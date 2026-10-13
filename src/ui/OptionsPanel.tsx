import { useState } from 'react'
import { useDesign } from '../store/design'
import { STEPS } from './steps'
import { LayoutOptions } from './options/LayoutOptions'
import { ShapeOptions } from './options/ShapeOptions'
import { KeycapOptions, PartsOptions, SwitchOptions } from './options/ComponentsOptions'
import { LedOptions } from './options/LedOptions'
import { ExportOptions } from './options/ExportOptions'

const BUILD_TABS = [
  { id: 'case', label: 'Case', body: ShapeOptions },
  { id: 'switches', label: 'Switches', body: SwitchOptions },
  { id: 'keycaps', label: 'Keycaps', body: KeycapOptions },
  { id: 'parts', label: 'Parts', body: PartsOptions },
] as const

/** The inspector: the current step's title and one-line hint, then its controls (Build is split into tabs). */
export function OptionsPanel() {
  const step = useDesign((s) => s.step)
  const [tab, setTab] = useState<(typeof BUILD_TABS)[number]['id']>('case')
  const meta = STEPS.find((s) => s.step === step)!
  const Body = BUILD_TABS.find((t) => t.id === tab)!.body
  return (
    <aside className="surface inspector" aria-label={`${meta.label} options`}>
      <header>
        <h2>{meta.label}</h2>
        <p>{meta.hint}</p>
      </header>
      {step === 'Build' && (
        <div className="tabs" role="tablist">
          {BUILD_TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      )}
      <div className="inspector-body">
        {step === 'Layout' ? <LayoutOptions /> : step === 'Build' ? <Body /> : step === 'LEDs' ? <LedOptions /> : <ExportOptions />}
      </div>
    </aside>
  )
}
