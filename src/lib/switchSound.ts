import type { Switch } from './catalog'

/**
 * An approximate key sound, synthesized from the switch's sound profile (no recordings, works offline):
 * a filtered noise burst for the plastic impact plus a short low tone for the "body" of the sound.
 */
const TONE = {
  thocky: { filter: 'lowpass', freq: 900, q: 0.7, decay: 0.055, body: 140, bodyGain: 0.6 },
  clacky: { filter: 'bandpass', freq: 2600, q: 1.2, decay: 0.025, body: 320, bodyGain: 0.2 },
  creamy: { filter: 'lowpass', freq: 1300, q: 0.5, decay: 0.04, body: 190, bodyGain: 0.35 },
  clicky: { filter: 'bandpass', freq: 2400, q: 1.2, decay: 0.03, body: 300, bodyGain: 0.2 },
  muted: { filter: 'lowpass', freq: 500, q: 0.5, decay: 0.03, body: 120, bodyGain: 0.15 },
} as const
const PITCH = { deep: 0.7, mid: 1, high: 1.4 }

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio() {
  ctx ??= new AudioContext()
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return { ctx, noise }
}

function burst(at: number, freq: number, filter: BiquadFilterType, q: number, decay: number, gain: number) {
  const { ctx, noise } = audio()
  const src = ctx.createBufferSource()
  src.buffer = noise
  const f = Object.assign(ctx.createBiquadFilter(), { type: filter })
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(gain, at + 0.001)
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  src.connect(f).connect(g).connect(ctx.destination)
  src.start(at)
  src.stop(at + decay + 0.02)
}

function tone(at: number, freq: number, decay: number, gain: number) {
  const { ctx } = audio()
  const o = Object.assign(ctx.createOscillator(), { type: 'sine' as OscillatorType })
  o.frequency.setValueAtTime(freq, at)
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, at + decay)
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  o.connect(g).connect(ctx.destination)
  o.start(at)
  o.stop(at + decay + 0.02)
}

/** One keystroke sound. `down` = bottoming out, `up` = the stem returning (quieter, a bit higher). */
export function playStroke(s: Switch, down: boolean, delay = 0) {
  const { ctx } = audio()
  if (ctx.state === 'suspended') void ctx.resume()
  const t = TONE[s.sound.profile]
  const at = ctx.currentTime + delay + 0.005
  const level = (s.sound.loudness / 5) * (down ? 0.9 : 0.4)
  const pitch = PITCH[s.sound.pitch] * (down ? 1 : 1.25)
  if (s.type === 'clicky') burst(at, 4500, 'bandpass', 3, 0.008, level * 1.4) // the click bar
  burst(at + (s.type === 'clicky' && down ? 0.03 : 0), t.freq * pitch, t.filter, t.q, t.decay, level)
  if (down) tone(at, t.body * pitch, t.decay * 1.4, level * t.bodyGain)
}

/** Press and release, like a real keystroke. */
export function playKeystroke(s: Switch) {
  playStroke(s, true)
  playStroke(s, false, 0.16)
}
