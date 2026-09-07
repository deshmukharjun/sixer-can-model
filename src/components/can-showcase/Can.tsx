import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { DEW_DROPS_REPEAT, getDewDropsMaps } from './dewDropsTexture'

export type Flavor = 'classic' | 'lime' | 'peach'

export const MODEL_PATHS: Record<Flavor, { closed: string; open: string }> = {
  classic: { closed: '/classic-closed.glb', open: '/classic-opened.glb' },
  lime: { closed: '/lime-closed.glb', open: '/lime-opened.glb' },
  peach: { closed: '/peach-closed.glb', open: '/peach-opened.glb' },
}

const ALL_PATHS = Object.values(MODEL_PATHS).flatMap((p) => [p.closed, p.open])

// Surface polish, applied per material type. These are absolute targets rather
// than adjustments to the authored value on purpose: Object3D.clone() shares
// materials between clones, so a relative tweak would compound every time a
// model is prepared and the can would creep glossier on each re-render.
//
// The printed body wants to be sharper than the .glb authors it (0.2), so the
// light panels tighten into crisp vertical strips. The aluminium cap and base
// must NOT follow it down — at mirror roughness a metal with no environment
// map reflects the empty black world and the cap turns black. It stays
// slightly rougher so it picks the panels up as soft silver instead.
const METALNESS_CUTOFF = 0.5

// The aluminium cap and base stay this rough no matter which body finish is
// selected — the finish toggle is a printed-body-only effect, matching the
// "keep the metal the same" call.
const METAL_ROUGHNESS = 0.26

export type MaterialFinish = 'old' | 'new'

// Body-only presets so the showcase can A/B the current glossy look against
// a flatter, more matte pass without touching the .glb assets themselves.
const BODY_ROUGHNESS: Record<MaterialFinish, number> = {
  old: 0.12,
  new: 0.4,
}

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

// Upgrades a printed-body material to a MeshPhysicalMaterial with a clearcoat
// layer driven by the procedural droplet maps, carrying over every property
// prepareModel already relies on (map, color, roughness, etc). Kept separate
// from the plain MeshStandardMaterial path so the metal cap/base — which
// never gets droplets — stays untouched and cheap to render.
function applyDewDrops(material: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  const { normalMap, maskMap } = getDewDropsMaps()
  ;[normalMap, maskMap].forEach((tex) => tex.repeat.copy(DEW_DROPS_REPEAT))

  // Not physical.copy(material): MeshPhysicalMaterial.copy() assumes its
  // source is also a physical material and unconditionally copies
  // clearcoat-only fields (e.g. clearcoatNormalScale) off it — which a plain
  // MeshStandardMaterial doesn't have, crashing on the read. Carry over only
  // the base properties prepareModel/the .glb actually set instead.
  const physical = new THREE.MeshPhysicalMaterial({
    map: material.map,
    color: material.color,
    roughness: material.roughness,
    metalness: material.metalness,
    normalMap: material.normalMap,
    aoMap: material.aoMap,
    emissive: material.emissive,
    emissiveMap: material.emissiveMap,
    transparent: material.transparent,
    opacity: material.opacity,
    side: material.side,
  })
  physical.clearcoat = 1
  physical.clearcoatRoughness = 0.06
  physical.clearcoatNormalMap = normalMap
  physical.clearcoatNormalScale = new THREE.Vector2(1, 1)
  physical.clearcoatMap = maskMap
  return physical
}

// Re-pivots a model to its own bounding-box center so it's perfectly centered
// regardless of how the source file authored its origin, and normalizes it to
// a consistent on-screen size no matter the source scale.
function prepareModel(scene: THREE.Object3D, finish: MaterialFinish, dewDrops: boolean) {
  const bodyRoughness = BODY_ROUGHNESS[finish]
  const cloned = scene.clone(true)
  const box = new THREE.Box3().setFromObject(cloned)
  const center = box.getCenter(new THREE.Vector3())
  cloned.position.sub(center)

  cloned.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const nextMaterials = materials.map((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return material

        const isBody = material.metalness < METALNESS_CUTOFF
        material.roughness = isBody ? bodyRoughness : METAL_ROUGHNESS

        // Droplets only make sense on the printed body, not the bare
        // aluminium cap/base.
        return isBody && dewDrops ? applyDewDrops(material) : material
      })

      child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0]
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
  finish: MaterialFinish
  dewDrops: boolean
}

export function Can({ flavor, isOpen, finish, dewDrops }: CanProps) {
  const targetPath = isOpen ? MODEL_PATHS[flavor].open : MODEL_PATHS[flavor].closed
  const gltfs = useGLTF(ALL_PATHS)

  const models = useMemo(() => {
    const map = new Map<string, { object: THREE.Object3D; baseScale: number }>()
    ALL_PATHS.forEach((path, i) => {
      map.set(path, prepareModel(gltfs[i].scene, finish, dewDrops))
    })
    return map
  }, [gltfs, finish, dewDrops])

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
      // Gentle vertical float. Horizontal rotation is driven by the user
      // dragging OrbitControls and, transiently, by the spin above.
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
