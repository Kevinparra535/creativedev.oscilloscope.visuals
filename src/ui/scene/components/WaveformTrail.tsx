import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface WaveformTrailProps {
  signal: Float32Array;
  signalB?: Float32Array; // Optional second signal for XY mode
  mode?: "yt" | "xy";
  trailLength: number;
  width: number;
  height: number;
  amplitudeScale: number;
  scaleX?: number; // For XY mode
  scaleY?: number; // For XY mode
  color?: string;
  lineWidth?: number;
}

/**
 * WaveformTrail: maintains a ring of previous signal windows and renders them
 * with fading opacity to simulate phosphor persistence.
 * Supports both Y-T and XY modes.
 */
const WaveformTrail = ({
  signal,
  signalB,
  mode = "yt",
  trailLength,
  width,
  height,
  amplitudeScale,
  scaleX = 1,
  scaleY = 1,
  color = "#00ff00",
  lineWidth = 0.02,
}: WaveformTrailProps) => {
  const idRef = useRef(0);
  // Store both channels if needed
  const [frames, setFrames] = useState<{ id: number; dataA: Float32Array; dataB?: Float32Array }[]>(
    []
  );

  // Push new frame copy when signal updates
  useEffect(() => {
    if (trailLength <= 0) return;
    const copyA = new Float32Array(signal);
    const copyB = signalB ? new Float32Array(signalB) : undefined;
    
    idRef.current += 1;
    setFrames((prev) => {
      const next = [{ id: idRef.current, dataA: copyA, dataB: copyB }, ...prev];
      if (next.length > trailLength) next.pop();
      return next;
    });
  }, [signal, signalB, trailLength]);

  return (
    <group>
      {frames.map((frameObj, idx) => {
        const { dataA, dataB } = frameObj;
        const opacity = 0.6 * (1 - idx / frames.length);
        const points: THREE.Vector3[] = [];
        
        if (mode === "xy" && dataB) {
          // XY Mode Rendering
          const len = Math.min(dataA.length, dataB.length);
          for (let i = 0; i < len; i++) {
            const rawX = dataA[i] * (width / 2) * scaleX;
            const rawY = dataB[i] * (height / 2) * scaleY;
            // Clip
            const x = Math.max(-width/2, Math.min(width/2, rawX));
            const y = Math.max(-height/2, Math.min(height/2, rawY));
            points.push(new THREE.Vector3(x, y, -0.01 * (idx + 1)));
          }
        } else {
          // Y-T Mode Rendering
          for (let i = 0; i < dataA.length; i++) {
            const x = (i / (dataA.length - 1)) * width - width / 2;
            const clippedAmplitude = Math.max(-1, Math.min(1, dataA[i] * amplitudeScale));
            const y = clippedAmplitude * (height / 2);
            points.push(new THREE.Vector3(x, y, -0.01 * (idx + 1)));
          }
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return (
          // @ts-expect-error - three <line /> primitive typing discrepancy
          <line key={frameObj.id} geometry={geometry}>
            <lineBasicMaterial
              color={color}
              transparent
              opacity={opacity}
              linewidth={lineWidth}
              toneMapped={false}
            />
          </line>
        );
      })}
    </group>
  );
};

export default WaveformTrail;
