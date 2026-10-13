import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { Component } from '../types'
import type { Family } from '../lib/units'
import { CASE_HEIGHT, PITCH } from '../lib/units'
import { BOTTOM_T, PICO, PLATE_RECESS, STANDOFF_H } from '../lib/case'
import { COMPONENTS } from '../data/components'

const RED = new THREE.Color('#e5484d')
const ACCENT = new THREE.Color('#5b5bd6')
const BODY = '#3a3940'
const GLASS = '#15141a'

/** Body colour: accent-tinted when selected, pulsing red when the part overlaps a key. */
function useTint(invalid?: boolean, selected?: boolean, base = BODY) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)
  const tint = (t: number) => {
    if (!mat.current) return
    const c = mat.current.color.set(base)
    if (selected) c.lerp(ACCENT, 0.4)
    if (invalid) c.lerp(RED, 0.45 + 0.35 * Math.sin(t * 5))
  }
  useEffect(() => (tint(0), invalidate()), [selected, invalid]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock, invalidate }) => {
    if (!invalid) return
    tint(clock.elapsedTime)
    invalidate()
  })
  return mat
}

type Props = { c: Component; family: Family; invalid?: boolean; selected?: boolean }

/** A part sitting on the plate, origin at the centre of its footprint on the plate's top. */
export function ComponentModel(props: Props) {
  const Model = MODELS[props.c.type]
  return <Model {...props} />
}

const colorOf = (c: Component) => c.color ?? COMPONENTS[c.type].color

const Knob = ({ c, invalid, selected }: Props) => {
  const mat = useTint(invalid, selected, colorOf(c))
  const R = 8.5, H = 16
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow>
        <cylinderGeometry args={[R, R, H, 48]} />
        <meshStandardMaterial ref={mat} color={colorOf(c)} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, H + 0.05, -R / 2]}>
        <boxGeometry args={[1.2, 0.2, R * 0.8]} />
        <meshStandardMaterial color="#f4f2ec" />
      </mesh>
    </group>
  )
}

