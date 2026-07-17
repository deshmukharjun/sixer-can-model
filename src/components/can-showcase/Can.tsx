import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export type Flavor = 'classic' | 'lime' | 'peach'

export const MODEL_PATHS: Record<Flavor, { closed: string; open: string }> = {
  classic: { closed: '/classic-closed.glb', open: '/classic-opened.glb' },
  lime: { closed: '/lime-closed.glb', open: '/lime-opened.glb' },
  peach: { closed: '/peach-closed.glb', open: '/peach-opened.glb' },
}

const ALL_PATHS = Object.values(MODEL_PATHS).flatMap((p) => [p.closed, p.open])

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

// Re-pivots a model to its own bounding-box center so it's perfectly centered
// regardless of how the source file authored its origin, and normalizes it to
// a consistent on-screen size no matter the source scale.
function prepareModel(scene: THREE.Object3D) {
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
    baseScale: maxDimension > 0 ? 2.4 / maxDimension : 1,
  }
}

const SPIN_DURATION = 0.6 // seconds
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

interface CanProps {
  flavor: Flavor
  isOpen: boolean
}

export function Can({ flavor, isOpen }: CanProps) {
  const targetPath = isOpen ? MODEL_PATHS[flavor].open : MODEL_PATHS[flavor].closed
  const gltfs = useGLTF(ALL_PATHS)

  const models = useMemo(() => {
    const map = new Map<string, { object: THREE.Object3D; baseScale: number }>()
    ALL_PATHS.forEach((path, i) => {
      map.set(path, prepareModel(gltfs[i].scene))
    })
    return map
  }, [gltfs])

  const [displayedPath, setDisplayedPath] = useState(targetPath)
  const floatRef = useRef<THREE.Group>(null)
  const responsiveScale = useResponsiveScale()

  const spinRef = useRef({ active: false, progress: 0, swapped: false })

  useEffect(() => {
    if (targetPath !== displayedPath) {
      spinRef.current = { active: true, progress: 0, swapped: false }
    }
  }, [targetPath, displayedPath])

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime()
    const spin = spinRef.current

    if (spin.active && floatRef.current) {
      spin.progress = Math.min(spin.progress + delta / SPIN_DURATION, 1)
      const eased = easeInOutCubic(spin.progress)
      floatRef.current.rotation.y = eased * Math.PI * 2

      if (spin.progress >= 0.5 && !spin.swapped) {
        spin.swapped = true
        setDisplayedPath(targetPath)
      }

      if (spin.progress >= 1) {
        spin.active = false
        floatRef.current.rotation.y = 0
      }
    }

    if (floatRef.current) {
      // Gentle vertical float. Horizontal rotation is driven by OrbitControls
      // (drag-to-rotate + autoRotate) and, transiently, by the spin above.
      floatRef.current.position.y = Math.sin(elapsed * 1.1) * 0.15
    }
  })

  const current = models.get(displayedPath)
  if (!current) return null

  return (
    <group ref={floatRef}>
      <primitive object={current.object} scale={current.baseScale * responsiveScale} />
    </group>
  )
}

useGLTF.preload(ALL_PATHS)
