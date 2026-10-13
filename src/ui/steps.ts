import { DownloadSimple, Hammer, Lightbulb, SquaresFour, type Icon } from '@phosphor-icons/react'
import type { Step } from '../types'

/** The four steps, in order: label, icon, and the one line the inspector shows under its title. */
export const STEPS: { step: Step; label: string; icon: Icon; hint: string }[] = [
  { step: 'Layout', label: 'Layout', icon: SquaresFour, hint: 'Start from a layout and set the typing angle.' },
  { step: 'Build', label: 'Build', icon: Hammer, hint: 'Drag keys, add parts, pick switches and caps.' },
  { step: 'LEDs', label: 'Lights', icon: Lightbulb, hint: 'Pick an effect. The firmware runs the same one.' },
  { step: 'Export', label: 'Export', icon: DownloadSimple, hint: 'The files to print and flash.' },
]
