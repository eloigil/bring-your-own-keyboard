import { useMemo, useState } from 'react'
import { ArrowCounterClockwise, CaretRight, Check, Plus, Trash, X } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { useDesign } from '../../store/design'
import { SwitchLab } from '../SwitchLab'
import { SwitchSide } from '../SwitchSide'
import { BrandLogo, brandOf } from '../BrandLogo'
import { familyOf, switchById, switchGroups } from '../../lib/catalog'
import { PROFILES } from '../../data/keycaps'
import { KEYCAP_MATERIALS } from '../../data/materials'
import type { KeycapMaterial } from '../../types'
import { COMPONENTS, COMPONENT_TYPES, CONTROLLERS, CONTROLLER_ORDER, controllerOf, partColor } from '../../data/components'
import { caseOutline, usbPort } from '../../lib/case'
import { caseController, componentFootprint } from '../../lib/layout'

const SWATCHES = ['#f4f2ec', '#2b2b30', '#e8d6b8', '#9fb7d6', '#f2b8c6', '#b9d8b0', '#ff8a1f', '#5b5bd6']
const WIDTHS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 6.25, 7]
const PART_COLORS = ['#3a3940', '#c9cdd4', '#f4f2ec', '#6b2a2f', '#ff8a1f', '#5b5bd6', '#2fb8b0', '#f3a6c8']
const HOUSINGS = ['#2c2b31', '#f2f2f2', '#c9cdd4', '#f3a6c8', '#a68bd8', '#9fd3e6', '#ff8a1f']