const Screen = ({ c, invalid, selected }: Props) => {
  const mat = useTint(invalid, selected, colorOf(c))
  return (
    <group>
      {/* the OLED module's board, then the glass with a few glowing "text" lines */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[38, 2, 12]} />
        <meshStandardMaterial ref={mat} color={colorOf(c)} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <boxGeometry args={[30, 0.6, 11.5]} />
        <meshStandardMaterial color={GLASS} roughness={0.15} metalness={0.2} />
      </mesh>
      {[[-6, -3, 14], [-9, 0, 8], [-4, 3, 18]].map(([x, z, w]) => (
        <mesh key={z} position={[x, 2.65, z]}>
          <boxGeometry args={[w, 0.05, 1.2]} />
          <meshBasicMaterial color="#9fe7ff" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

const Trackball = ({ c, invalid, selected }: Props) => {
  const mat = useTint(invalid, selected, colorOf(c))
  return (
    <group>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[20, 21, 6, 48]} />
        <meshStandardMaterial color={BODY} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 12, 0]} castShadow>
        <sphereGeometry args={[17, 40, 28]} />
        <meshPhysicalMaterial ref={mat as never} color={colorOf(c)} roughness={0.12} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
    </group>
  )
}

const Joystick = ({ c, invalid, selected }: Props) => {
  const mat = useTint(invalid, selected, colorOf(c))
  return (
    <group>
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[12, 13, 4, 40]} />
        <meshStandardMaterial color={BODY} roughness={0.5} />
      </mesh>
      <mesh position={[0, 6, 0]}>
        <sphereGeometry args={[6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#26252c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 12, 0]} castShadow>
        <cylinderGeometry args={[2.2, 2.6, 12, 16]} />
        <meshStandardMaterial color="#26252c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 19, 0]} castShadow>
        <cylinderGeometry args={[7, 6, 3, 32]} />
        <meshStandardMaterial ref={mat} color={colorOf(c)} roughness={0.6} />
      </mesh>
    </group>
  )
}

const Touchpad = ({ c, invalid, selected }: Props) => {
  const mat = useTint(invalid, selected, colorOf(c))
  return (
    <group>
      <RoundedBox args={[40, 2.5, 40]} radius={2} smoothness={3} position={[0, 1.25, 0]} castShadow>
        <meshStandardMaterial ref={mat} color={colorOf(c)} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[38, 0.8, 38]} radius={1.5} smoothness={3} position={[0, 2.8, 0]}>
        <meshPhysicalMaterial color="#1c1b21" roughness={0.08} clearcoat={1} />
      </RoundedBox>
    </group>
  )
}

const Slider = ({ c, invalid, selected }: Props) => {
  const mat = useTint(invalid, selected, colorOf(c))
  return (
    <group>
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[74, 3, 11]} />
        <meshStandardMaterial color={BODY} roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <boxGeometry args={[62, 0.3, 2]} />
        <meshStandardMaterial color={GLASS} />
      </mesh>
      {/* the fader cap, a third of the way along */}
      <mesh position={[-10, 8, 0]} castShadow>
        <boxGeometry args={[8, 10, 9]} />
        <meshStandardMaterial ref={mat} color={colorOf(c)} roughness={0.5} />
      </mesh>
      <mesh position={[-10, 13.05, 0]}>
        <boxGeometry args={[0.8, 0.1, 9]} />
        <meshStandardMaterial color="#f4f2ec" />
      </mesh>
    </group>
  )
}

/**
 * A Raspberry Pi Pico lying on its standoffs below the plate, seen through the plate's window. Origin is the plate
 * top, so the board is drawn that far down. USB end towards -z (the back, before rotation).
 */
const Controller = ({ c, family, invalid, selected }: Props) => {
  const mat = useTint(invalid, selected, colorOf(c))
  const y = BOTTOM_T + STANDOFF_H - (CASE_HEIGHT[family] - PLATE_RECESS) // the board's underside, relative to the plate top
  const { w, l, pcb, usbH } = PICO
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, pcb / 2, 0]} castShadow>
        <boxGeometry args={[w, pcb, l]} />
        <meshStandardMaterial ref={mat} color={colorOf(c)} roughness={0.6} />
      </mesh>
      {/* RP2040, flash chip, BOOTSEL button, the micro-USB socket at the back end, and the castellated pads */}
      <mesh position={[0, pcb + 0.45, 2]}>
        <boxGeometry args={[7, 0.9, 7]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.4} />
      </mesh>
      <mesh position={[0, pcb + 0.4, -9]}>
        <boxGeometry args={[4, 0.8, 5]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.4} />
      </mesh>
      <mesh position={[-5, pcb + 0.6, -14]}>
        <boxGeometry args={[3, 1.2, 4]} />
        <meshStandardMaterial color="#f4f2ec" roughness={0.5} />
      </mesh>
      <mesh position={[0, pcb + usbH / 2, -l / 2 + 2.2]} castShadow>
        <boxGeometry args={[8, usbH, 5.5]} />
        <meshStandardMaterial color="#c9cdd4" metalness={0.9} roughness={0.25} />
      </mesh>
      {[-1, 1].map((side) =>
        Array.from({ length: 20 }, (_, i) => (
          <mesh key={`${side}${i}`} position={[side * (w / 2 - 0.9), pcb + 0.02, -l / 2 + 2.4 + i * 2.54]}>
            <boxGeometry args={[1.5, 0.04, 1.6]} />
            <meshStandardMaterial color="#d4a64a" metalness={0.9} roughness={0.3} />
          </mesh>
        )),
      )}
    </group>
  )
}

const MODELS: Record<Component['type'], (p: Props) => React.ReactElement> = { controller: Controller, knob: Knob, screen: Screen, trackball: Trackball, joystick: Joystick, touchpad: Touchpad, slider: Slider }

/** Where a component's model sits: the centre of its footprint, in mm. */
export function componentCentre(c: Component, family: Family): [number, number] {
  const { w, h } = COMPONENTS[c.type]
  const p = PITCH[family]
  return [(c.x + w / 2) * p.x, (c.y + h / 2) * p.y]
}
