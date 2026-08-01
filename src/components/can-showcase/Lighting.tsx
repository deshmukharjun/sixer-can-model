import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'

// RectAreaLight needs its BRDF lookup textures initialised once before the
// first render, otherwise every area light renders black.
RectAreaLightUniformsLib.init()

// Studio rig: three tall panels around the can plus one overhead and one
// underneath. All five share the same size-class settings and intensity.
//
// Why three side panels and not four: a mirror reflection on the can lands at
// surface azimuth (camera + light) / 2. With the camera down the +Z axis, the
// front pair at ±60° put their strips at ±30° — the two broad highlights the
// reference shot has — while the back panel's lands at 90°, exactly on the
// silhouette, so it reads as rim light rather than a third strip. A four-panel
// ring instead puts two extra reflections at ±67.5°, just inboard of the
// edges, which is what previously read as an extra strip on each side.
//
// Blender's "Power 2 W, Normalize on" is radiometric and has no direct
// equivalent here — RectAreaLight intensity is luminance (nits). INTENSITY is
// the visually matched value, tuned against the reference product shot.
const INTENSITY = 1.8

const RADIUS = 3.2 // distance of every panel from the can
const SIDE_SIZE: [width: number, height: number] = [2.8, 5.5] // the "long" panels
const CAP_SIZE: [width: number, height: number] = [2.6, 2.6] // top + bottom panels
const COLOR = '#ffffff' // Blender default 6500 K white

// Side panels: azimuth in degrees around Y, measured from the default camera
// axis (+Z), with a per-panel multiplier on INTENSITY.
//
// The back panel is the key light for whichever side of the can faces away
// from the camera, so it carries most of the brightness once the can is turned
// around. It stays a little under the front pair only because its reflection
// lands on the silhouette, where grazing-angle Fresnel drives specular toward
// 1 and can blow the rim to pure white.
const SIDE_PANELS = [
  { deg: -60, scale: 1 },
  { deg: 60, scale: 1 },
  { deg: 180, scale: 0.75 },
]

// The top and bottom panels aim straight at the aluminium lid and base rim.
// With no environment map those surfaces have nothing else to reflect, so this
// multiplier is effectively the cap-and-base brightness control.
const CAP_SCALE = 1.6

const DEG = Math.PI / 180

export function Lighting() {
  return (
    <>
      {SIDE_PANELS.map(({ deg, scale }) => {
        const a = deg * DEG
        return (
          <rectAreaLight
            key={deg}
            // A RectAreaLight emits along its local -Z. Placing the panel at
            // azimuth `a` and rotating it by the same `a` aims that -Z straight
            // back at the can, so no lookAt pass is needed.
            position={[Math.sin(a) * RADIUS, 0, Math.cos(a) * RADIUS]}
            rotation={[0, a, 0]}
            width={SIDE_SIZE[0]}
            height={SIDE_SIZE[1]}
            intensity={INTENSITY * scale}
            color={COLOR}
          />
        )
      })}

      {/* Overhead panel, tilted to fire straight down onto the lid. */}
      <rectAreaLight
        position={[0, RADIUS, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={CAP_SIZE[0]}
        height={CAP_SIZE[1]}
        intensity={INTENSITY * CAP_SCALE}
        color={COLOR}
      />

      {/* Floor panel, firing straight up into the base rim. */}
      <rectAreaLight
        position={[0, -RADIUS, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        width={CAP_SIZE[0]}
        height={CAP_SIZE[1]}
        intensity={INTENSITY * CAP_SCALE}
        color={COLOR}
      />
    </>
  )
}
