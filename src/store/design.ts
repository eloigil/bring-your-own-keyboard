import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Design, Key, Step } from '../types'
import { PRESETS, newId, resizeFree, snap, snapAside, snapSize, type PresetName } from '../lib/layout'
import { TILT_DEG, TILT_MAX } from '../lib/case'

export const STORAGE_KEY = 'byokb-design'

export function defaultDesign(): Design {
  return {
    version: 1,
    keys: PRESETS.TKL(),
    components: [],
    board: { switchId: 'cherry-mx-red', profileId: 'cherry', keycapColor: '#f4f2ec', snap: 'snap', ledEffect: 'none', tiltDeg: TILT_DEG },
    pocketFills: [],
  }
}

/** Accept a saved design only if it has the current version and a sane shape; otherwise start over on TKL. */
export function loadDesign(raw: unknown): Design {
  const d = raw as Design | undefined
  const ok =
    d?.version === 1 &&
    Array.isArray(d.keys) &&
    d.keys.every((k) => typeof k?.id === 'string' && [k.x, k.y, k.w, k.h, k.rot].every(Number.isFinite)) &&
    Array.isArray(d.components) &&
    typeof d.board?.switchId === 'string' &&
    Array.isArray(d.pocketFills)
  // designs saved before the tilt slider existed get the default angle
  if (!ok) return defaultDesign()
  return Number.isFinite(d.board.tiltDeg) ? d : { ...d, board: { ...d.board, tiltDeg: TILT_DEG } }
}

export { familyOf } from '../lib/catalog'

interface State {
  design: Design
  preset: PresetName | null
  step: Step
  selectedId: string | null
  setStep: (s: Step) => void
  setPreset: (p: PresetName) => void
  select: (id: string | null) => void
  moveKey: (id: string, x: number, y: number) => void
  addKey: () => void
  addKnob: () => void
  /** After dragging a component: keys in its rows slide aside to make room. */
  dropComponent: (id: string) => void
  deleteKey: (id: string) => void
  setPocketFill: (x: number, y: number, t: number) => void
  setTilt: (deg: number) => void
  setSwitch: (id: string) => void
  setKeycaps: (patch: { profileId?: string; keycapColor?: string }) => void
  /** Give one key its own switch/keycap settings; null clears them. */
  setOverride: (keyId: string, patch: Key['override'] | null) => void
  setSnapMode: (mode: 'snap' | 'free') => void
  /** Resize from the board's left edge to `width` units, by the current snap mode. */
  resizeTo: (width: number) => void
}

/** Pocket fills closer than this (mm) to a new one are the same pocket. */
const SAME_POCKET = 19

export const useDesign = create<State>()(
  persist(
    (set, get) => ({
      design: defaultDesign(),
      preset: 'TKL',
      step: 'Layout',
      setStep: (step) => set({ step }),
      selectedId: null,
      setPreset: (p) => set((s) => ({ preset: p, selectedId: null, design: { ...s.design, keys: PRESETS[p](), components: [], pocketFills: [] } })),
      select: (selectedId) => set({ selectedId }),
      // moves a key or a component (knob), snapped to the 0.25u grid
      moveKey: (id, x, y) =>
        set((s) => {
          const [sx, sy] = [snap(x), snap(y)]
          const item = s.design.keys.find((k) => k.id === id) ?? s.design.components.find((c) => c.id === id)
          if (!item || (item.x === sx && item.y === sy)) return s
          const move = <T extends { id: string }>(list: T[]) => list.map((k) => (k.id === id ? { ...k, x: sx, y: sy } : k))
          return { preset: null, design: { ...s.design, keys: move(s.design.keys), components: move(s.design.components) } }
        }),
      addKnob: () =>
        set((s) => {
          const keys = s.design.keys
          // start just above the board's top-right corner, clear of every key
          const x = keys.length ? snap(Math.max(...keys.map((k) => k.x + k.w)) - 1) : 0
          const y = keys.length ? snap(Math.min(...keys.map((k) => k.y)) - 1.25) : 0
          const knob = { id: newId(), type: 'knob' as const, x, y }
          return { preset: null, selectedId: knob.id, design: { ...s.design, components: [...s.design.components, knob] } }
        }),
      dropComponent: (id) =>
        set((s) => {
          const c = s.design.components.find((c) => c.id === id)
          if (!c) return s
          const keys = snapAside(s.design.keys, c)
          return keys === s.design.keys ? s : { design: { ...s.design, keys } }
        }),
      addKey: () =>
        set((s) => {
          const keys = s.design.keys
          const y = keys.length ? Math.max(...keys.map((k) => k.y + k.h)) + 0.25 : 0
          const key = { id: newId(), x: 0, y: snap(y), w: 1, h: 1, rot: 0 }
          return { preset: null, selectedId: key.id, design: { ...s.design, keys: [...keys, key] } }
        }),
      deleteKey: (id) =>
        set((s) => ({
          preset: null,
          selectedId: null,
          design: { ...s.design, keys: s.design.keys.filter((k) => k.id !== id), components: s.design.components.filter((c) => c.id !== id) },
        })),
      setSnapMode: (mode) => set((s) => ({ design: { ...s.design, board: { ...s.design.board, snap: mode } } })),
      resizeTo: (width) => {
        const s = get()
        if (s.design.board.snap === 'snap') {
          const name = snapSize(width)
          if (name !== s.preset) s.setPreset(name)
        } else {
          const keys = resizeFree(s.design.keys, width)
          if (keys.length !== s.design.keys.length || keys.some((k, i) => k !== s.design.keys[i]))
            set({ preset: null, selectedId: null, design: { ...s.design, keys } })
        }
      },
      setSwitch: (switchId) => set((s) => ({ design: { ...s.design, board: { ...s.design.board, switchId } } })),
      setKeycaps: (patch) => set((s) => ({ design: { ...s.design, board: { ...s.design.board, ...patch } } })),
      setOverride: (keyId, patch) =>
        set((s) => ({
          design: {
            ...s.design,
            keys: s.design.keys.map((k) => (k.id !== keyId ? k : { ...k, override: patch ? { ...k.override, ...patch } : undefined })),
          },
        })),
      setTilt: (deg) => set((s) => ({ design: { ...s.design, board: { ...s.design.board, tiltDeg: Math.max(0, Math.min(TILT_MAX, deg)) } } })),
      setPocketFill: (x, y, t) =>
        set((s) => ({
          design: {
            ...s.design,
            pocketFills: [...s.design.pocketFills.filter((f) => Math.hypot(f.x - x, f.y - y) >= SAME_POCKET), { x, y, t }],
          },
        })),
    }),
    {
      name: STORAGE_KEY,
      // only the design is saved; UI state (step) is not
      partialize: (s) => ({ design: s.design, preset: s.preset }),
      merge: (saved, current) => {
        const p = saved as Partial<State> | undefined
        const design = loadDesign(p?.design)
        return { ...current, design, preset: design.keys === p?.design?.keys ? (p.preset ?? null) : 'TKL' }
      },
    },
  ),
)

// dev-only handle for poking at the design from the browser console
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { byokb: typeof useDesign }).byokb = useDesign
