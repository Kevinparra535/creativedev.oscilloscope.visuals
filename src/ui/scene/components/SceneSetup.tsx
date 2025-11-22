import { CameraControls } from '@react-three/drei'

export function SceneSetup() {
  return (
    <>
      {/* Ambient light for overall illumination */}
      <ambientLight intensity={0.3} />
      
      {/* Point light simulating CRT glow */}
      <pointLight position={[0, 0, 5]} intensity={0.5} color="#00ff00" />
      
      {/* Directional light for depth */}
      <directionalLight position={[5, 5, 5]} intensity={0.4} />
      
      {/* Camera controls: Dolly only (Zoom) */}
      <CameraControls
        minDistance={5}
        maxDistance={20}
        azimuthRotateSpeed={0}
        polarRotateSpeed={0}
        truckSpeed={0}
        mouseButtons={{
          left: 0, // No rotation
          middle: 0, // No pan
          right: 0, // No truck
          wheel: 8, // Dolly (Zoom)
        }}
        touches={{
          one: 0,
          two: 0,
          three: 0
        }}
      />
    </>
  )
}
