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
  mode?: "yt" | "xy";
  speed?: number; // Traversal speed (buffer indices per second)
}

export default function XYPlot({
  width,
  height,
  signalA,
  signalB,
  scaleX = 1,
  scaleY = 1,
  color = "#00ff00",
  mode = "yt",
  speed = 1000, // Default speed
}: XYPlotProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const trailGeoRef = useRef<THREE.BufferGeometry>(null);

  // Animation state
  const xPos = useRef(0); // For YT mode (screen position)
  const signalIndex = useRef(0); // For XY mode (buffer index)

  // Trail Configuration
  // Max points for the trail line.
  // Increased to 8192 to support multi-clone shapes (4000+ points)
  const MAX_TRAIL_POINTS = 8192;
  const PERSISTENCE_SECONDS = 0.15; // How long the phosphor glows

  // Initialize buffers
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(MAX_TRAIL_POINTS * 3);
    const cols = new Float32Array(MAX_TRAIL_POINTS * 3);
    const c = new THREE.Color(color);

    for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;

      // Pre-calculate fade colors (Newest -> Oldest)
      // Index 0 is the Beam (Newest), Index MAX is Oldest
      const t = 1 - i / (MAX_TRAIL_POINTS - 1); // 1 at head, 0 at tail

      // Fade logic
      const alpha = Math.pow(t, 2);

      const r = c.r * alpha + (1 - c.r) * Math.pow(t, 20); // White hot tip
      const g = c.g * alpha + (1 - c.g) * Math.pow(t, 20);
      const b = c.b * alpha + (1 - c.b) * Math.pow(t, 20);

      cols[i * 3] = r;
      cols[i * 3 + 1] = g;
      cols[i * 3 + 2] = b;
    }
    return { positions: pos, colors: cols };
  }, [color]);

  useFrame((_, delta) => {
    if (!meshRef.current || !lightRef.current || !trailGeoRef.current) return;

    let currentX = 0;
    let currentY = 0;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Determine how many points to draw based on speed
    // length = speed (pts/sec) * persistence (sec)
    // e.g. 200 * 0.15 = 30 points
    // e.g. 120000 * 0.15 = 18000 points -> clamped to MAX
    const activeTrailLength = Math.min(
      MAX_TRAIL_POINTS,
      Math.floor(speed * PERSISTENCE_SECONDS)
    );

    // Update Geometry Draw Range to only render active points
    trailGeoRef.current.setDrawRange(0, activeTrailLength);

    if (mode === "yt") {
      // YT Mode Logic (Simplified for now, mostly static sweep)
      xPos.current += delta * (width / 2);
      if (xPos.current > halfWidth) xPos.current = -halfWidth;
      currentX = xPos.current;

      if (signalA && signalA.length > 0) {
        const normalizedX = (currentX + halfWidth) / width;
        const index = Math.floor(normalizedX * (signalA.length - 1));
        const safeIndex = Math.max(0, Math.min(index, signalA.length - 1));
        currentY = signalA[safeIndex] * halfHeight * scaleY;
      }

      // YT Trail not implemented in this specific component (use WaveformTrail)
      // Just update beam
      meshRef.current.position.set(currentX, currentY, 0.1);
      lightRef.current.position.set(currentX, currentY, 0.1);
    } else {
      // XY Mode Logic
      if (signalA && signalB && signalA.length > 0) {
        // Advance index
        signalIndex.current += speed * delta;

        // Wrap index for calculation, but keep float for smoothness
        const currentIndex = signalIndex.current;
        const len = signalA.length;

        // Update Beam Position
        const idx = Math.floor(currentIndex) % len;
        const safeIdx = idx < 0 ? idx + len : idx; // Handle negative?

        currentX = signalA[safeIdx] * halfWidth * scaleX;
        currentY = signalB[safeIdx] * halfHeight * scaleY;

        meshRef.current.position.set(currentX, currentY, 0.1);
        lightRef.current.position.set(currentX, currentY, 0.1);

        // Update Trail Buffer
        const posArray = trailGeoRef.current.attributes.position
          .array as Float32Array;

        // Fill buffer backwards from current index
        for (let i = 0; i < activeTrailLength; i++) {
          // Calculate index in signal buffer
          // We go backwards: current - i
          let sampleIdx = Math.floor(currentIndex - i) % len;
          if (sampleIdx < 0) sampleIdx += len;

          const x = signalA[sampleIdx] * halfWidth * scaleX;
          const y = signalB[sampleIdx] * halfHeight * scaleY;

          posArray[i * 3] = x;
          posArray[i * 3 + 1] = y;
          posArray[i * 3 + 2] = 0.1 - i * 0.0001; // Slight Z-fighting prevention
        }

        trailGeoRef.current.attributes.position.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* The Phosphor Trail */}
      <line>
        <bufferGeometry ref={trailGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            count={MAX_TRAIL_POINTS}
            array={positions}
            itemSize={3}
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            count={MAX_TRAIL_POINTS}
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
        <sphereGeometry args={[0.02, 32, 32]} />
        <meshBasicMaterial color={[10, 20, 10]} toneMapped={false} />
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
