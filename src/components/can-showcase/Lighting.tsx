// Soft studio lighting rig: ambient fill + key + fill + rim + two side
// kickers, tuned for a bright, clean product-shot look on a pure white
// background. The can also picks up reflections from an Environment preset
// (added in CanShowcase) for realistic highlights on its metallic surface.
//
// The key/top lights are intentionally dimmer and warmer than a single
// harsh white source would be — total brightness is instead spread across
// more lights (higher ambient + fill + kickers) so the can reads evenly lit
// rather than blown out with a hard shiny-white highlight.
export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.9} />

      {/* Key light: main shadow caster, softened and warmed so it doesn't
          read as a harsh white highlight */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.1}
        color="#fff7ee"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={12}
        shadow-bias={-0.0005}
      />

      {/* Fill light: softer, opposite side, no shadow to avoid double-darkening */}
      <directionalLight position={[-5, 2, 3]} intensity={0.8} color="#fff7ee" />

      {/* Rim light: from behind, separates the can from the background */}
      <directionalLight position={[0, 3, -6]} intensity={0.8} color="#eef4ff" />

      {/* Side kickers: extra wraparound light so the can reads brightly from every angle */}
      <pointLight position={[6, 0, 2]} intensity={0.6} color="#fff7ee" />
      <pointLight position={[-6, 0, -2]} intensity={0.6} color="#fff7ee" />

      {/* Top lights: aimed almost straight down onto the lid so its metallic
          material catches a soft specular highlight instead of reading as
          flat black, without blowing out into a hard white glare. */}
      <pointLight position={[0, 8, 1]} intensity={0.9} color="#fff7ee" />
      <pointLight position={[1.5, 7, -1.5]} intensity={0.6} color="#fff7ee" />
    </>
  )
}
