import { useDesign, ledsConfigured } from '../../store/design'
import type { LedEffect } from '../../types'

const COLORS = ['#ff8a1f', '#e5484d', '#f2c94c', '#3c9a4a', '#2fb8b0', '#2f6fd0', '#8e5fd0', '#f3a6c8', '#ffffff']
const EFFECTS: { id: LedEffect; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'breathing', label: 'Breathing' },
  { id: 'wave', label: 'Wave' },
  { id: 'reactive', label: 'Reactive' },
]

export function LedOptions() {
  const brush = useDesign((s) => s.ledBrush)
  const board = useDesign((s) => s.design.board)
  const on = useDesign((s) => ledsConfigured(s.design))
  const { setLedBrush, setLedEffect, setLedColor, clearLeds } = useDesign.getState()
  return (
    <>
      <section>
        <h3>Paint keys</h3>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} className={`swatch ${c === brush ? 'active' : ''}`} style={{ background: c }} title={c} onClick={() => setLedBrush(c)} />
          ))}
          <input type="color" value={brush ?? '#ff8a1f'} onChange={(e) => setLedBrush(e.target.value)} title="Custom colour" />
          <button className={`swatch eraser ${brush === null ? 'active' : ''}`} title="Eraser" onClick={() => setLedBrush(null)}>⌫</button>
        </div>
        <p className="muted">Click keys to paint their LED. Painted keys keep their colour over any effect.</p>
      </section>
      <section>
        <h3>Effect</h3>
        <div className="grid">
          {EFFECTS.map((e) => (
            <button key={e.id} className={`tile ${board.ledEffect === e.id ? 'active' : ''}`} onClick={() => setLedEffect(e.id)}>{e.label}</button>
          ))}
        </div>
        {board.ledEffect !== 'none' && board.ledEffect !== 'wave' && (
          <div className="swatches">
            {COLORS.map((c) => (
              <button key={c} className={`swatch ${c === board.ledColor ? 'active' : ''}`} style={{ background: c }} title={c} onClick={() => setLedColor(c)} />
            ))}
          </div>
        )}
        {board.ledEffect === 'reactive' && <p className="muted">Hover over keys to see them react.</p>}
      </section>
      {on && (
        <div className="row">
          <button className="tile" onClick={clearLeds}>Turn all LEDs off</button>
        </div>
      )}
    </>
  )
}
