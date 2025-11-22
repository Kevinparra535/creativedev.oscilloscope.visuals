import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface UseCubeSignalOptions {
  active: boolean;
  pointsCount?: number;
  rotationSpeed?: number;
}

export default function useCubeSignal({
  active,
  pointsCount = 2000,
  rotationSpeed = 1,
}: UseCubeSignalOptions) {
  const [signalA, setSignalA] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );
  const [signalB, setSignalB] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );

  const rotationRef = useRef(new THREE.Euler(0, 0, 0));
  const requestRef = useRef<number | undefined>(undefined);
  const speedRef = useRef(rotationSpeed);

  useEffect(() => {
    speedRef.current = rotationSpeed;
  }, [rotationSpeed]);

  useEffect(() => {
    if (!active) return;

    const animate = () => {
      const speed = speedRef.current;
      // Rotate
      rotationRef.current.x += 0.005 * speed;
      rotationRef.current.y += 0.01 * speed;
      rotationRef.current.z += 0.003 * speed;

      const euler = rotationRef.current;
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      // Generate Buffer
      const bufferA = new Float32Array(pointsCount);
      const bufferB = new Float32Array(pointsCount);

      // Interpolate path
      const totalSegments = path.length - 1;
      const pointsPerSegment = Math.floor(pointsCount / totalSegments);

      let bufferIdx = 0;

      for (let i = 0; i < totalSegments; i++) {
        const idx1 = path[i];
        const idx2 = path[i + 1];
        const v1 = vertices[idx1].clone().applyQuaternion(quaternion);
        const v2 = vertices[idx2].clone().applyQuaternion(quaternion);

        // Perspective Projection
        // x' = x / (z + dist)
        // Closer distance = stronger perspective distortion
        const dist = 1.8; 
        // Scale up by 1.2 to fill the screen better
        const scale = 1.2;
        
        const p1x = (v1.x / (v1.z + dist)) * scale;
        const p1y = (v1.y / (v1.z + dist)) * scale;
        const p2x = (v2.x / (v2.z + dist)) * scale;
        const p2y = (v2.y / (v2.z + dist)) * scale;

        for (let j = 0; j < pointsPerSegment; j++) {
          if (bufferIdx >= pointsCount) break;
          const t = j / pointsPerSegment;
          bufferA[bufferIdx] = p1x + (p2x - p1x) * t;
          bufferB[bufferIdx] = p1y + (p2y - p1y) * t;
          bufferIdx++;
        }
      }

      // Fill remaining
      while (bufferIdx < pointsCount) {
        bufferA[bufferIdx] = bufferA[bufferIdx - 1];
        bufferB[bufferIdx] = bufferB[bufferIdx - 1];
        bufferIdx++;
      }

      setSignalA(bufferA);
      setSignalB(bufferB);

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [active, pointsCount]);

  return { signalA, signalB };
}

// Define Cube Vertices (Normalized -1 to 1)
const vertices = [
  new THREE.Vector3(-0.5, -0.5, -0.5), // 0
  new THREE.Vector3(0.5, -0.5, -0.5), // 1
  new THREE.Vector3(0.5, 0.5, -0.5), // 2
  new THREE.Vector3(-0.5, 0.5, -0.5), // 3
  new THREE.Vector3(-0.5, -0.5, 0.5), // 4
  new THREE.Vector3(0.5, -0.5, 0.5), // 5
  new THREE.Vector3(0.5, 0.5, 0.5), // 6
  new THREE.Vector3(-0.5, 0.5, 0.5), // 7
];

const path = [0, 1, 2, 3, 0, 4, 5, 6, 7, 4, 0, 3, 7, 6, 2, 1, 5];

