import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useDesign } from '../../store/design'
import { SwitchLab } from '../SwitchLab'
import { familyOf, switchById, switchGroups } from '../../lib/catalog'
import { PROFILES } from '../../data/keycaps'
import { KEYCAP_MATERIALS } from '../../data/materials'
import type { KeycapMaterial } from '../../types'

const SWATCHES = ['#f4f2ec', '#2b2b30', '#e8d6b8', '#9fb7d6', '#f2b8c6', '#b9d8b0', '#ff8a1f', '#5b5bd6']
const WIDTHS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 6.25, 7]
const HOUSINGS = ['#2c2b31', '#f2f2f2', '#c9cdd4', '#f3a6c8', '#a68bd8', '#9fd3e6', '#ff8a1f']

function SwitchSelect({ value, onChange, family, allowDefault }: { value: string; onChange: (id: string) => void; family?: 'MX' | 'Choc'; allowDefault?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowDefault && <option value="">Board switch</option>}
      {switchGroups(family ? (s) => s.family === family : undefined).map(([label, list]) => (
        <optgroup key={label} label={label}>
          {list.map((s) => (
            <option key={s.id} value={s.id}>{s.model} — {s.actuationG} g</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function ComponentsOptions() {
  const board = useDesign((s) => s.design.board)
  const selected = useDesign((s) => s.design.keys.find((k) => k.id === s.selectedId))
  const selectedKnob = useDesign((s) => s.design.components.find((c) => c.id === s.selectedId))
  const { setSwitch, setKeycaps, setOverride, addKnob, deleteKey, setKeySize } = useDesign.getState()
  const sw = switchById(board.switchId)
  const [lab, setLab] = useState(false)
  return (
    <>
      <section>
        <h3>Switches</h3>
        <button className="tile wide lab-open" onClick={() => setLab(true)}>
          <span className="dot" style={{ background: sw.stemColor }} /> {sw.brand} {sw.model} · Open switch lab
        </button>
        {lab && createPortal(<SwitchLab onClose={() => setLab(false)} />, document.body)}
        <SwitchSelect value={board.switchId} onChange={setSwitch} />
        <p className="muted">
          {sw.brand} {sw.model}: {sw.type}, {sw.actuationG} g, {sw.family === 'Choc' ? 'low-profile (Choc spacing, slimmer case)' : 'MX'}. Specs are best-effort.
        </p>
        <div className="swatches" aria-label="Switch housing colour">
          {HOUSINGS.map((c) => (
            <button key={c} className={`swatch ${c === board.switchColor ? 'active' : ''}`} style={{ background: c }} title={`Housing ${c}`} onClick={() => setKeycaps({ switchColor: c })} />
          ))}
          <input type="color" value={board.switchColor} onChange={(e) => setKeycaps({ switchColor: e.target.value })} title="Custom housing colour" />
        </div>
      </section>
      <section>
        <h3>Keycaps</h3>
        <select value={board.profileId} onChange={(e) => setKeycaps({ profileId: e.target.value })}>
          {PROFILES.map((p) => <option key={p.id} value={p.id}>{p.name} profile</option>)}
        </select>
        <div className="swatches">
          {SWATCHES.map((c) => (
            <button key={c} className={`swatch ${c === board.keycapColor ? 'active' : ''}`} style={{ background: c }} title={c} onClick={() => setKeycaps({ keycapColor: c })} />
          ))}
          <input type="color" value={board.keycapColor} onChange={(e) => setKeycaps({ keycapColor: e.target.value })} title="Custom colour" />
        </div>
        <div className="grid">
          {(Object.keys(KEYCAP_MATERIALS) as KeycapMaterial[]).map((id) => (
            <button key={id} className={`tile ${board.keycapMaterial === id ? 'active' : ''}`} onClick={() => setKeycaps({ keycapMaterial: id })}>
              {KEYCAP_MATERIALS[id].name}
            </button>
          ))}
        </div>
        <p className="muted">{KEYCAP_MATERIALS[board.keycapMaterial].note}</p>
      </section>
      <section>
        <h3>Components</h3>
        <button className="tile wide" onClick={addKnob}>+ Add knob</button>
        <p className="muted">Drag the knob onto your board; when you let go, keys in its row slide aside to make room.</p>
      </section>
      {selectedKnob && (
        <section className="selected">
          <h3>Selected knob</h3>
          <button className="tile wide" onClick={() => deleteKey(selectedKnob.id)}>Remove knob</button>
        </section>
      )}
      {selected && (
        <section className="selected">
          <h3>Selected key{selected.legend ? `: ${selected.legend}` : ''}</h3>
          <div className="chips" aria-label="Key width">
            {WIDTHS.map((w) => (
              <button key={w} className={`chip ${selected.w === w ? 'active' : ''}`} onClick={() => setKeySize(selected.id, w, selected.h)}>{w}u</button>
            ))}
            <input
              type="number"
              min={0.5}
              max={10}
              step={0.25}
              value={selected.w}
              onChange={(e) => Number(e.target.value) > 0 && setKeySize(selected.id, Number(e.target.value), selected.h)}
              title="Custom width (units)"
            />
          </div>
          <div className="chips" aria-label="Key height">
            {[1, 2].map((h) => (
              <button key={h} className={`chip ${selected.h === h ? 'active' : ''}`} onClick={() => setKeySize(selected.id, selected.w, h)}>{h}u tall</button>
            ))}
          </div>
          <div className="swatches">
            {SWATCHES.map((c) => (
              <button key={c} className={`swatch ${c === selected.override?.keycapColor ? 'active' : ''}`} style={{ background: c }} title={c} onClick={() => setOverride(selected.id, { keycapColor: c })} />
            ))}
            <input type="color" value={selected.override?.keycapColor ?? board.keycapColor} onChange={(e) => setOverride(selected.id, { keycapColor: e.target.value })} title="Custom colour" />
          </div>
          <select value={selected.override?.profileId ?? ''} onChange={(e) => setOverride(selected.id, { profileId: e.target.value || undefined })}>
            <option value="">Board profile</option>
            {PROFILES.map((p) => <option key={p.id} value={p.id}>{p.name} profile</option>)}
          </select>
          {/* a key can only use a switch of the board's family: MX and Choc need different plates */}
          <SwitchSelect value={selected.override?.switchId ?? ''} onChange={(id) => setOverride(selected.id, { switchId: id || undefined })} family={familyOf(board.switchId)} allowDefault />
          <button className="tile" onClick={() => setOverride(selected.id, null)}>Reset this key</button>
        </section>
      )}
    </>
  )
}
