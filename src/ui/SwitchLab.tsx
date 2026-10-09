import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useDesign } from '../store/design'
import { SWITCHES, switchById, type SoundProfile } from '../lib/catalog'
import { playKeystroke, playStroke } from '../lib/switchSound'
import { SwitchModel } from '../scene/SwitchModel'
import { ForceChart } from './ForceChart'
import { BrandLogo, brandOf } from './BrandLogo'

const TYPES = ['linear', 'tactile', 'clicky'] as const

const BrandTitle = ({ brand }: { brand: string }) => (
  <li className="brand">
    <BrandLogo brand={brand} />
  </li>
)
const SOUNDS: SoundProfile[] = ['thocky', 'creamy', 'clacky', 'clicky', 'muted']
const SOUND_NOTE: Record<SoundProfile, string> = {
  thocky: 'deep, rounded, bassy',
  creamy: 'smooth, soft, muted highs',
  clacky: 'crisp, bright plastic',
  clicky: 'sharp click on every press',
  muted: 'dampened, office-quiet',
}

const Meter = ({ value, label }: { value: number; label: string }) => (
  <span className="meter" title={`${label}: ${value} of 5`} aria-label={`${label}: ${value} of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= value ? 'on' : ''} />)}
  </span>
)

/** A detailed switch browser: catalog, 3D switch you can press, force curve, sound and materials. */
export function SwitchLab({ onClose }: { onClose: () => void }) {
  const boardSwitch = useDesign((s) => s.design.board.switchId)
  const [id, setId] = useState(boardSwitch)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<(typeof TYPES)[number] | null>(null)
  const [sound, setSound] = useState<SoundProfile | null>(null)
  const [family, setFamily] = useState<'MX' | 'Choc' | null>(null)
  const [press, setPress] = useState(0)
  const [xray, setXray] = useState(true)
  const bottomed = useRef(false)
  const s = switchById(id)

  const list = useMemo(
    () =>
      SWITCHES.filter(
        (w) =>
          (!type || w.type === type) &&
          (!sound || w.sound.profile === sound) &&
          (!family || w.family === family) &&
          `${w.brand} ${w.model}`.toLowerCase().includes(query.toLowerCase()),
      ).sort(
        // brand A–Z, then linear → tactile → clicky, then lightest first
        (a, b) => brandOf(a).localeCompare(brandOf(b)) || TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.actuationG - b.actuationG,
      ),
    [query, type, sound, family],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => setPress(0), [id])

  // bottoming out with the slider plays the sound, like pressing the real switch
  const onPress = (v: number) => {
    setPress(v)
    const atBottom = v >= s.totalTravel - 0.01
    if (atBottom && !bottomed.current) playStroke(s, true)
    if (!atBottom && bottomed.current && v < 0.2) playStroke(s, false)
    if (atBottom || v < 0.2) bottomed.current = atBottom
  }

  const chip = <T,>(value: T, current: T | null, set: (v: T | null) => void, label: string) => (
    <button key={label} className={`chip ${current === value ? 'active' : ''}`} onClick={() => set(current === value ? null : value)}>{label}</button>
  )

  return (
    <div className="lab-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card lab" role="dialog" aria-label="Switch lab">
        <header>
          <h2>Switch lab</h2>
          <button className="close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <aside className="lab-list">
          <input className="search" placeholder="Search switches…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="chips">{TYPES.map((t) => chip(t, type, setType, t))}</div>
          <div className="chips">{SOUNDS.map((p) => chip(p, sound, setSound, p))}</div>
          <div className="chips">{chip<'MX' | 'Choc'>('MX', family, setFamily, 'MX')}{chip<'MX' | 'Choc'>('Choc', family, setFamily, 'Choc (low)')}</div>
          <ul>
            {list.map((w, i) => [
              brandOf(w) !== (i ? brandOf(list[i - 1]) : '') && <BrandTitle key={`brand-${brandOf(w)}`} brand={brandOf(w)} />,
              <li key={w.id}>
                <button className={`lab-item ${w.id === id ? 'active' : ''}`} onClick={() => setId(w.id)}>
                  <span className="dot" style={{ background: w.stemColor }} />
                  <span className="name"><strong>{w.model}</strong><small>{w.family === 'Choc' ? 'Choc · ' : ''}{w.type} · {w.sound.profile}</small></span>
                  <span className="force">{w.actuationG} g</span>
                </button>
              </li>,
            ])}
            {!list.length && <li className="muted">No switches match.</li>}
          </ul>
        </aside>

        <section className="lab-view">
          <div className="lab-canvas">
            <Canvas frameloop="demand" camera={{ position: [34, 26, 40], fov: 35 }} dpr={[1, 1.5]}>
              <color attach="background" args={['#f1f0f4']} />
              <hemisphereLight args={['#ffffff', '#bdb8c6', 1.6]} />
              <directionalLight position={[20, 40, 25]} intensity={2} />
              <directionalLight position={[-25, 10, -20]} intensity={0.6} />
              <SwitchModel s={s} press={press} xray={xray} />
              <OrbitControls makeDefault enableDamping target={[0, 1, 0]} minDistance={20} maxDistance={90} />
            </Canvas>
          </div>
          <label className="slider">
            <span className="label">Press</span>
            <input type="range" min={0} max={s.totalTravel} step={0.05} value={press} onChange={(e) => onPress(Number(e.target.value))} aria-label="Press the switch" />
            <span>{press.toFixed(1)} mm</span>
          </label>
          <div className="row">
            <button className="tile" onClick={() => playKeystroke(s)}>▶ Hear it</button>
            <button className={`tile ${xray ? 'active' : ''}`} onClick={() => setXray(!xray)}>See inside</button>
          </div>
        </section>

        <section className="lab-specs">
          <h3 className="title">{s.brand} {s.model}</h3>
          <p className="muted tags">{s.type} · {s.family === 'Choc' ? 'Kailh Choc (low profile)' : 'MX-style'}{s.materials.factoryLubed ? ' · factory lubed' : ''}</p>

          <h3>Feel</h3>
          <ForceChart s={s} press={press} />
          <dl className="summary">
            <dt>Actuation</dt><dd>{s.actuationG} g at {s.preTravel} mm</dd>
            <dt>Bottom-out</dt><dd>{s.bottomOutG} g at {s.totalTravel} mm</dd>
            {s.bump && <><dt>{s.type === 'clicky' ? 'Click' : 'Bump'}</dt><dd>{s.bump.peakG} g at {s.bump.atMm} mm</dd></>}
            <dt>Smoothness</dt><dd><Meter value={s.smoothness} label="Smoothness" /></dd>
          </dl>

          <h3>Sound</h3>
          <dl className="summary">
            <dt>Profile</dt><dd><strong>{s.sound.profile}</strong>: {SOUND_NOTE[s.sound.profile]}</dd>
            <dt>Pitch</dt><dd>{s.sound.pitch}</dd>
            <dt>Loudness</dt><dd><Meter value={s.sound.loudness} label="Loudness" /></dd>
          </dl>

          <h3>Build</h3>
          <dl className="summary">
            <dt>Stem</dt><dd>{s.materials.stem}</dd>
            <dt>Top housing</dt><dd>{s.materials.topHousing}</dd>
            <dt>Bottom housing</dt><dd>{s.materials.bottomHousing}</dd>
            <dt>Spring</dt><dd>{s.materials.spring}</dd>
          </dl>
          <p className="muted small">Specs are best-effort from public sources; the curve is modelled from them and the sound is synthesized, both approximate.</p>

          <button
            className="tile wide active use"
            disabled={id === boardSwitch}
            onClick={() => {
              useDesign.getState().setSwitch(id)
              onClose()
            }}
          >
            {id === boardSwitch ? 'On your board' : 'Use this switch'}
          </button>
        </section>
      </div>
    </div>
  )
}

