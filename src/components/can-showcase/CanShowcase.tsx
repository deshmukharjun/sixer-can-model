import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { Can } from './Can'
import { Lighting } from './Lighting'
import './CanShowcase.css'

// Product-shot showcase: a floating can, centered on a pure white background,
// that the user can freely orbit by dragging the mouse.
//
// frameloop stays at its default ("always") rather than "demand": the can
// animates continuously (float + auto-rotate) and responds to drag input,
// so there is never a moment where the scene is idle enough for on-demand
// rendering to pay off.
export function CanShowcase() {
  return (
    <section className="can-showcase" aria-label="Product showcase">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [0, 0.4, 11], fov: 22 }}
      >
        <color attach="background" args={['#ffffff']} />
        <Lighting />
        <Suspense fallback={null}>
          <Can />
          <Environment preset="studio" environmentIntensity={0.9} />
          {/* Baked once (frames=1): the can's motion is a vertical float only
              (rotation is camera-side via OrbitControls), so its footprint on
              the ground plane never changes and a static shadow is enough. */}
          <ContactShadows
            position={[0, -1.3, 0]}
            opacity={0.35}
            scale={10}
            blur={2.4}
            far={4}
            resolution={512}
            color="#000000"
            frames={1}
          />
        </Suspense>
        {/* Free drag-to-orbit in any direction; zoom/pan stay off to keep the
            fixed product-shot framing. autoRotate keeps the can feeling alive
            whenever the user isn't actively dragging. */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.8}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </section>
  )
}
