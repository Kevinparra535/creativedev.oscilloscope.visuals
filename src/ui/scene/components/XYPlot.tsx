import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface XYPlotProps {
  signalA: Float32Array;
  signalB: Float32Array;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
  color?: string;
  lineWidth?: number;
}

// Simple Lissajous / XY parametric plot
// Maps two signals to X/Y directly (no time axis)
// X = signalA[i] * (width/2) * scaleX
// Y = signalB[i] * (height/2) * scaleY

export default function XYPlot({
  signalA,
  signalB,
  width,
  height,
  scaleX = 1,
  scaleY = 1,
  color = "#00ff00",
  lineWidth = 0.025,
}: XYPlotProps) {
  const materialRef = useRef<THREE.LineBasicMaterial | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);

  const length = Math.min(signalA.length, signalB.length);

  const positions = useMemo(() => {
    const pos = new Float32Array(length * 3);
    const maxX = width / 2;
    const maxY = height / 2;
    for (let i = 0; i < length; i++) {
      // Apply clipping to keep within grid bounds
      const rawX = signalA[i] * (width / 2) * scaleX;
      const rawY = signalB[i] * (height / 2) * scaleY;
      const x = Math.max(-maxX, Math.min(maxX, rawX));
      const y = Math.max(-maxY, Math.min(maxY, rawY));
      const base = i * 3;
      pos[base] = x;
      pos[base + 1] = y;
      pos[base + 2] = 0;
    }
    return pos;
  }, [length, signalA, signalB, width, height, scaleX, scaleY]);

  useEffect(() => {
    const geo = geometryRef.current;
    if (!geo) return;
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.computeBoundingSphere();
  }, [positions]);

  // Optionally animate slight phase rotation for artistic feel (disabled for purity)
  useFrame(() => {
    // Placeholder for future dynamic XY effects
  });

  return (
    <line>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial
        ref={materialRef}
        color={color}
        linewidth={lineWidth}
        toneMapped={false}
      />
    </line>
  );
}
