import { describe, expect, it } from 'vitest'
import { defaultDesign } from '../store/design'
import { PRESETS } from './layout'
import { designFile, readDesignFile, readShareFragment, shareFragment } from './share'
import type { Design } from '../types'

const rich = (): Design => ({
  ...defaultDesign(),
  keys: PRESETS.Full(),
  components: [{ id: 'c', type: 'controller', x: 9, y: -3.6, model: 'zero', mount: 'raised', screen: true, rot: 15, color: '#ff8a1f' }],
  pocketFills: [{ x: 10, y: 20, t: 0.4 }],
  board: { ...defaultDesign().board, caseColor: '#2f4f7f', wallColor: '#f4f2ec', ledEffect: 'ripple', tiltDeg: 8 },
})

describe('design files and share links', () => {
  it('a design file reads back exactly', () => {
    const d = rich()
    expect(readDesignFile(designFile(d))).toEqual(d)
  })

  it('a share link reads back exactly, and stays short enough for a URL even for a full-size board', () => {
    const d = rich()
    const frag = shareFragment(d)
    expect(frag.startsWith('#d=')).toBe(true)
    expect(frag.length).toBeLessThan(8000) // browsers and chat apps cope with this comfortably
    expect(readShareFragment(frag)).toEqual(d)
  })

  it('rejects anything that is not a design: other JSON, garbage, broken links', () => {
    expect(readDesignFile('{"hello": "world"}')).toBeNull()
    expect(readDesignFile('not json')).toBeNull()
    expect(readDesignFile(JSON.stringify({ ...rich(), keys: [{ id: 'k', x: 'left' }] }))).toBeNull()
    expect(readShareFragment('#d=AAAA')).toBeNull()
    expect(readShareFragment('#other')).toBeNull()
    expect(readShareFragment('')).toBeNull()
  })
})
