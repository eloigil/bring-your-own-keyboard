import { useEffect } from 'react'
import { useDesign } from '../store/design'

/** Top-right switch between the light studio and a dark room (to see the LEDs glow). */
export function ThemeToggle() {
  const dark = useDesign((s) => s.dark)
  useEffect(() => void (document.documentElement.dataset.theme = dark ? 'dark' : 'light'), [dark])
  return (
    <button className="card theme-toggle" onClick={useDesign.getState().toggleDark} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? '☀' : '☾'}
    </button>
  )
}