function SwitchSelect({ value, onChange, family, allowDefault }: { value: string; onChange: (id: string) => void; family?: 'MX' | 'Choc'; allowDefault?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowDefault && <option value="">Board switch</option>}
      {switchGroups(family ? (s) => s.family === family : undefined).map(([label, list]) => (
        <optgroup key={label} label={label}>
          {list.map((s) => (
            <option key={s.id} value={s.id}>{s.model}, {s.actuationG} g</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/** Rotation for the selected key or part. Fine moves are keyboard-only: arrows nudge, [ ] rotate. */
function Place({ id, rot, rotate }: { id: string; rot: number; rotate: (id: string, deg: number) => void }) {
  return (
    <>
      <label className="slider">
        <span className="label">Rotation</span>
        <input type="range" min={-180} max={180} step={1} value={rot} onChange={(e) => rotate(id, Number(e.target.value))} aria-label="Rotation in degrees" onDoubleClick={() => rotate(id, 0)} />
        <span>{rot}°</span>
      </label>
      <p className="muted">Arrow keys nudge it 1 mm (Shift: ¼ u). Double-click the slider to reset.</p>
    </>
  )
}

/** Controller size: a slider from the smallest board to the Pico. Switching makes room for a bigger board. */
function BoardSize({ id }: { id: string }) {
  const c = useDesign((s) => s.design.components.find((c) => c.id === id))
  if (!c) return null
  const board = controllerOf(c)
  const i = CONTROLLER_ORDER.indexOf(c.model ?? 'pico')
  const pick = (n: number) => {
    const { setComponent, dropComponent } = useDesign.getState()
    setComponent(id, { model: CONTROLLER_ORDER[n], color: undefined })
    dropComponent(id) // a bigger board pushes the keys in its rows aside
  }
  return (
    <>
      <label className="slider">
        <span className="label">Size</span>
        <input type="range" min={0} max={CONTROLLER_ORDER.length - 1} step={1} value={i} onChange={(e) => pick(Number(e.target.value))} aria-label="Controller size" />
      </label>
      <div className="stops">{CONTROLLER_ORDER.map((m, n) => <button key={m} className={n === i ? 'on' : ''} onClick={() => pick(n)}>{CONTROLLERS[m].short}</button>)}</div>
      <p className="muted"><strong>{board.name}</strong>: {board.w} × {board.l} mm, {board.usb}, {board.pins.length} pins{board.holes ? ', screws onto standoffs' : ', sits in a printed tray'}.</p>
    </>
  )
}

const MOUNTS = [
  { id: 'window', label: 'Window', note: 'Under the plate, seen through a window in it.' },
  { id: 'covered', label: 'Covered', note: 'Enclosed under the case top: the case covers it, only the USB opening shows.' },
  { id: 'raised', label: 'Raised', note: 'On top of a solid plate; the USB plug leaves through a notch in the top of the wall.' },
] as const

/** How the controller sits (window / covered / raised) and whether an OLED goes on top. */
function BoardMount({ id }: { id: string }) {
  const c = useDesign((s) => s.design.components.find((c) => c.id === id))
  if (!c) return null
  const mount = c.mount ?? 'window'
  const set = (patch: Parameters<ReturnType<typeof useDesign.getState>['setComponent']>[1]) => {
    useDesign.getState().setComponent(id, patch)
    useDesign.getState().dropComponent(id) // a screen lengthens the footprint: make room
  }
  return (
    <>
      <div className="chips" aria-label="Controller mount">
        {MOUNTS.map((m) => (
          <button key={m.id} className={`chip ${mount === m.id ? 'active' : ''}`} onClick={() => set({ mount: m.id, ...(m.id === 'window' && { screen: false }) })}>{m.label}</button>
        ))}
        <button className={`chip ${c.screen ? 'active' : ''}`} disabled={mount === 'window'} onClick={() => set({ screen: !c.screen })} title={mount === 'window' ? 'Cover the window or raise the board first' : 'A 0.91" OLED above the controller'}>
          {c.screen ? <Check size={12} weight="bold" /> : <Plus size={12} weight="bold" />} Screen on top
        </button>
      </div>
      <p className="muted">{MOUNTS.find((m) => m.id === mount)!.note}{c.screen ? ` A 0.91" OLED rests ${mount === 'covered' ? 'on the case top above it' : 'on the board'}, on the controller\'s I²C.` : ''}</p>
    </>
  )
}

/** Whether the controller's USB end reaches a wall, so the case gets its opening. */
function PortStatus({ id }: { id: string }) {
  const design = useDesign((s) => s.design)
  const family = familyOf(design.board.switchId)
  const port = useMemo(() => {
    const footprints = [...design.keys, ...design.components.map(componentFootprint)]
    const ctrl = caseController(design.components.filter((c) => c.id === id))
    return ctrl && usbPort(caseOutline(footprints, family, design.pocketFills), ctrl, family)
  }, [design.keys, design.components, design.pocketFills, family, id])
  return port
    ? <p className="muted">USB opening: through the wall {port.wall.toFixed(0)} mm past its end.</p>
    : <p className="blocked">Its USB end doesn't reach a wall, so the case has no USB opening. Move it to an edge or rotate it so the USB end points outward.</p>
}

/** Build → Switches: the board's switch (opens the lab) and housing colour. */
export function SwitchOptions() {
  const board = useDesign((s) => s.design.board)
  const { setKeycaps } = useDesign.getState()
  const sw = switchById(board.switchId)
  const [lab, setLab] = useState(false)
  return (
    <section>
      <button className="switch-card" onClick={() => setLab(true)} aria-label={`${sw.brand} ${sw.model}. Open the switch lab`}>
        <SwitchSide s={sw} housing={board.switchColor} />
        <span className="info">
          <BrandLogo brand={brandOf(sw)} />
          <strong>{sw.model}</strong>
          <small>{sw.type}, {sw.actuationG} g, {sw.sound.profile}{sw.family === 'Choc' ? ', low profile' : ''}</small>
          <span className="open">Open switch lab <CaretRight size={12} weight="bold" /></span>
        </span>
      </button>
      {lab && createPortal(<SwitchLab onClose={() => setLab(false)} />, document.body)}
      <h3>Housing colour</h3>
      <div className="swatches" aria-label="Switch housing colour">
        {HOUSINGS.map((c) => (
          <button key={c} className={`swatch ${c === board.switchColor ? 'active' : ''}`} style={{ background: c }} title={`Housing ${c}`} onClick={() => setKeycaps({ switchColor: c })} />
        ))}
        <input type="color" value={board.switchColor} onChange={(e) => setKeycaps({ switchColor: e.target.value })} title="Custom housing colour" />
      </div>
    </section>
  )
}

/** Build → Keycaps: profile, colour and plastic. */
export function KeycapOptions() {
  const board = useDesign((s) => s.design.board)
  const { setKeycaps } = useDesign.getState()
  return (
    <section>
      <h3>Profile</h3>
      <select value={board.profileId} onChange={(e) => setKeycaps({ profileId: e.target.value })}>
        {PROFILES.map((p) => <option key={p.id} value={p.id}>{p.name} profile</option>)}
      </select>
      <h3>Colour</h3>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button key={c} className={`swatch ${c === board.keycapColor ? 'active' : ''}`} style={{ background: c }} title={c} onClick={() => setKeycaps({ keycapColor: c })} />
        ))}
        <input type="color" value={board.keycapColor} onChange={(e) => setKeycaps({ keycapColor: e.target.value })} title="Custom colour" />
      </div>
      <h3>Plastic</h3>
      <div className="segmented">
        {(Object.keys(KEYCAP_MATERIALS) as KeycapMaterial[]).map((id) => (
          <button key={id} className={board.keycapMaterial === id ? 'active' : ''} onClick={() => setKeycaps({ keycapMaterial: id })}>
            {KEYCAP_MATERIALS[id].name}
          </button>
        ))}
      </div>
      <p className="muted">{KEYCAP_MATERIALS[board.keycapMaterial].note}</p>
    </section>
  )
}

/** Build → Parts: add a controller, knob, screen… */
export function PartsOptions() {
  const { addComponent } = useDesign.getState()
  return (
    <section>
      <div className="part-grid">
        {COMPONENT_TYPES.map((t) => (
          <button key={t} className="part" onClick={() => addComponent(t)} title={COMPONENTS[t].part}>
            <Plus size={14} weight="bold" />
            {COMPONENTS[t].name}
          </button>
        ))}
      </div>
      <p className="muted">Drag a part onto your board. When you let go, keys in its rows slide aside to make room.</p>
    </section>
  )
}

/** The selected key or part, in a card of its own (Build step): everything that changes just that one thing. */
export function SelectionPanel() {
  const board = useDesign((s) => s.design.board)
  const selected = useDesign((s) => s.design.keys.find((k) => k.id === s.selectedId))
  const selectedKnob = useDesign((s) => s.design.components.find((c) => c.id === s.selectedId))
  const { setOverride, deleteKey, setKeySize, rotate, setComponent, select } = useDesign.getState()
  if (!selected && !selectedKnob) return null
  const title = selectedKnob ? COMPONENTS[selectedKnob.type].name : `Key${selected!.legend ? ` ${selected!.legend}` : ''}`
  return (
    <aside className="surface selection" aria-label="Selection">
      <header>
        <h2>{title}</h2>
        <button className="icon" onClick={() => select(null)} aria-label="Deselect"><X size={16} /></button>
      </header>
      {selectedKnob && (
        <>
          <p className="muted">{COMPONENTS[selectedKnob.type].part}. {COMPONENTS[selectedKnob.type].note}</p>
          {selectedKnob.type === 'controller' && <BoardSize id={selectedKnob.id} />}
          {selectedKnob.type === 'controller' && <BoardMount id={selectedKnob.id} />}
          {selectedKnob.type === 'controller' && <PortStatus id={selectedKnob.id} />}
          <Place id={selectedKnob.id} rot={selectedKnob.rot ?? 0} rotate={rotate} />
          <h3>Colour</h3>
          <div className="swatches" aria-label="Part colour">
            {PART_COLORS.map((c) => (
              <button key={c} className={`swatch ${c === partColor(selectedKnob) ? 'active' : ''}`} style={{ background: c }} title={c} onClick={() => setComponent(selectedKnob.id, { color: c })} />
            ))}
            <input type="color" value={partColor(selectedKnob)} onChange={(e) => setComponent(selectedKnob.id, { color: e.target.value })} title="Custom colour" />
          </div>
          <button className="button danger" onClick={() => deleteKey(selectedKnob.id)}><Trash size={14} /> Remove</button>
        </>
      )}
      {selected && (
        <>
          <h3>Width</h3>
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
          <h3>Height</h3>
          <div className="segmented">
            {[1, 2].map((h) => (
              <button key={h} className={selected.h === h ? 'active' : ''} onClick={() => setKeySize(selected.id, selected.w, h)}>{h}u</button>
            ))}
          </div>
          <Place id={selected.id} rot={selected.rot} rotate={rotate} />
          <h3>Keycap</h3>
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
          <div className="row">
            <button className="button" onClick={() => setOverride(selected.id, null)}><ArrowCounterClockwise size={14} /> Reset</button>
            <button className="button danger" onClick={() => deleteKey(selected.id)}><Trash size={14} /> Delete</button>
          </div>
        </>
      )}
    </aside>
  )
}
