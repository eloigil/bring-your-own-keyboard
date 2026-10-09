import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Design, Step } from '../types'
import { PRESETS, type PresetName } from '../lib/layout'
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
  setStep: (s: Step) => void
  setPreset: (p: PresetName) => void
}

export const useDesign = create<State>()(
  persist(
    (set) => ({
      design: defaultDesign(),
      preset: 'TKL',
      step: 'Layout',
      setStep: (step) => set({ step }),
      setPreset: (p) => set((s) => ({ preset: p, design: { ...s.design, keys: PRESETS[p](), components: [], pocketFills: [] } })),
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
