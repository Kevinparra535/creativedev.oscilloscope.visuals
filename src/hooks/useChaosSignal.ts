import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface UseChaosSignalOptions {
  active: boolean;
  pointsCount?: number;
  rotationSpeed?: number;
  cloneCount?: number;
  layoutMode?: "polygon" | "grid";
  gridRows?: number;
  gridCols?: number;
  attractorType?: "lorenz" | "rossler" | "aizawa";
}

export default function useChaosSignal({
  active,
  pointsCount = 2000,
  rotationSpeed = 1,
  cloneCount = 1,
  layoutMode = "polygon",
  gridRows = 2,
  gridCols = 3,
  attractorType = "lorenz",
}: UseChaosSignalOptions) {
  const [signalA, setSignalA] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );
  const [signalB, setSignalB] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );

  const rotationRef = useRef(new THREE.Euler(0, 0, 0));
  const requestRef = useRef<number | undefined>(undefined);
  const speedRef = useRef(rotationSpeed);
  
  // Animation refs for smooth transitions
  const offsetsRef = useRef<{x: number, y: number}[]>([]);
  const scaleRef = useRef(1.2);

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
      rotationRef.current.z += 0.002 * speed;

      const euler = rotationRef.current;
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      // Generate Buffer
      const bufferA = new Float32Array(pointsCount);
      const bufferB = new Float32Array(pointsCount);

      // Multi-clone logic
      const passes = layoutMode === "grid" ? gridRows * gridCols : Math.max(1, cloneCount);
      const pointsPerPass = Math.floor(pointsCount / passes);

      // Initialize new offsets at center (0,0) if needed
      while (offsetsRef.current.length < passes) {
         offsetsRef.current.push({ x: 0, y: 0 });
      }

      // Smooth Scale Transition
      let targetScale = passes > 1 ? 0.45 : 1.2;
      if (layoutMode === "grid") {
        targetScale = 0.35; // Smaller for grid
      }
      // Adjust scale for specific attractors
      if (attractorType === 'lorenz') targetScale *= 0.03; // Reduced to fit screen
      if (attractorType === 'rossler') targetScale *= 0.03;
      if (attractorType === 'aizawa') targetScale *= 2.5;

      scaleRef.current += (targetScale - scaleRef.current) * 0.05;
      const currentScale = scaleRef.current;

      let bufferIdx = 0;

      for (let pass = 0; pass < passes; pass++) {
        // Calculate Target Offset
        let targetX = 0;
        let targetY = 0;
        
        if (layoutMode === "grid") {
          const col = pass % gridCols;
          const row = Math.floor(pass / gridCols);
          
          const spacingX = 2.0; 
          const spacingY = 2.0;
          
          const gridWidth = (gridCols - 1) * spacingX;
          const gridHeight = (gridRows - 1) * spacingY;
          
          targetX = (col * spacingX) - (gridWidth / 2);
          targetY = -((row * spacingY) - (gridHeight / 2));
        } else if (passes > 1) {
          const radius = 1.3;
          const angle = (pass / passes) * Math.PI * 2 + Math.PI / 2;
          targetX = Math.cos(angle) * radius;
          targetY = Math.sin(angle) * radius;
        }

        // Smooth Position Transition (Lerp)
        offsetsRef.current[pass].x += (targetX - offsetsRef.current[pass].x) * 0.05;
        offsetsRef.current[pass].y += (targetY - offsetsRef.current[pass].y) * 0.05;
        
        const xOffset = offsetsRef.current[pass].x;
        const yOffset = offsetsRef.current[pass].y;

        // Generate Attractor Points
        let x = 0.1, y = 0, z = 0;
        
        // Pre-warm / randomize start for clones so they look different?
        // Or just let them be identical for now.
        // To make them different, we could offset the start time or initial conditions.
        if (pass > 0) {
            x += pass * 0.1;
            y += pass * 0.1;
        }

        const dt = 0.01;

        for (let i = 0; i < pointsPerPass; i++) {
          if (bufferIdx >= pointsCount) break;
          
          let dx = 0, dy = 0, dz = 0;

          if (attractorType === 'lorenz') {
            const sigma = 10;
            const rho = 28;
            const beta = 8/3;
            dx = sigma * (y - x);
            dy = x * (rho - z) - y;
            dz = x * y - beta * z;
          } else if (attractorType === 'rossler') {
            const a = 0.2;
            const b = 0.2;
            const c = 5.7;
            dx = -y - z;
            dy = x + a * y;
            dz = b + z * (x - c);
          } else if (attractorType === 'aizawa') {
             const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1;
             dx = (z - b) * x - d * y;
             dy = d * x + (z - b) * y;
             dz = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
          }

          x += dx * dt;
          y += dy * dt;
          z += dz * dt;
          
          const v = new THREE.Vector3(x, y, z);

          // Center the attractor to ensure rotation is around the visual center
          if (attractorType === 'lorenz') {
             v.z -= 25; 
          }
          if (attractorType === 'rossler') {
             v.z -= 20;
          }

          v.applyQuaternion(quaternion);

          // Apply World Offset
          v.x += xOffset;
          v.y += yOffset;

          // Perspective Projection
          const dist = 5.0; // Further back for attractors
          
          const px = (v.x / (v.z + dist)) * currentScale;
          const py = (v.y / (v.z + dist)) * currentScale;

          // Clamp to screen limits [-1, 1] to prevent overflow
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
  }, [active, pointsCount, cloneCount, layoutMode, gridRows, gridCols, attractorType]);

  return { signalA, signalB };
}
