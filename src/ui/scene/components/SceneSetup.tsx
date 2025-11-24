import { CameraControls } from '@react-three/drei'

interface SceneSetupProps {
  enableRotation?: boolean;
}

export function SceneSetup({ enableRotation = false }: SceneSetupProps) {
  return (
    <>
      {/* Ambient light for overall illumination */}
      <ambientLight intensity={0.3} />
      
      {/* Point light simulating CRT glow */}
      <pointLight position={[0, 0, 5]} intensity={0.5} color="#00ff00" />
      
      {/* Directional light for depth */}
      <directionalLight position={[5, 5, 5]} intensity={0.4} />
      
      {/* Camera controls */}
      <CameraControls
        minDistance={2}
        maxDistance={30}
        azimuthRotateSpeed={enableRotation ? 1 : 0}
        polarRotateSpeed={enableRotation ? 1 : 0}
        truckSpeed={0}
        mouseButtons={{
          left: enableRotation ? 1 : 0, // Rotate if enabled
          middle: 0, // No pan
          right: 0, // No truck
          wheel: 8, // Dolly (Zoom)
        }}
        touches={{
          one: enableRotation ? 1 : 0,
          two: 0,
          three: 0
        }}
      />
    </>
  )
}
