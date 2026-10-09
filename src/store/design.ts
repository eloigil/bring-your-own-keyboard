import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Design, Step } from '../types'
import { PRESETS, newId, snap, type PresetName } from '../lib/layout'
import type { Family } from '../lib/units'

export const STORAGE_KEY = 'byokb-design'

export function defaultDesign(): Design {
  return {
    version: 1,
    keys: PRESETS.TKL(),
    components: [],
    board: { switchId: 'cherry-mx-red', profileId: 'cherry', keycapColor: '#f4f2ec', snap: 'snap', ledEffect: 'none' },
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
  return ok ? d : defaultDesign()
}

// ponytail: family from the switch id until the catalog lands in slice 5
export const familyOf = (switchId: string): Family => (switchId.includes('choc') ? 'Choc' : 'MX')

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
  deleteKey: (id: string) => void
  setPocketFill: (x: number, y: number, d: number) => void
}

/** Pocket fills closer than this (mm) to a new one are the same pocket. */
const SAME_POCKET = 19

export const useDesign = create<State>()(
  persist(
    (set) => ({
      design: defaultDesign(),
      preset: 'TKL',
      step: 'Layout',
      setStep: (step) => set({ step }),
      selectedId: null,
      setPreset: (p) => set((s) => ({ preset: p, selectedId: null, design: { ...s.design, keys: PRESETS[p](), components: [], pocketFills: [] } })),
      select: (selectedId) => set({ selectedId }),
      moveKey: (id, x, y) =>
        set((s) => {
          const [sx, sy] = [snap(x), snap(y)]
          const k = s.design.keys.find((k) => k.id === id)
          if (!k || (k.x === sx && k.y === sy)) return s
          return { preset: null, design: { ...s.design, keys: s.design.keys.map((k) => (k.id === id ? { ...k, x: sx, y: sy } : k)) } }
        }),
      addKey: () =>
        set((s) => {
          const keys = s.design.keys
          const y = keys.length ? Math.max(...keys.map((k) => k.y + k.h)) + 0.25 : 0
          const key = { id: newId(), x: 0, y: snap(y), w: 1, h: 1, rot: 0 }
          return { preset: null, selectedId: key.id, design: { ...s.design, keys: [...keys, key] } }
        }),
      deleteKey: (id) =>
        set((s) => ({ preset: null, selectedId: null, design: { ...s.design, keys: s.design.keys.filter((k) => k.id !== id) } })),
      setPocketFill: (x, y, d) =>
        set((s) => ({
          design: {
            ...s.design,
            pocketFills: [...s.design.pocketFills.filter((f) => Math.hypot(f.x - x, f.y - y) >= SAME_POCKET), { x, y, d }],
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
        return { ...current, design, preset: design === p?.design ? (p.preset ?? null) : 'TKL' }
      },
    },
  ),
)
