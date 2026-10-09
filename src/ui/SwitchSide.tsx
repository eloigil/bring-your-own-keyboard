import type { Switch } from '../lib/catalog'

/**
 * A switch seen from the side, drawn to rough scale from its data: stem on top, top housing, bottom housing,
 * pins. MX switches stand tall; Choc switches are low and wide with twin-rail stems.
 */
export function SwitchSide({ s, housing }: { s: Switch; housing: string }) {
  const choc = s.family === 'Choc'
  const see = s.housing.tint === 'clear'
  // heights in the 0..60 viewBox (≈ 2.4 px per mm)
  const top = choc ? { y: 22, h: 8, w: 44, tw: 38 } : { y: 14, h: 16, w: 40, tw: 28 }
  const bottom = { y: 30, h: choc ? 6 : 12, w: choc ? 46 : 38 }
  const stemH = choc ? 6 : 9
  const cx = 30
  return (
    <svg className="switch-side" viewBox="0 0 60 60" aria-label={`${s.brand} ${s.model}, side view`} role="img">
      {/* stem */}
      {choc ? (
        [cx - 7, cx + 4].map((x) => <rect key={x} x={x} y={top.y - stemH} width={3} height={stemH + 1} rx={0.6} fill={s.stemColor} />)
      ) : (
        <rect x={cx - 5} y={top.y - stemH} width={10} height={stemH + 1} rx={1} fill={s.stemColor} />
      )}
      {/* top housing: a trapezoid, see-through for clear housings */}
      <path
        d={`M${cx - top.tw / 2},${top.y} L${cx + top.tw / 2},${top.y} L${cx + top.w / 2},${top.y + top.h} L${cx - top.w / 2},${top.y + top.h} Z`}
        fill={housing}
        fillOpacity={see ? 0.45 : 1}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={0.6}
      />
      {/* plate line */}
      <line x1={4} x2={56} y1={bottom.y} y2={bottom.y} stroke="var(--muted)" strokeWidth={0.6} strokeDasharray="2 1.5" />
      {/* bottom housing */}
      <rect x={cx - bottom.w / 2} y={bottom.y} width={bottom.w} height={bottom.h} rx={1.2} fill={housing} stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} />
      {/* pins */}
      {[cx - 9, cx + 6].map((x) => <rect key={x} x={x} y={bottom.y + bottom.h} width={1.6} height={choc ? 6 : 8} fill="#c9a14a" />)}
      <rect x={cx - 3} y={bottom.y + bottom.h} width={6} height={choc ? 4 : 6} rx={1} fill={housing} />
    </svg>
  )
}
