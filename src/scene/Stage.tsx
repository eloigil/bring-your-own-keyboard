import { Canvas } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei'
import type { ReactNode } from 'react'

/** Neutral studio: soft light-grey backdrop, key + fill light, contact shadow. No remote HDR, works offline. */
export function Stage({ children, onPointerMissed }: { children: ReactNode; onPointerMissed?: () => void }) {
  return (
    // frameloop="demand": draw only when something changes (orbit, drag, animation) — idle costs nothing
    <Canvas shadows frameloop="demand" onPointerMissed={onPointerMissed} camera={{ position: [0, 380, 440], fov: 35, near: 1, far: 5000 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#e9e8ec']} />
      <hemisphereLight args={['#ffffff', '#c9c6cf', 1.4]} />
      <directionalLight position={[-150, 300, 200]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-300, 300, 300, -300, 1, 1000]} />
      </directionalLight>
      <directionalLight position={[200, 120, -150]} intensity={0.6} />
      {children}
      {/* scale reference: 1 cm cells, 10 cm sections, fading out in a circle around the board (fadeFrom 0 = from the origin) */}
      <Grid
        position={[0, -0.1, 0]}
        args={[1200, 1200]}
        cellSize={10}
        cellThickness={0.8}
        cellColor="#bdb7c8"
        sectionSize={100}
        sectionThickness={1.4}
        sectionColor="#a39cb2"
        fadeDistance={330}
        fadeStrength={1.3}
        fadeFrom={0}
      />
      <ContactShadows position={[0, -0.2, 0]} scale={700} blur={2.6} opacity={0.35} far={60} resolution={1024} />
      <OrbitControls enableDamping makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={120} maxDistance={900} />
    </Canvas>
  )
}
