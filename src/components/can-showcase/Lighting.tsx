// Soft studio lighting rig: ambient fill + key + fill + rim + two side
// kickers, tuned for a bright, clean product-shot look on a pure white
// background. The can also picks up reflections from an Environment preset
// (added in CanShowcase) for realistic highlights on its metallic surface.
export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.7} />

      {/* Key light: strong, casts the main shadow */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.8}
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
      <directionalLight position={[-5, 2, 3]} intensity={0.6} />

      {/* Rim light: from behind, separates the can from the white background */}
      <directionalLight position={[0, 3, -6]} intensity={1} color="#eef4ff" />

      {/* Side kickers: extra wraparound light so the can reads brightly from every angle */}
      <pointLight position={[6, 0, 2]} intensity={0.5} />
      <pointLight position={[-6, 0, -2]} intensity={0.5} />

      {/* Top lights: aimed almost straight down onto the lid so its metallic
          material catches a bright specular highlight instead of reading as
          flat black (a metal surface only looks silver where it reflects a
          bright light source or environment). */}
      <pointLight position={[0, 8, 1]} intensity={1.4} />
      <pointLight position={[1.5, 7, -1.5]} intensity={0.8} />
    </>
  )
}
