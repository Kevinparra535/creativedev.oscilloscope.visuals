import { OrbitControls } from '@react-three/drei'

export function SceneSetup() {
  return (
    <>
      {/* Ambient light for overall illumination */}
      <ambientLight intensity={0.3} />
      
      {/* Point light simulating CRT glow */}
      <pointLight position={[0, 0, 5]} intensity={0.5} color="#00ff00" />
      
      {/* Directional light for depth */}
      <directionalLight position={[5, 5, 5]} intensity={0.4} />
      
      {/* Camera controls for development/debugging */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        target={[0, 0, 0]}
      />
    </>
  )
}
