import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei'
import type { ReactNode } from 'react'
import { useDesign } from '../store/design'

// Light studio by default; "dark" dims the room so the backlight and LEDs read like they would at night.
const ROOM = {
  light: { bg: '#e9e8ec', sky: 1.4, key: 2.2, fill: 0.6, cell: '#bdb7c8', section: '#b8b2c5', shadow: 0.35, env: 0.12 },
  dark: { bg: '#0f0e13', sky: 0.12, key: 0.3, fill: 0.08, cell: '#24222c', section: '#2e2b38', shadow: 0.6, env: 0.04 },
}

/** Studio: backdrop, key + fill light, contact shadow, scale grid. No remote HDR, works offline. */
export function Stage({ children, onPointerMissed }: { children: ReactNode; onPointerMissed?: () => void }) {
  const r = ROOM[useDesign((s) => (s.dark ? 'dark' : 'light'))]
  return (
    // frameloop="demand": draw only when something changes (orbit, drag, animation) — idle costs nothing
    <Canvas shadows frameloop="demand" onPointerMissed={onPointerMissed} camera={{ position: [0, 380, 440], fov: 35, near: 1, far: 5000 }} dpr={[1, 1.5]}>
      <color attach="background" args={[r.bg]} />
      <hemisphereLight args={['#ffffff', '#c9c6cf', r.sky]} />
      <directionalLight position={[-150, 300, 200]} intensity={r.key} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-300, 300, 300, -300, 1, 1000]} />
      </directionalLight>
      <directionalLight position={[200, 120, -150]} intensity={r.fill} />
      {/* soft studio reflections, built from shapes (no HDR download): faint on everything, clear caps scale it up */}
      <Environment resolution={128} environmentIntensity={r.env}>
        <Lightformer form="rect" intensity={3} position={[0, 400, 0]} rotation-x={Math.PI / 2} scale={[600, 300, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-500, 150, 200]} rotation-y={Math.PI / 2} scale={[400, 120, 1]} />
        <Lightformer form="rect" intensity={1} position={[500, 100, -200]} rotation-y={-Math.PI / 2} scale={[300, 100, 1]} />
      </Environment>
      {children}
      {/* scale reference: 1 cm cells, 10 cm sections, fading out in a circle around the board (fadeFrom 0 = from the origin) */}
      <Grid
        position={[0, -0.1, 0]}
        args={[1200, 1200]}
        cellSize={10}
        cellThickness={0.8}
        cellColor={r.cell}
        sectionSize={100}
        sectionThickness={1.4}
        sectionColor={r.section}
        fadeDistance={330}
        fadeStrength={1.3}
        fadeFrom={0}
      />
      <ContactShadows position={[0, -0.2, 0]} scale={700} blur={2.6} opacity={r.shadow} far={60} resolution={1024} />
      <OrbitControls enableDamping makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={120} maxDistance={900} />
    </Canvas>
  )
}
