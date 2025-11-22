import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'

interface WaveformProps {
  signal: Float32Array
  width: number
  height: number
  amplitudeScale: number
  color?: string
  lineWidth?: number
  triggerIndex?: number
  showTrigger?: boolean
}

export default function Waveform({
  signal,
  width,
  height,
  amplitudeScale,
  color = '#00ff00',
  lineWidth = 2,
  triggerIndex = 0,
  showTrigger = false,
}: WaveformProps) {
  const geometryRef = useRef<THREE.BufferGeometry>(null)

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(signal.length * 3)
    const cols = new Float32Array(signal.length * 3)
    const baseColor = new THREE.Color(color)
    
    // 1. Calculate Positions
    for (let i = 0; i < signal.length; i++) {
      const x = (i / (signal.length - 1)) * width - width / 2
      const clippedAmplitude = Math.max(-1, Math.min(1, signal[i] * amplitudeScale))
      const y = clippedAmplitude * (height / 2)
      
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = 0
    }

    // 2. Calculate Intensity (Beam Physics)
    for (let i = 0; i < signal.length; i++) {
      const base = i * 3
      
      // Calculate distance to next point
      let dist = 0
      if (i < signal.length - 1) {
        const dx = pos[base + 3] - pos[base]
        const dy = pos[base + 4] - pos[base + 1]
        dist = Math.sqrt(dx * dx + dy * dy)
      } else if (i > 0) {
        const dx = pos[base] - pos[base - 3]
        const dy = pos[base + 1] - pos[base - 2]
        dist = Math.sqrt(dx * dx + dy * dy)
      }

      // Physics: Slower beam = Brighter trace
      // In Y-T mode, dx is constant, so intensity depends mainly on dy (slope)
      const intensity = Math.min(1.0, 0.05 / (dist + 0.001)) + 0.2

      cols[base] = baseColor.r * intensity
      cols[base + 1] = baseColor.g * intensity
      cols[base + 2] = baseColor.b * intensity
    }

    return { positions: pos, colors: cols }
  }, [signal, width, height, amplitudeScale, color])

  useEffect(() => {
    if (geometryRef.current) {
      geometryRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometryRef.current.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
  }, [positions, colors])

  return (
    <group>
      <line>
        <bufferGeometry ref={geometryRef} />
        <lineBasicMaterial
          vertexColors={true}
          linewidth={lineWidth}
          transparent={true}
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthTest={false}
        />
      </line>
      
      {showTrigger && (
        <mesh position={[
          (triggerIndex / (signal.length - 1)) * width - width / 2,
          Math.max(-height/2, Math.min(height/2, signal[triggerIndex] * amplitudeScale * (height / 2))),
          0.1
        ]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      )}
    </group>
  )
}
