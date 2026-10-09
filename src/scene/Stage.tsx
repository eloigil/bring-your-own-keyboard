import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import type { ReactNode } from 'react'

/** Neutral studio: soft light-grey backdrop, key + fill light, contact shadow. No remote HDR, works offline. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <Canvas shadows camera={{ position: [0, 380, 440], fov: 35, near: 1, far: 5000 }} dpr={[1, 2]}>
      <color attach="background" args={['#e9e8ec']} />
      <hemisphereLight args={['#ffffff', '#c9c6cf', 1.4]} />
      <directionalLight position={[-150, 300, 200]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-300, 300, 300, -300, 1, 1000]} />
      </directionalLight>
      <directionalLight position={[200, 120, -150]} intensity={0.6} />
      {children}
      <ContactShadows position={[0, -0.2, 0]} scale={700} blur={2.6} opacity={0.35} far={60} resolution={1024} />
      <OrbitControls enableDamping makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={120} maxDistance={900} />
    </Canvas>
  )
}
