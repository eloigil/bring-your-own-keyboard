import { useEffect, useRef } from 'react'
import { useDesign } from '../store/design'

/** Top-right switch between the light studio and a dark room (to see the LEDs glow). The scene plays a sunset / sunrise. */
export function ThemeToggle() {
  const dark = useDesign((s) => s.dark)
  const first = useRef(true)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = dark ? 'dark' : 'light'
    if (first.current) return void (first.current = false)
    // panels fade along with the sky instead of snapping
    root.dataset.theming = ''
    const t = setTimeout(() => delete root.dataset.theming, 2200)
    return () => clearTimeout(t)
  }, [dark])
  return (
    <button className="card theme-toggle" onClick={useDesign.getState().toggleDark} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      <span key={String(dark)} className="glyph">{dark ? '☀' : '☾'}</span>
    </button>
  )
}
