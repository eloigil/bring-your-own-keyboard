import { useRef, useState } from 'react'
import { ArrowRight, FolderOpen } from '@phosphor-icons/react'
import { useDesign } from '../../store/design'
import { readDesignFile } from '../../lib/share'
import { PRESET_CATEGORIES } from '../../lib/layout'
import { TILT_MAX } from '../../lib/case'

export function LayoutOptions() {
  const preset = useDesign((s) => s.preset)
  const tilt = useDesign((s) => s.design.board.tiltDeg)
  const { setPreset, setStep, setTilt } = useDesign.getState()
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
      <section>
        <h3>Typing angle</h3>
        <label className="slider">
          <input type="range" min={0} max={TILT_MAX} step={0.5} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} />
          <span>{tilt}°</span>
        </label>
      </section>
      <OpenDesign />
      <div className="row cta">
        <button className="button primary" onClick={() => setStep('Build')}>Start building <ArrowRight size={14} weight="bold" /></button>
      </div>
    </>
  )
}

/** Open a design file saved from the Export step (or dropped on the page, see Editor). */
function OpenDesign() {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState(false)
  const open = async (file?: File) => {
    const d = file && readDesignFile(await file.text())
    setError(!d)
    if (d) {
      useDesign.getState().openDesign(d)
      useDesign.getState().setStep('Build')
    }
  }
  return (
    <section>
      <h3>Or open a saved design</h3>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => (open(e.target.files?.[0]), (e.target.value = ''))} />
      <button className="button" onClick={() => input.current?.click()}><FolderOpen size={14} /> Open design file</button>
      {error && <p className="blocked">That file isn't a BYOKb design.</p>}
    </section>
  )
}
