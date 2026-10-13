import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LedEffect } from '../types'
import { sky } from './sky'

const OFF = new THREE.Color('#000000')
const HALO = 5 // mm the glow reaches past the key on each axis

/** Where the pointer last touched the board (key centre, units) and when — the ripple spreads from here. */
export type Ripple = { x: number; y: number; t: number }
const RIPPLE_SPEED = 14 // units per second
const RIPPLE_LIFE = 0.6 // seconds a ring stays lit on one key
export const rippleActive = (r: Ripple, t: number) => t - r.t < 10 / RIPPLE_SPEED + RIPPLE_LIFE
/** 0–1 pseudo-random per key, stable between frames. */
const seedOf = (id: string) => (id.split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 1000) / 1000

/**
 * Per-key underglow, drawn as a bright plate under the keycap so it shows in the gaps.
 * The effect drives its colour. Only an active effect keeps the frame loop running.
 * `u`/`v` are the key's centre as a 0–1 fraction of the board; `ux`/`uy` the centre in units.
 */
const glowCache = new Map<string, THREE.BufferGeometry>()
/**
 * The light a key's LED throws, with no visible surface of its own (it's drawn additively, so black is nothing):
 * faint under the middle of the switch, brightest at the key's edge, where it escapes through the gaps between
 * caps, then fading to nothing HALO mm out. Built from vertex colours so the falloff is the same width on every key size.
 */
function glowGeometry(w: number, d: number) {
  const key = `${w.toFixed(2)},${d.toFixed(2)}`
  let g = glowCache.get(key)
  if (!g) {
    const ring = (hw: number, hd: number) => [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]
    const pts = [[0, 0], ...ring(w / 2, d / 2), ...ring(w / 2 + HALO, d / 2 + HALO)]
    const level = [CENTRE, EDGE, EDGE, EDGE, EDGE, 0, 0, 0, 0]
    const index: number[] = []
    for (let a = 0; a < 4; a++) {
      const b = (a + 1) % 4
      index.push(0, 1 + a, 1 + b) // middle → edge
      index.push(1 + a, 5 + a, 5 + b, 1 + a, 5 + b, 1 + b) // edge → out
    }
    g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, y]) => [x, y, 0]), 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(level.flatMap((l) => [l, l, l]), 3))
    g.setIndex(index)
    glowCache.set(key, g)
  }
  return g
}
const EDGE = 0.45 // brightness where the light escapes between caps; neighbouring glows add up, so well under 1
const CENTRE = 0.12 // how much light shows straight under the switch (seen only through clear caps or a lifted key)

export function KeyLed({ id, w, d, y, effect, effectColor, u, v, ux, uy, hot, ripple, glow }: {
  id: string; w: number; d: number; y: number; effect: LedEffect; effectColor: string
  u: number; v: number; ux: number; uy: number; hot: React.RefObject<number>; ripple: React.RefObject<Ripple | null>
  /** Shared with the keycap, which uses it as its emissive colour so the light shines through the cap. */
  glow: THREE.Color
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)
  const lit = effect !== 'none'
  const seed = seedOf(id)
  const colorAt = (t: number, out: THREE.Color) => {
    switch (effect) {
      case 'breathing':
        return out.set(effectColor).multiplyScalar(0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 2)))
      case 'wave':
        return out.setHSL(((u + v) * 0.6 - t * 0.25) % 1 + 1, 0.9, 0.55)
      case 'rainbow':
        return out.setHSL((t * 0.12) % 1, 0.9, 0.55)
      case 'pinwheel':
        return out.setHSL((Math.atan2(v - 0.5, (u - 0.5) * 3) / (2 * Math.PI) + t * 0.2) % 1 + 1, 0.9, 0.55)
      case 'raindrops': {
        // each key flashes on at its own moment every few seconds, then fades
        const period = 2.5 + seed * 2
        const age = (t + seed * 7) % period
        return out.set(effectColor).multiplyScalar(Math.max(0, 1 - age / 0.9) ** 1.5)
      }
      case 'reactive': {
        const age = t - (hot.current ?? -99) // seconds since the pointer passed over this key
        return age < 0.8 ? out.set(effectColor).multiplyScalar(1 - age / 0.8) : out.copy(OFF)
      }
      case 'ripple': {
        // a ring expanding from the last touched key: this key lights when the ring reaches it
        const r = ripple.current
        if (!r) return out.copy(OFF)
        const age = t - r.t - Math.hypot(ux - r.x, uy - r.y) / RIPPLE_SPEED
        return age > 0 && age < RIPPLE_LIFE ? out.set(effectColor).multiplyScalar(1 - age / RIPPLE_LIFE) : out.copy(OFF)
      }
      default:
        return out.copy(OFF)
    }
  }
  useEffect(() => {
    colorAt(0, glow)
    if (!lit) glow.copy(OFF)
    mat.current?.color.copy(glow)
    invalidate()
  }, [effect, effectColor]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock, invalidate }) => {
    if (!mat.current || !lit) return
    colorAt(clock.elapsedTime, glow).multiplyScalar(sky.led)
    mat.current.color.copy(glow)
    // continuous effects get frames from the shared 30 fps LedTicker; pointer-driven ones request their own briefly
    if (effect === 'reactive' && clock.elapsedTime - (hot.current ?? -99) < 0.8) invalidate()
    if (effect === 'ripple' && ripple.current && rippleActive(ripple.current, clock.elapsedTime)) invalidate()
  })
  if (!lit) return null
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={glowGeometry(w, d)}>
      {/* additive: neighbouring glows add up, so the light spills into the gaps like real underglow */}
      <meshBasicMaterial ref={mat} toneMapped={false} vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}

const CONTINUOUS = new Set<LedEffect>(['breathing', 'wave', 'rainbow', 'pinwheel', 'raindrops'])

/** Drives continuous LED effects at 30 fps — plenty for slow colour changes, half the work of 60. */
export function LedTicker({ effect }: { effect: LedEffect }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!CONTINUOUS.has(effect)) return
    const id = setInterval(() => invalidate(), 1000 / 30)
    return () => clearInterval(id)
  }, [effect, invalidate])
  return null
}
