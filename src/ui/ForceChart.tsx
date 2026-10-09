import { forceCurve, type Switch } from '../lib/catalog'

const W = 320, H = 180, PAD = { l: 34, r: 10, t: 22, b: 34 }

/** Force (g) over travel (mm) for one switch, with actuation and bump markers and the current press position. */
export function ForceChart({ s, press }: { s: Switch; press: number }) {
  const pts = forceCurve(s)
  const maxF = Math.ceil(Math.max(...pts.map((p) => p[1]), s.bottomOutG * 1.2) / 20) * 20
  const x = (mm: number) => PAD.l + (mm / s.totalTravel) * (W - PAD.l - PAD.r)
  const y = (g: number) => H - PAD.b - (g / maxF) * (H - PAD.t - PAD.b)
  const path = pts.map(([mm, g], i) => `${i ? 'L' : 'M'}${x(mm).toFixed(1)},${y(g).toFixed(1)}`).join('')
  const at = pts.reduce((best, p) => (Math.abs(p[0] - press) < Math.abs(best[0] - press) ? p : best))
  const ticksG = Array.from({ length: maxF / 20 + 1 }, (_, i) => i * 20)
  const ticksMm = Array.from({ length: Math.floor(s.totalTravel) + 1 }, (_, i) => i)
  const bump = s.bump && pts.reduce((m, p) => (p[0] < s.preTravel + 0.3 && p[1] > m[1] ? p : m), [0, 0])

  return (
    <svg className="force-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Force curve for ${s.brand} ${s.model}`}>
      {ticksG.map((g) => (
        <g key={g}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} className="grid" />
          <text x={PAD.l - 6} y={y(g) + 3} textAnchor="end">{g}</text>
        </g>
      ))}
      {ticksMm.map((mm) => (
        <text key={mm} x={x(mm)} y={H - PAD.b + 13} textAnchor="middle">{mm}</text>
      ))}
      <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" className="axis">travel (mm)</text>
      <text x={4} y={PAD.t - 2} className="axis">g</text>
      {/* actuation point */}
      <line x1={x(s.preTravel)} x2={x(s.preTravel)} y1={PAD.t} y2={H - PAD.b} className="actuation" />
      <text x={x(s.preTravel) + 4} y={H - PAD.b - 5} className="label">actuation {s.preTravel} mm</text>
      <path d={path} className="curve" />
      {bump && (
        <g>
          <circle cx={x(bump[0])} cy={y(bump[1])} r={3.5} className="bump" />
          <text x={x(bump[0])} y={y(bump[1]) - 8} textAnchor="middle" className="label">{s.type === 'clicky' ? 'click' : 'bump'} {Math.round(bump[1])} g</text>
        </g>
      )}
      {/* where the press slider is */}
      <circle cx={x(at[0])} cy={y(at[1])} r={5} className="press" />
      <text x={W - PAD.r} y={12} textAnchor="end" className="readout">
        {press.toFixed(1)} mm · {Math.round(at[1])} g
      </text>
    </svg>
  )
}
