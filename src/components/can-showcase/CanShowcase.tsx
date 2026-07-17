import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { EffectComposer, HueSaturation } from '@react-three/postprocessing'
import { Color } from 'three'
import { Can } from './Can'
import type { Flavor } from './Can'
import { Lighting } from './Lighting'
import './CanShowcase.css'

const FLAVOR_ORDER: Flavor[] = ['classic', 'lime', 'peach']
const FLAVOR_LABELS: Record<Flavor, string> = {
  classic: 'Classic',
  lime: 'Lime',
  peach: 'Peach',
}

// Pale tints that echo each flavor's can color without overpowering the shot.
const FLAVOR_BACKGROUNDS: Record<Flavor, string> = {
  classic: '#eaf2fb',
  lime: '#eef7e2',
  peach: '#fbeee3',
}

// Smoothly eases the canvas background toward the current flavor's tint
// instead of snapping, so switching flavors feels like a color grade shift.
function BackgroundColor({ flavor }: { flavor: Flavor }) {
  const target = useRef(new Color(FLAVOR_BACKGROUNDS[flavor]))
  target.current.set(FLAVOR_BACKGROUNDS[flavor])

  useFrame((state, delta) => {
    const bg = state.scene.background
    if (bg instanceof Color) {
      bg.lerp(target.current, Math.min(1, delta * 4))
    }
  })

  return <color attach="background" args={[FLAVOR_BACKGROUNDS.classic]} />
}

// Product-shot showcase: a floating can, centered on a pale flavor-tinted
// background, that the user can freely orbit by dragging the mouse.
//
// frameloop stays at its default ("always") rather than "demand": the can
// animates continuously (float + auto-rotate) and responds to drag input,
// so there is never a moment where the scene is idle enough for on-demand
// rendering to pay off.
export function CanShowcase() {
  const [flavor, setFlavor] = useState<Flavor>('classic')
  const [isOpen, setIsOpen] = useState(false)

  const handleFlavorSwitch = () => {
    const nextIndex = (FLAVOR_ORDER.indexOf(flavor) + 1) % FLAVOR_ORDER.length
    setFlavor(FLAVOR_ORDER[nextIndex])
  }

  return (
    <section className="can-showcase" aria-label="Product showcase">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, toneMappingExposure: 5 }}
        camera={{ position: [0, 0.4, 10], fov: 21 }}
      >
        <BackgroundColor flavor={flavor} />
        <Lighting />
        <Suspense fallback={null}>
          <Can flavor={flavor} isOpen={isOpen} />
          <Environment preset="studio" environmentIntensity={0.3} />
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
        {/* Slight color pop only — brightness/contrast stay at their defaults.
            The label-readability fix lives on the can material (see Can.tsx),
            not here, so this doesn't need to darken the whole scene. */}
        <EffectComposer>
          <HueSaturation saturation={0.2} />
        </EffectComposer>
      </Canvas>

      <div className="can-showcase__controls">
        <button type="button" className="can-showcase__button" onClick={handleFlavorSwitch}>
          Flavor: {FLAVOR_LABELS[flavor]}
        </button>
        <button
          type="button"
          className="can-showcase__button"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? 'Close Can' : 'Open Can'}
        </button>
      </div>
    </section>
  )
}
