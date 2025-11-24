import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface UseCubeSignalOptions {
  active: boolean;
  pointsCount?: number;
  rotationSpeed?: number;
  cloneCount?: number;
  layoutMode?: "polygon" | "grid";
  gridRows?: number;
  gridCols?: number;
}

export default function useCubeSignal({
  active,
  pointsCount = 2000,
  rotationSpeed = 1,
  cloneCount = 1,
  layoutMode = "polygon",
  gridRows = 2,
  gridCols = 3,
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
      rotationRef.current.z += 0.003 * speed;

      const euler = rotationRef.current;
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      // Generate Buffer
      const bufferA = new Float32Array(pointsCount);
      const bufferB = new Float32Array(pointsCount);

      // Interpolate path
      const totalSegments = path.length - 1;
      
      // Multi-clone logic
      const passes = layoutMode === "grid" ? gridRows * gridCols : Math.max(1, cloneCount);
      const pointsPerPass = Math.floor(pointsCount / passes);
      const pointsPerSegment = Math.floor(pointsPerPass / totalSegments);

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

        for (let i = 0; i < totalSegments; i++) {
          const idx1 = path[i];
          const idx2 = path[i + 1];
          const v1 = vertices[idx1].clone().applyQuaternion(quaternion);
          const v2 = vertices[idx2].clone().applyQuaternion(quaternion);

          // Apply World Offset
          v1.x += xOffset;
          v1.y += yOffset;
          v2.x += xOffset;
          v2.y += yOffset;

          // Perspective Projection
          // x' = x / (z + dist)
          // Closer distance = stronger perspective distortion
          const dist = 1.8; 
          
          const p1x = (v1.x / (v1.z + dist)) * currentScale;
          const p1y = (v1.y / (v1.z + dist)) * currentScale;
          const p2x = (v2.x / (v2.z + dist)) * currentScale;
          const p2y = (v2.y / (v2.z + dist)) * currentScale;

          for (let j = 0; j < pointsPerSegment; j++) {
            if (bufferIdx >= pointsCount) break;
            const t = j / pointsPerSegment;
            bufferA[bufferIdx] = p1x + (p2x - p1x) * t;
            bufferB[bufferIdx] = p1y + (p2y - p1y) * t;
            bufferIdx++;
          }
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

