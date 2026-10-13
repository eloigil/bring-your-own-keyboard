import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Key } from '../types'
import { PITCH, SWITCH_TRAVEL_HEIGHT, CASE_HEIGHT, type Family } from '../lib/units'
import { caseShape, plateTilt, plateTopAt, wallTopAt } from '../lib/case'
import { validate } from '../lib/validate'
import { familyOf, useDesign } from '../store/design'
import { Keycap } from './Keycap'
import { PocketOrb } from './PocketOrb'
import { hitLocal } from './pointer'
import { caseController, componentFootprint, keyRows } from '../lib/layout'
import { ComponentModel, componentCentre } from './ComponentModel'
import { Case, caseColors } from './Case'
import { KeyLed, LedTicker, type Ripple } from './KeyLed'
import { profileById } from '../data/keycaps'
import { switchById } from '../lib/catalog'

/** The keyboard: case, keycaps and pocket orbs, centered on the origin. Keys are draggable. */
export function Board() {
  const keys = useDesign((s) => s.design.keys)
  const fills = useDesign((s) => s.design.pocketFills)
  const components = useDesign((s) => s.design.components)
  const family = useDesign((s) => familyOf(s.design.board.switchId))
  const selectedId = useDesign((s) => s.selectedId)
  const tiltDeg = useDesign((s) => s.design.board.tiltDeg)
  const board = useDesign((s) => s.design.board)
  const rows = useMemo(() => keyRows(keys), [keys])
  const modColor = useMemo(() => '#' + new THREE.Color(board.keycapColor).lerp(new THREE.Color('#6f7380'), 0.4).getHexString(), [board.keycapColor])
  const shaping = useDesign((s) => s.step === 'Build') // dragging keys and pocket orbs only in the Build step
  const hot = useRef(new Map<string, { current: number }>()) // when the pointer last passed over each key (reactive effect)
  const ripple = useRef<Ripple | null>(null) // where the pointer last touched a key (ripple effect)
  // the board's extent in units, for effects that sweep across it
  const extent = useMemo(() => {
    const xs = keys.map((k) => k.x + k.w / 2), ys = keys.map((k) => k.y + k.h / 2)
    const x0 = Math.min(...xs), y0 = Math.min(...ys)
    return { x0, y0, w: Math.max(1, Math.max(...xs) - x0), h: Math.max(1, Math.max(...ys) - y0) }
  }, [keys])
  const glows = useRef(new Map<string, THREE.Color>()) // each key's live LED colour, shared by its underglow and cap
  const glowOf = (id: string) => glows.current.get(id) ?? (glows.current.set(id, new THREE.Color(0, 0, 0)), glows.current.get(id)!)
  const hotRef = (id: string) => hot.current.get(id) ?? (hot.current.set(id, { current: -99 }), hot.current.get(id)!)
  const invalidateNow = useThree((s) => s.invalidate)
  const clock = useThree((s) => s.clock)
  const p = PITCH[family]

  // components (the knob) sit on the plate like a 1u key: the case, well and cutouts include them
  const footprints = useMemo(() => [...keys, ...components.map(componentFootprint)], [keys, components])
  const controller = useMemo(() => caseController(components), [components])
  const shape = useMemo(() => caseShape(footprints, family, fills), [footprints, family, fills])
  const invalid = useMemo(() => validate(keys, components, family), [keys, components, family])
  const maxZ = useMemo(() => Math.max(...shape.outline.flat().map((q) => q[1])), [shape])

  // Board centre; frozen while dragging so the board doesn't slide under the pointer.
  const [dragging, setDragging] = useState<{ id: string; grab: [number, number] } | null>(null)
  const [center, setCenter] = useState(() => new THREE.Vector3())
  useEffect(() => {
    if (dragging) return
    const pts = shape.outline.flat()
    if (!pts.length) return
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1])
    setCenter(new THREE.Vector3(-(Math.min(...xs) + Math.max(...xs)) / 2, 0, -(Math.min(...zs) + Math.max(...zs)) / 2))
  }, [shape, dragging])

  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const dragHeight = CASE_HEIGHT[family] + SWITCH_TRAVEL_HEIGHT[family]

  const onDown = (k: { id: string; x: number; y: number }) => (e: ThreeEvent<PointerEvent>) => {
    if (!shaping) return
    e.stopPropagation()
    useDesign.getState().select(k.id)
    const hit = hitLocal(e, dragHeight, center)
    if (!hit) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    if (controls) controls.enabled = false
    setDragging({ id: k.id, grab: [hit[0] / p.x - k.x, hit[1] / p.y - k.y] })
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    const hit = hitLocal(e, dragHeight, center)
    if (hit) useDesign.getState().moveKey(dragging.id, hit[0] / p.x - dragging.grab[0], hit[1] / p.y - dragging.grab[1])
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    if (components.some((c) => c.id === dragging.id)) useDesign.getState().dropComponent(dragging.id)
    if (controls) controls.enabled = true
    setDragging(null)
  }

  const tilt = plateTilt(family, tiltDeg)
  return (
    <group position={center}>
      <LedTicker effect={board.ledEffect} />
      <Case keys={footprints} family={family} fills={fills} tilt={tiltDeg} colors={caseColors(board)} controller={controller} />
      {keys.map((k) => {
        const z = (k.y + k.h / 2) * p.y
        const target: [number, number, number] = [(k.x + k.w / 2) * p.x, plateTopAt(z, maxZ, family, tiltDeg) + SWITCH_TRAVEL_HEIGHT[family], z]
        return (
          <Eased key={k.id} target={target} rotation={[tilt, (-k.rot * Math.PI) / 180, 0]}>
            <group
              onPointerDown={onDown(k)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerOver={(e) => {
                if (board.ledEffect !== 'reactive' && board.ledEffect !== 'ripple') return
                e.stopPropagation()
                hotRef(k.id).current = clock.getElapsedTime()
                ripple.current = { x: k.x + k.w / 2, y: k.y + k.h / 2, t: clock.getElapsedTime() }
                invalidateNow()
              }}
            >
              <KeyLed
                w={k.w * p.x - 1}
                d={k.h * p.y - 1}
                y={-SWITCH_TRAVEL_HEIGHT[family] + 0.4}
                effect={board.ledEffect}
                effectColor={board.ledColor}
                id={k.id}
                u={(k.x + k.w / 2 - extent.x0) / extent.w}
                v={(k.y + k.h / 2 - extent.y0) / extent.h}
                ux={k.x + k.w / 2}
                uy={k.y + k.h / 2}
                hot={hotRef(k.id)}
                ripple={ripple}
                glow={glowOf(k.id)}
              />
              <Keycap
                k={k}
                family={family}
                color={k.override?.keycapColor ?? (k.w > 1 ? modColor : board.keycapColor)}
                profile={profileById(k.override?.profileId ?? board.profileId)}
                row={rows.get(k.id) ?? 2}
                stemColor={switchById(k.override?.switchId ?? board.switchId).stemColor}
                housingColor={board.switchColor}
                material={board.keycapMaterial}
                invalid={invalid.has(k.id)}
                selected={shaping && k.id === selectedId}
                glow={glowOf(k.id)}
              />
            </group>
          </Eased>
        )
      })}
      {components.map((c) => {
        const [x, z] = componentCentre(c, family)
        return (
          <Eased key={c.id} target={[x, plateTopAt(z, maxZ, family, tiltDeg), z]} rotation={[tilt, (-(c.rot ?? 0) * Math.PI) / 180, 0]}>
            <group onPointerDown={onDown(c)} onPointerMove={onMove} onPointerUp={onUp}>
              <ComponentModel c={c} family={family} invalid={invalid.has(c.id)} selected={shaping && c.id === selectedId} />
            </group>
          </Eased>
        )
      })}
      {shaping && shape.pockets.map((pk) => <PocketOrb key={`${pk.mouth[0].toFixed(0)},${pk.mouth[1].toFixed(0)}`} pocket={pk} maxZ={maxZ} family={family} offset={center} tilt={tiltDeg} />)}
    </group>
  )
}

/** Glides its children toward `target` instead of jumping. */
function Eased({ target, rotation, children }: { target: [number, number, number]; rotation: [number, number, number]; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const goal = useMemo(() => new THREE.Vector3(...target), [target[0], target[1], target[2]])
  const invalidate = useThree((s) => s.invalidate)
  // start at the target; afterwards only the frame loop moves it (a position prop would snap it on every render)
  useLayoutEffect(() => void ref.current?.position.copy(goal), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => invalidate(), [goal, invalidate])
  useFrame((state, dt) => {
    const p = ref.current?.position
    if (!p || p.distanceToSquared(goal) < 1e-4) return p?.copy(goal)
    p.lerp(goal, 1 - Math.exp(-dt * 18))
    state.invalidate() // keep drawing until it arrives
  })
  return (
    <group ref={ref} rotation={rotation}>
      {children}
    </group>
  )
}
