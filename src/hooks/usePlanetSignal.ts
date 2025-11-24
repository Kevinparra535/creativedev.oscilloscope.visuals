import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface UsePlanetSignalOptions {
  active: boolean;
  pointsCount?: number;
  rotationSpeed?: number;
  cloneCount?: number;
  layoutMode?: "polygon" | "grid";
  gridRows?: number;
  gridCols?: number;
}

export default function usePlanetSignal({
  active,
  pointsCount = 2000,
  rotationSpeed = 1,
  cloneCount = 1,
  layoutMode = "polygon",
  gridRows = 2,
  gridCols = 3,
}: UsePlanetSignalOptions) {
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
          
          // Grid spacing
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

        // Generate Sphere Spiral Points
        // Spiral parameters
        const turns = 12; // Number of latitude turns
        
        for (let i = 0; i < pointsPerPass; i++) {
          if (bufferIdx >= pointsCount) break;
          
          const t = i / (pointsPerPass - 1); // 0 to 1
          
          // Spherical Spiral Formula
          // phi: 0 to PI (North to South pole)
          // theta: 0 to turns * 2PI (Rotation around Y axis)
          
          const phi = t * Math.PI;
          const theta = t * turns * Math.PI * 2;
          
          const radius = 0.6; // Base radius
          
          const rawX = radius * Math.sin(phi) * Math.cos(theta);
          const rawY = radius * Math.cos(phi); // Up axis
          const rawZ = radius * Math.sin(phi) * Math.sin(theta);
          
          const v = new THREE.Vector3(rawX, rawY, rawZ);
          v.applyQuaternion(quaternion);

          // Apply World Offset
          v.x += xOffset;
          v.y += yOffset;

          // Perspective Projection
          const dist = 1.8; 
          
          const px = (v.x / (v.z + dist)) * currentScale;
          const py = (v.y / (v.z + dist)) * currentScale;

          bufferA[bufferIdx] = px;
          bufferB[bufferIdx] = py;
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
  }, [active, pointsCount, cloneCount, layoutMode, gridRows, gridCols]);

  return { signalA, signalB };
}
