import { Stage } from '../scene/Stage'
import { Board } from '../scene/Board'
import { familyOf, useDesign } from '../store/design'
import { StepsPanel } from './StepsPanel'
import { OptionsPanel } from './OptionsPanel'

export function Editor() {
  const keys = useDesign((s) => s.design.keys)
  const family = useDesign((s) => familyOf(s.design.board.switchId))
  return (
    <>
      <Stage>
        <Board keys={keys} family={family} />
      </Stage>
      <StepsPanel />
      <OptionsPanel />
    </>
  )
}
