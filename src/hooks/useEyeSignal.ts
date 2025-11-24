import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";

interface UseEyeSignalOptions {
  active: boolean;
  pointsCount?: number;
  cloneCount?: number;
  layoutMode?: "polygon" | "grid";
  gridRows?: number;
  gridCols?: number;
}

export default function useEyeSignal({
  active,
  pointsCount = 2000,
  cloneCount = 1,
  layoutMode = "polygon",
  gridRows = 2,
  gridCols = 3,
}: UseEyeSignalOptions) {
  const [signalA, setSignalA] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );
  const [signalB, setSignalB] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );

  const requestRef = useRef<number | undefined>(undefined);
  const offsetsRef = useRef<{ x: number; y: number }[]>([]);
  const scaleRef = useRef(1.0);
  const timeRef = useRef(0);
  
  // Noise for pupil movement
  const noise3D = useRef(createNoise3D()).current;

  useEffect(() => {
    if (!active) return;

    const animate = () => {
      timeRef.current += 0.005;
      const t = timeRef.current;

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
      let targetScale = passes > 1 ? 0.45 : 1.5; 
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

        // Calculate Pupil Positions (looking around)
        // We use noise to make them wander smoothly on the surface of a sphere
        const pupilPositions: THREE.Vector3[] = [];
        for (let p = 0; p < 3; p++) {
            // Different noise offsets for each pupil
            const nx = noise3D(t, p * 10, 0);
            const ny = noise3D(t, p * 10, 10);
            
            // Map noise to spherical coordinates to keep them on surface
            // Limit the "looking" range so they are mostly front-facing
            const theta = nx * Math.PI * 0.4; // Horizontal range
            const phi = ny * Math.PI * 0.4;   // Vertical range
            
            const r = 0.9; // Slightly inside the sclera radius (1.0)
            const px = r * Math.sin(theta) * Math.cos(phi);
            const py = r * Math.sin(phi);
            const pz = r * Math.cos(theta) * Math.cos(phi); // Z is forward (positive in this projection logic usually, but let's check)
            
            pupilPositions.push(new THREE.Vector3(px, py, pz));
        }

        // Distribute points: 60% Sclera, 40% Pupils (divided by 3)
        const scleraCount = Math.floor(pointsPerPass * 0.6);
        const pupilCount = Math.floor((pointsPerPass - scleraCount) / 3);

        for (let i = 0; i < pointsPerPass; i++) {
          if (bufferIdx >= pointsCount) break;

          let x = 0, y = 0, z = 0;

          if (i < scleraCount) {
             // Sclera (Eyeball) - Fibonacci Sphere
             const k = i;
             const n = scleraCount;
             const phi = Math.acos(1 - 2 * (k + 0.5) / n);
             const theta = Math.PI * (1 + Math.sqrt(5)) * (k + 0.5);
             
             x = Math.cos(theta) * Math.sin(phi);
             y = Math.sin(theta) * Math.sin(phi);
             z = Math.cos(phi);
          } else {
             // Pupils
             const pupilIdx = Math.floor((i - scleraCount) / pupilCount);
             const safePupilIdx = Math.min(pupilIdx, 2);
             const center = pupilPositions[safePupilIdx];
             
             // Draw small circles/disks for pupils
             const radius = 0.15; // Pupil size
             
             // Random point in disk oriented towards Z (simplified)
             // Better: random point on small sphere cap around center
             // Simple approach: Random point in unit sphere * radius + center
             // Then normalize to project onto main sphere surface? No, pupils are distinct.
             
             // Let's make them flat disks facing the camera for impact, or surface patches.
             // Surface patches look better.
             
             // Generate a random offset vector
             const u = Math.random() * 2 - 1;
             const v = Math.random() * 2 - 1;
             const w = Math.random() * 2 - 1;
             const offset = new THREE.Vector3(u, v, w).normalize().multiplyScalar(Math.random() * radius);
             
             x = center.x + offset.x;
             y = center.y + offset.y;
             z = center.z + offset.z;
             
             // Push slightly out to be "on top" of sclera
             const vPupil = new THREE.Vector3(x, y, z).normalize().multiplyScalar(1.02);
             x = vPupil.x;
             y = vPupil.y;
             z = vPupil.z;
          }

          // Apply Offset (Layout)
          x += xOffset;
          y += yOffset;

          // Project
          const dist = 5.0;
          // Standard orientation: Z is forward? 
          // In our previous codes, we often rotate. Here NO rotation.
          // We need to ensure the "front" of the eye (Z+) faces the camera.
          // If camera is at Z=12 looking at 0,0,0.
          // We project x/(z+dist).
          
          const px = (x / (z + dist)) * currentScale;
          const py = (y / (z + dist)) * currentScale;

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
  ]);

  return { signalA, signalB };
}
