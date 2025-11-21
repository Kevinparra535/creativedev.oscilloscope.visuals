import { useRef } from 'react'
import { Mesh } from 'three'

interface CRTScreenProps {
  width?: number
  height?: number
}

export function CRTScreen({ width = 8, height = 6 }: CRTScreenProps) {
  const meshRef = useRef<Mesh>(null)

  return (
    <group>
      {/* Main CRT screen surface */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color="#001100"
          emissive="#002200"
          emissiveIntensity={0.2}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Slight bezel/frame around screen */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[width + 0.4, height + 0.4]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.7}
          metalness={0.3}
        />
      </mesh>
    </group>
  )
}
