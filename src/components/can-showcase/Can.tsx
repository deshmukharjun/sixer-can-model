import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const MODEL_PATH = '/can-classic-1.glb'

// Scales the can down on narrow viewports so it doesn't dominate mobile screens.
function responsiveScaleFor(width: number) {
  if (width < 480) return 0.7
  if (width < 768) return 0.85
  return 1
}

function useResponsiveScale() {
  const [scale, setScale] = useState(() => responsiveScaleFor(window.innerWidth))

  useEffect(() => {
    const handleResize = () => setScale(responsiveScaleFor(window.innerWidth))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return scale
}

export function Can() {
  const { scene } = useGLTF(MODEL_PATH)
  const floatRef = useRef<THREE.Group>(null)
  const responsiveScale = useResponsiveScale()

  // Re-pivot the model to its own bounding-box center so it's perfectly
  // centered regardless of how the source file authored its origin.
  const { object, baseScale } = useMemo(() => {
    const cloned = scene.clone(true)
    const box = new THREE.Box3().setFromObject(cloned)
    const center = box.getCenter(new THREE.Vector3())
    cloned.position.sub(center)

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    const size = box.getSize(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z)

    return {
      object: cloned,
      // Normalize to a consistent on-screen size no matter the source scale.
      baseScale: maxDimension > 0 ? 2.4 / maxDimension : 1,
    }
  }, [scene])

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime()

    if (floatRef.current) {
      // Gentle vertical float. Rotation is driven by OrbitControls
      // (drag-to-rotate + autoRotate), not here, to avoid fighting the user's input.
      floatRef.current.position.y = Math.sin(elapsed * 1.1) * 0.15
    }
  })

  return (
    <group ref={floatRef}>
      <primitive object={object} scale={baseScale * responsiveScale} />
    </group>
  )
}

useGLTF.preload(MODEL_PATH)
