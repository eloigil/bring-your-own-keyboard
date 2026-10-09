import { useEffect } from 'react'
import { Stage } from '../scene/Stage'
import { Board } from '../scene/Board'
import { useDesign } from '../store/design'
import { StepsPanel } from './StepsPanel'
import { OptionsPanel } from './OptionsPanel'

export function Editor() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { selectedId, deleteKey, step } = useDesign.getState()
      if (step === 'Build' && selectedId && (e.key === 'Delete' || e.key === 'Backspace') && !(e.target instanceof HTMLInputElement)) deleteKey(selectedId)
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
    </>
  )
}
