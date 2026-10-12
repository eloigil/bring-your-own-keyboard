import { useEffect } from 'react'
import { Stage } from '../scene/Stage'
import { Board } from '../scene/Board'
import { useDesign } from '../store/design'
import { StepsPanel } from './StepsPanel'
import { OptionsPanel } from './OptionsPanel'
import { ThemeToggle } from './ThemeToggle'

export function Editor() {
  useEffect(() => {
    // Build step, something selected, focus not in a field: Delete removes it, arrows nudge it (Shift: a quarter unit,
    // plain: 0.05u ≈ 1 mm), [ and ] rotate it by 5° (Shift: 15°)
    const onKey = (e: KeyboardEvent) => {
      const { selectedId, deleteKey, nudge, rotate, step, design } = useDesign.getState()
      if (step !== 'Build' || !selectedId || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') return deleteKey(selectedId)
      const d = e.shiftKey ? 0.25 : 0.05
      const arrow = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]
      if (arrow) {
        e.preventDefault()
        return nudge(selectedId, arrow[0], arrow[1])
      }
      if (e.key === '[' || e.key === ']') {
        const item = design.keys.find((k) => k.id === selectedId) ?? design.components.find((c) => c.id === selectedId)
        rotate(selectedId, (item?.rot ?? 0) + (e.key === ']' ? 1 : -1) * (e.shiftKey ? 15 : 5))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <>
      <Stage onPointerMissed={() => useDesign.getState().select(null)}>
        <Board />
      </Stage>
      <StepsPanel />
      <OptionsPanel />
      <ThemeToggle />
    </>
  )
}
