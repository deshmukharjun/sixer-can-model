import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { EffectComposer, HueSaturation } from '@react-three/postprocessing'
import { Color } from 'three'
import { Can } from './Can'
import type { Flavor, MaterialFinish } from './Can'
import { Lighting } from './Lighting'
import type { LightColor } from './Lighting'
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
  const [finish, setFinish] = useState<MaterialFinish>('old')
  const [dewDrops, setDewDrops] = useState(false)
  const [lightColor, setLightColor] = useState<LightColor>('white')

  const handleFlavorSwitch = () => {
    const nextIndex = (FLAVOR_ORDER.indexOf(flavor) + 1) % FLAVOR_ORDER.length
    setFlavor(FLAVOR_ORDER[nextIndex])
  }

  const handleFinishSwitch = () => {
    setFinish((prev) => (prev === 'old' ? 'new' : 'old'))
  }

  return (
    <section className="can-showcase" aria-label="Product showcase">
      {/* No `shadows`: the rig is all RectAreaLights, which three.js can't
          shadow-map. Grounding comes from ContactShadows below instead.
          Exposure is back at 1 — the old value of 5 existed to compensate for
          a much dimmer directional rig. */}
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, toneMappingExposure: 1 }}
        camera={{ position: [0, 0.4, 10], fov: 21 }}
      >
        <BackgroundColor flavor={flavor} />
        <Lighting lightColor={lightColor} />
        <Suspense fallback={null}>
          <Can flavor={flavor} isOpen={isOpen} finish={finish} dewDrops={dewDrops} />
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
            fixed product-shot framing. The can holds whatever angle the user
            leaves it at. */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          enableDamping
          dampingFactor={0.08}
        />
        {/* Saturation is left alone: the +0.2 pop this used to apply pushed the
            can's blue toward cyan and away from the brand artwork. The label
            textures already carry the intended color. */}
        <EffectComposer>
          <HueSaturation saturation={0} />
        </EffectComposer>
      </Canvas>

      <div className="can-showcase__controls can-showcase__controls--top">
        <button
          type="button"
          className="can-showcase__button"
          onClick={() => setLightColor((prev) => (prev === 'white' ? 'yellow' : 'white'))}
        >
          {lightColor === 'white' ? 'White Light' : 'Yellow Light'}
        </button>
        <button type="button" className="can-showcase__button" onClick={handleFinishSwitch}>
          {finish === 'old' ? 'Glossy Finish' : 'Matte Finish'}
        </button>
        <button
          type="button"
          className="can-showcase__button"
          onClick={() => setDewDrops((prev) => !prev)}
        >
          {dewDrops ? 'Remove Dew Drops' : 'Add Dew Drops'}
        </button>
      </div>

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
