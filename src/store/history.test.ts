import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDesign } from './design'
import { redo, undo, useHistory } from './history'

describe('undo / redo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useDesign.getState().setPreset('TKL')
    vi.advanceTimersByTime(1000)
    useHistory.setState({ past: [], future: [] })
  })
  const later = () => vi.advanceTimersByTime(1000) // separate steps
  const keyCount = () => useDesign.getState().design.keys.length

  it('undoes a preset switch, and redoes it', () => {
    const before = keyCount()
    useDesign.getState().setPreset('60%')
    expect(keyCount()).not.toBe(before)
    undo()
    expect(keyCount()).toBe(before)
    expect(useDesign.getState().preset).toBe('TKL')
    redo()
    expect(useDesign.getState().preset).toBe('60%')
  })

  it('a drag (many moves in quick succession) is one step; separate edits are separate steps', () => {
    const id = useDesign.getState().design.keys[0].id
    const x0 = useDesign.getState().design.keys[0].x
    for (let i = 1; i <= 10; i++) {
      useDesign.getState().moveKey(id, x0 - i * 0.5, -3)
      vi.advanceTimersByTime(16)
    }
    later()
    useDesign.getState().deleteKey(useDesign.getState().design.keys[1].id)
    expect(useHistory.getState().past).toHaveLength(2)
    undo() // the delete
    undo() // the whole drag
    expect(useDesign.getState().design.keys[0].x).toBe(x0)
    expect(useHistory.getState().past).toHaveLength(0)
  })

  it('a new edit after undo drops the redo branch', () => {
    useDesign.getState().setTilt(10)
    later()
    undo()
    expect(useHistory.getState().future).toHaveLength(1)
    useDesign.getState().setTilt(3)
    expect(useHistory.getState().future).toHaveLength(0)
  })
})
