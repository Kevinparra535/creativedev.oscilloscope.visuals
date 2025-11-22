import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface WaveformTrailProps {
  signal: Float32Array;
  trailLength: number; // number of past frames to keep
  width: number;
  height: number;
  amplitudeScale: number;
  color?: string;
  lineWidth?: number;
}

/**
 * WaveformTrail: maintains a ring of previous signal windows and renders them
 * with fading opacity to simulate phosphor persistence.
 */
const WaveformTrail = ({
  signal,
  trailLength,
  width,
  height,
  amplitudeScale,
  color = "#00ff00",
  lineWidth = 0.02,
}: WaveformTrailProps) => {
  const idRef = useRef(0);
  const [frames, setFrames] = useState<{ id: number; data: Float32Array }[]>(
    []
  );

  // Push new frame copy when signal updates
  useEffect(() => {
    if (trailLength <= 0) return;
    const copy = new Float32Array(signal);
    idRef.current += 1;
    setFrames((prev) => {
      const next = [{ id: idRef.current, data: copy }, ...prev];
      if (next.length > trailLength) next.pop();
      return next;
    });
  }, [signal, trailLength]);

  return (
    <group>
      {frames.map((frameObj, idx) => {
        const { data } = frameObj;
        const opacity = 0.6 * (1 - idx / frames.length);
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < data.length; i++) {
          const x = (i / (data.length - 1)) * width - width / 2;
          // Clip amplitude to stay within grid bounds
          const clippedAmplitude = Math.max(-1, Math.min(1, data[i] * amplitudeScale));
          const y = clippedAmplitude * (height / 4);
          points.push(new THREE.Vector3(x, y, 0.005));
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
