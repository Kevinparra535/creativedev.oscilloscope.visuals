import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface UseBrainSignalOptions {
  active: boolean;
  pointsCount?: number;
  rotationSpeed?: number;
  cloneCount?: number;
  layoutMode?: "polygon" | "grid";
  gridRows?: number;
  gridCols?: number;
}

export default function useBrainSignal({
  active,
  pointsCount = 2000,
  rotationSpeed = 1,
  cloneCount = 1,
  layoutMode = "polygon",
  gridRows = 2,
  gridCols = 3,
}: UseBrainSignalOptions) {
  const [signalA, setSignalA] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );
  const [signalB, setSignalB] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );

  const rotationRef = useRef(new THREE.Euler(0, 0, 0));
  const requestRef = useRef<number | undefined>(undefined);
  const speedRef = useRef(rotationSpeed);
  const offsetsRef = useRef<{ x: number; y: number }[]>([]);
  const scaleRef = useRef(1.0);

  useEffect(() => {
    speedRef.current = rotationSpeed;
  }, [rotationSpeed]);

  useEffect(() => {
    if (!active) return;

    const animate = () => {
      const speed = speedRef.current;
      // ONLY rotate on X axis as requested
      rotationRef.current.x += 0.01 * speed;
      // rotationRef.current.y += 0.01 * speed;
      // rotationRef.current.z += 0.002 * speed;

      const euler = rotationRef.current;
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      const bufferA = new Float32Array(pointsCount);
      const bufferB = new Float32Array(pointsCount);

      const passes =
        layoutMode === "grid" ? gridRows * gridCols : Math.max(1, cloneCount);
      const pointsPerPass = Math.floor(pointsCount / passes);

      // Initialize offsets
      while (offsetsRef.current.length < passes) {
        offsetsRef.current.push({ x: 0, y: 0 });
      }

      // Scale logic
      let targetScale = passes > 1 ? 0.45 : 1.8; // Larger base scale for brain
      if (layoutMode === "grid") targetScale = 0.35;
      scaleRef.current += (targetScale - scaleRef.current) * 0.05;
      const currentScale = scaleRef.current;

      let bufferIdx = 0;

      for (let pass = 0; pass < passes; pass++) {
        // Layout Logic
        let targetX = 0;
        let targetY = 0;

        if (layoutMode === "grid") {
          const col = pass % gridCols;
          const row = Math.floor(pass / gridCols);
          const spacingX = 2.0;
          const spacingY = 2.0;
          const gridWidth = (gridCols - 1) * spacingX;
          const gridHeight = (gridRows - 1) * spacingY;
          targetX = col * spacingX - gridWidth / 2;
          targetY = -(row * spacingY - gridHeight / 2);
        } else if (passes > 1) {
          const radius = 1.3;
          const angle = (pass / passes) * Math.PI * 2 + Math.PI / 2;
          targetX = Math.cos(angle) * radius;
          targetY = Math.sin(angle) * radius;
        }

        offsetsRef.current[pass].x +=
          (targetX - offsetsRef.current[pass].x) * 0.05;
        offsetsRef.current[pass].y +=
          (targetY - offsetsRef.current[pass].y) * 0.05;
        const xOffset = offsetsRef.current[pass].x;
        const yOffset = offsetsRef.current[pass].y;

        for (let i = 0; i < pointsPerPass; i++) {
          if (bufferIdx >= pointsCount) break;

          // Brain Shape Generation
          // Use Fibonacci sphere distribution for even points
          const k = i;
          const n = pointsPerPass;
          const phi = Math.acos(1 - (2 * (k + 0.5)) / n);
          const theta = Math.PI * (1 + Math.sqrt(5)) * (k + 0.5);

          let x = Math.cos(theta) * Math.sin(phi);
          let y = Math.sin(theta) * Math.sin(phi);
          let z = Math.cos(phi);

          // Create Hemispheres
          // Force x to be positive then mirror based on index parity
          x = Math.abs(x);
          const isRight = i % 2 === 0;
          if (!isRight) x = -x;

          // Add Gap
          const gap = 0.15;
          if (isRight) x += gap;
          else x -= gap;

          // Shape Deformation (Brain-like)
          // Flatten bottom
          if (y < -0.2) y *= 0.6;

          // Elongate front-back
          z *= 1.2;

          // Add "Gyri" (wrinkles) using sine waves
          const freq = 8.0;
          const noise =
            Math.sin(x * freq) * Math.cos(y * freq) * Math.sin(z * freq);
          const radius = 1.0 + 0.15 * noise;

          x *= radius;
          y *= radius;
          z *= radius;

          // Apply Rotation
          const v = new THREE.Vector3(x, y, z);
          v.applyQuaternion(quaternion);

          // Apply Offset
          v.x += xOffset;
          v.y += yOffset;

          // Project
          const dist = 5.0;
          const px = (v.x / (v.z + dist)) * currentScale;
          const py = (v.y / (v.z + dist)) * currentScale;

          bufferA[bufferIdx] = Math.max(-1, Math.min(1, px));
          bufferB[bufferIdx] = Math.max(-1, Math.min(1, py));
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
  }, [
    active,
    pointsCount,
    cloneCount,
    layoutMode,
    gridRows,
    gridCols,
    rotationSpeed,
  ]);

  return { signalA, signalB };
}
