import * as THREE from 'three'

// Procedurally paints a seamless-tiling droplet pattern instead of shipping a
// baked image asset. Two textures come out of the same droplet layout:
//   - a tangent-space normal map (the bump each droplet's curved surface adds)
//   - a mask (bright inside a droplet, black outside) fed to clearcoatMap so
//     the glossy clearcoat layer only kicks in where a droplet actually sits
// Both are generated once at module load and reused for every can instance.
//
// Real condensation reads as mostly tiny beads with a few larger drops that
// have started running and left a thin trailing streak — not a field of
// same-size ovals — so the layout mixes two droplet populations rather than
// one uniform one.

const SIZE = 512
const BEAD_COUNT = 120
const BEAD_MIN_RADIUS = 5
const BEAD_MAX_RADIUS = 13
const DRIP_COUNT = 10
const DRIP_HEAD_MIN_RADIUS = 12
const DRIP_HEAD_MAX_RADIUS = 20
const BUMP_STRENGTH = 1.7
// Fraction of a droplet's radius that stays fully domed before the profile
// rolls into the dark contact-line ring at the rim — real drops have a
// clear "shoulder" rather than falling off linearly from the center.
const CORE_FRACTION = 0.55

interface Droplet {
  x: number
  y: number
  r: number
}

// Deterministic PRNG so the pattern is stable across reloads/HMR instead of
// reshuffling every time the module re-evaluates.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeDroplets(): Droplet[] {
  const rand = mulberry32(1337)
  const droplets: Droplet[] = []

  for (let i = 0; i < BEAD_COUNT; i++) {
    droplets.push({
      x: rand() * SIZE,
      y: rand() * SIZE,
      r: BEAD_MIN_RADIUS + rand() * (BEAD_MAX_RADIUS - BEAD_MIN_RADIUS),
    })
  }

  // Drips: a head plus a tapering vertical tail of shrinking beads, like a
  // drop that has started sliding down under its own weight.
  for (let i = 0; i < DRIP_COUNT; i++) {
    const headX = rand() * SIZE
    const headY = rand() * SIZE
    const headR = DRIP_HEAD_MIN_RADIUS + rand() * (DRIP_HEAD_MAX_RADIUS - DRIP_HEAD_MIN_RADIUS)
    droplets.push({ x: headX, y: headY, r: headR })

    const tailLength = 5 + Math.floor(rand() * 5)
    let tailR = headR * 0.55
    let tailY = headY + headR * 0.7
    for (let t = 0; t < tailLength; t++) {
      droplets.push({ x: headX + (rand() - 0.5) * 3, y: tailY, r: tailR })
      tailY += tailR * 0.65
      tailR *= 0.8
      if (tailR < 1.2) break
    }
  }

  return droplets
}

// Runs `paint` once per droplet, plus wrapped copies at the 8 neighboring
// tile offsets so the pattern repeats seamlessly under RepeatWrapping.
function forEachWrappedDroplet(droplets: Droplet[], paint: (d: Droplet) => void) {
  const offsets = [-SIZE, 0, SIZE]
  for (const d of droplets) {
    for (const ox of offsets) {
      for (const oy of offsets) {
        const shifted = { x: d.x + ox, y: d.y + oy, r: d.r }
        if (
          shifted.x + shifted.r < 0 ||
          shifted.x - shifted.r > SIZE ||
          shifted.y + shifted.r < 0 ||
          shifted.y - shifted.r > SIZE
        ) {
          continue
        }
        paint(shifted)
      }
    }
  }
}

function buildNormalMap(droplets: Droplet[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(SIZE, SIZE)
  const data = image.data
  const height = new Float32Array(SIZE * SIZE)

  // Flat tangent-space normal (0, 0, 1) everywhere by default.
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = 128
    data[i * 4 + 1] = 128
    data[i * 4 + 2] = 255
    data[i * 4 + 3] = 255
  }

  forEachWrappedDroplet(droplets, (d) => {
    const minX = Math.max(0, Math.floor(d.x - d.r))
    const maxX = Math.min(SIZE - 1, Math.ceil(d.x + d.r))
    const minY = Math.max(0, Math.floor(d.y - d.r))
    const maxY = Math.min(SIZE - 1, Math.ceil(d.y + d.r))

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = px - d.x
        const dy = py - d.y
        const r = Math.sqrt(dx * dx + dy * dy)
        if (r >= d.r) continue

        // A real drop has a rounded dome across its core, then rolls over
        // more steeply near the rim where it meets the surface (the contact
        // line) — a plain sphere profile reads flat and oval once stretched
        // by the cylinder's UVs, so the falloff is biased to be steeper past
        // CORE_FRACTION.
        const t = r / d.r
        const shaped = t < CORE_FRACTION ? t * 0.6 : 0.6 + ((t - CORE_FRACTION) / (1 - CORE_FRACTION)) * 0.4
        const nzRaw = Math.sqrt(Math.max(0, 1 - shaped * shaped))
        const h = nzRaw * BUMP_STRENGTH

        const idx = py * SIZE + px
        if (h <= height[idx]) continue
        height[idx] = h

        const normal = new THREE.Vector3(dx / d.r, dy / d.r, nzRaw * BUMP_STRENGTH).normalize()
        const pixel = idx * 4
        data[pixel] = Math.round((normal.x * 0.5 + 0.5) * 255)
        data[pixel + 1] = Math.round((normal.y * 0.5 + 0.5) * 255)
        data[pixel + 2] = Math.round((normal.z * 0.5 + 0.5) * 255)
        data[pixel + 3] = 255
      }
    }
  })

  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function buildMaskMap(droplets: Droplet[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, SIZE, SIZE)

  forEachWrappedDroplet(droplets, (d) => {
    // Bright core, a slightly dimmer ring standing in for the contact-line
    // shadow real drops cast where they meet the surface, then fade to
    // nothing — rather than one flat gradient from full brightness to zero,
    // which is what read as a soft, characterless blob.
    const gradient = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.55, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.8, 'rgba(220,220,220,0.9)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
    ctx.fill()
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

let cached: { normalMap: THREE.CanvasTexture; maskMap: THREE.CanvasTexture } | null = null

// Lazily builds (and memoizes) the droplet normal + clearcoat mask pair. Only
// runs in a browser context since it needs a canvas.
export function getDewDropsMaps() {
  if (!cached) {
    const droplets = makeDroplets()
    cached = {
      normalMap: buildNormalMap(droplets),
      maskMap: buildMaskMap(droplets),
    }
  }
  return cached
}

// How many times the droplet tile repeats around the can body / along its
// height. Higher than the bead/drip counts alone would suggest so each
// droplet reads at a believable few-millimeter scale rather than dominating
// the label.
export const DEW_DROPS_REPEAT = new THREE.Vector2(3.5, 5)
