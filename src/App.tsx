import { useMemo, useState } from 'react'
import { Stage } from './scene/Stage'
import { Board } from './scene/Board'
import { alice, split, tkl } from './lib/layout'

// Slice 1: three hardcoded test boards to judge the computed case.
const BOARDS = { TKL: tkl, Split: split, Alice: alice }
type BoardName = keyof typeof BOARDS

export default function App() {
  const [name, setName] = useState<BoardName>('TKL')
  const keys = useMemo(() => BOARDS[name](), [name])
  return (
    <>
      <Stage>
        <Board keys={keys} family="MX" />
      </Stage>
      <div className="card toolbar">
        {(Object.keys(BOARDS) as BoardName[]).map((n) => (
          <button key={n} className={n === name ? 'active' : ''} onClick={() => setName(n)}>
            {n}
          </button>
        ))}
      </div>
    </>
  )
}
