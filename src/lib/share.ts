import { strFromU8, strToU8, unzlibSync, zlibSync } from 'fflate'
import { isDesign } from '../store/design'
import type { Design } from '../types'

/** A design as a file: pretty JSON, so it diffs and can be read. */
export const designFile = (d: Design) => JSON.stringify(d, null, 2)

/** Parse a design file; null if it isn't a BYOKb design. */
export function readDesignFile(text: string): Design | null {
  try {
    const d: unknown = JSON.parse(text)
    return isDesign(d) ? d : null
  } catch {
    return null
  }
}

// share links carry the design in the URL fragment (never sent to a server): deflated JSON, base64url
const toB64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export const shareFragment = (d: Design) => `#d=${toB64(zlibSync(strToU8(JSON.stringify(d)), { level: 9 }))}`

/** The design in a share-link fragment (`#d=…`), or null if there is none or it doesn't read back as a design. */
export function readShareFragment(hash: string): Design | null {
  const m = /^#d=([A-Za-z0-9_-]+)$/.exec(hash)
  if (!m) return null
  try {
    const d: unknown = JSON.parse(strFromU8(unzlibSync(fromB64(m[1]))))
    return isDesign(d) ? d : null
  } catch {
    return null
  }
}
