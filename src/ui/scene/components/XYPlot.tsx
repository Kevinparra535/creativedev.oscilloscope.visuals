import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface XYPlotProps {
  signalA: Float32Array;
  signalB: Float32Array;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
  color?: string;
}

export default function XYPlot({
  width,
  height,
  signalA,
  scaleY,
  color = "#00ff00",
}: XYPlotProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const trailGeoRef = useRef<THREE.BufferGeometry>(null);

  // Animation state: Start at center (0)
  const xPos = useRef(0);

  // Trail Configuration
  const TRAIL_LENGTH = 150;

  // Initialize buffers
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(TRAIL_LENGTH * 3);
    const cols = new Float32Array(TRAIL_LENGTH * 3);
    const c = new THREE.Color(color);

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      // Initialize all points to center
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0.1;

      // Pre-calculate fade colors (Oldest -> Newest)
      // Phosphor decay is often exponential
      const t = i / (TRAIL_LENGTH - 1);
      const alpha = Math.pow(t, 3); // Cubic fade for sharper tail

      // Mix from Green to White-ish at the tip
      // Tip (t=1) should be close to white/yellow
      // Tail (t=0) should be pure green/transparent

      const r = c.r * alpha + (1 - c.r) * Math.pow(t, 10); // Add white hot core
      const g = c.g * alpha + (1 - c.g) * Math.pow(t, 10);
      const b = c.b * alpha + (1 - c.b) * Math.pow(t, 10);

      cols[i * 3] = r;
      cols[i * 3 + 1] = g;
      cols[i * 3 + 2] = b;
    }
    return { positions: pos, colors: cols };
  }, [color]);

  useFrame((_, delta) => {
    if (!meshRef.current || !lightRef.current || !trailGeoRef.current) return;

    // 1. Update Beam Position (Physics)
    // Move left to right
    xPos.current += delta * (width / 2);
    const halfWidth = width / 2;

    // Wrap around (Blanking simulation)
    let isBlanking = false;
    if (xPos.current > halfWidth) {
      xPos.current = -halfWidth;
      isBlanking = true;
    }

    const currentX = xPos.current;

    // Map X position to Signal Index (Analog Simulation)
    // "Un voltaje de señal se aplica... para moverlo hacia arriba o hacia abajo"
    let currentY = 0;
    if (signalA && signalA.length > 0) {
      const normalizedX = (currentX + halfWidth) / width; // 0..1
      const index = Math.floor(normalizedX * (signalA.length - 1));
      const safeIndex = Math.max(0, Math.min(index, signalA.length - 1));
      const sY = scaleY || 1;
      currentY = signalA[safeIndex] * (height / 2) * sY;
    }

    const currentZ = 0.1;

    // Update Beam Mesh
    meshRef.current.position.set(currentX, currentY, currentZ);
    lightRef.current.position.set(currentX, currentY, currentZ);

    // 2. Update Trail (Persistence)
    const posArray = trailGeoRef.current.attributes.position
      .array as Float32Array;

    if (isBlanking) {
      // If blanking, reset trail to new start to avoid cross-screen line
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        posArray[i * 3] = currentX;
        posArray[i * 3 + 1] = currentY;
        posArray[i * 3 + 2] = currentZ;
      }
    } else {
      // Shift history: Drop oldest, add newest
      // Efficient array shift
      posArray.copyWithin(0, 3);

      // Set newest point at the end
      const lastIdx = (TRAIL_LENGTH - 1) * 3;
      posArray[lastIdx] = currentX;
      posArray[lastIdx + 1] = currentY;
      posArray[lastIdx + 2] = currentZ;
    }

    trailGeoRef.current.attributes.position.needsUpdate = true;
  });

  return (
    <group>
      {/* The Phosphor Trail */}
      <line>
        <bufferGeometry ref={trailGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            count={TRAIL_LENGTH}
            array={positions}
            itemSize={3}
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            count={TRAIL_LENGTH}
            array={colors}
            itemSize={3}
            args={[colors, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors={true}
          transparent={true}
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          linewidth={2}
        />
      </line>

      {/* The Electron Beam (Glowing Dot) */}
      <mesh ref={meshRef} position={[0, 0, 0.1]}>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshBasicMaterial
          color={[10, 20, 10]} // HDR Color: Multiplied values to drive Bloom
          toneMapped={false}
        />
      </mesh>

      {/* Light emitted by the beam */}
      <pointLight
        ref={lightRef}
        position={[0, 0, 0.1]}
        color={color}
        intensity={10}
        distance={6}
        decay={1.5}
      />
    </group>
  );
}
