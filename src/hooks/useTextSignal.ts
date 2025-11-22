import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FontLoader, Font } from "three/examples/jsm/loaders/FontLoader.js";

interface UseTextSignalOptions {
  active: boolean;
  text: string;
  pointsCount?: number;
  rotationSpeed?: number;
  cloneCount?: number;
}

// Helper function for point in polygon check (Ray Casting algorithm)
// function isPointInPolygon(point: THREE.Vector2, vs: THREE.Vector2[]) {
//   const x = point.x, y = point.y;
//   let inside = false;
//   for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
//       const xi = vs[i].x, yi = vs[i].y;
//       const xj = vs[j].x, yj = vs[j].y;
//       const intersect = ((yi > y) !== (yj > y))
//           && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
//       if (intersect) inside = !inside;
//   }
//   return inside;
// }

export default function useTextSignal({
  active,
  text,
  pointsCount = 2000,
  rotationSpeed = 1,
  cloneCount = 1,
}: UseTextSignalOptions) {
  const [signalA, setSignalA] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );
  const [signalB, setSignalB] = useState<Float32Array>(
    new Float32Array(pointsCount)
  );
  const [font, setFont] = useState<Font | null>(null);

  const requestRef = useRef<number | undefined>(undefined);
  const speedRef = useRef(rotationSpeed);
  
  // Animation refs for smooth transitions
  const offsetsRef = useRef<{x: number, y: number}[]>([]);
  const scaleRef = useRef(0.4);

  useEffect(() => {
    speedRef.current = rotationSpeed;
  }, [rotationSpeed]);

  // Load Font
  useEffect(() => {
    const loader = new FontLoader();
    // Using Droid Sans Mono for a "computer terminal" look
    loader.load(
      "https://threejs.org/examples/fonts/droid/droid_sans_mono_regular.typeface.json",
      (loadedFont) => {
        setFont(loadedFont);
      },
      undefined,
      (err) => console.error("Failed to load font:", err)
    );
  }, []);

  useEffect(() => {
    if (!active || !font || !text) return;

    const animate = () => {
      // Fixed orientation for "WordArt" look without spinning
      // Flat orientation for clean oscilloscope look
      const tiltX = 0; 
      const tiltY = 0; 
      const tiltZ = 0;

      const euler = new THREE.Euler(tiltX, tiltY, tiltZ);
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      // Generate Shapes
      const shapes = font.generateShapes(text, 1); // Size 1
      
      // Extract points
      const allPoints: THREE.Vector3[] = [];
      
      // Calculate bounding box to center text
      const geometry = new THREE.ShapeGeometry(shapes);
      geometry.computeBoundingBox();
      const centerOffset = new THREE.Vector3();
      if (geometry.boundingBox) {
        geometry.boundingBox.getCenter(centerOffset);
      }

      // Simplified Outline Logic (Oscilloscope Style)
      // Just the path of the letters, sequential, left to right
      shapes.forEach((shape) => {
        const processPath = (path: THREE.Path | THREE.Shape) => {
          const points = path.getPoints(); 
          
          // Add points to path
          points.forEach(p => {
            allPoints.push(new THREE.Vector3(p.x, p.y, 0));
          });
          
          // Close the loop
          if (points.length > 0) {
            allPoints.push(new THREE.Vector3(points[0].x, points[0].y, 0));
          }
        };

        processPath(shape);
        
        if (shape.holes && shape.holes.length > 0) {
           shape.holes.forEach(hole => processPath(hole));
        }
      });

      if (allPoints.length === 0) return;

      // Generate Buffer
      const bufferA = new Float32Array(pointsCount);
      const bufferB = new Float32Array(pointsCount);

      // Interpolate path to fit pointsCount
      const totalSourcePoints = allPoints.length;
      
      // If dual, we split the buffer in two halves
      const passes = Math.max(1, cloneCount);
      const pointsPerPass = Math.floor(pointsCount / passes);

      // Initialize new offsets at center (0,0) if needed
      while (offsetsRef.current.length < passes) {
         offsetsRef.current.push({ x: 0, y: 0 });
      }

      // Smooth Scale Transition
      // Adjusted for Orthographic projection (previously divided by dist=2.5)
      const targetScale = passes > 1 ? 0.08 : 0.16;
      scaleRef.current += (targetScale - scaleRef.current) * 0.05;
      const currentScale = scaleRef.current;

      let bufferIdx = 0;

      for (let pass = 0; pass < passes; pass++) {
        // Calculate Target Offset
        let targetX = 0;
        let targetY = 0;
        
        if (passes > 1) {
          const radius = 1.6; // Larger radius for text so they don't overlap
          const angle = (pass / passes) * Math.PI * 2 + Math.PI / 2;
          targetX = Math.cos(angle) * radius;
          targetY = Math.sin(angle) * radius;
        }

        // Smooth Position Transition (Lerp)
        offsetsRef.current[pass].x += (targetX - offsetsRef.current[pass].x) * 0.05;
        offsetsRef.current[pass].y += (targetY - offsetsRef.current[pass].y) * 0.05;
        
        const xOffset = offsetsRef.current[pass].x;
        const yOffset = offsetsRef.current[pass].y;

        for (let i = 0; i < pointsPerPass; i++) {
          // Map buffer index to source point index
          const t = i / (pointsPerPass - 1);
          const virtualIndex = t * (totalSourcePoints - 1);
          const idx1 = Math.floor(virtualIndex);
          const idx2 = Math.min(idx1 + 1, totalSourcePoints - 1);
          const frac = virtualIndex - idx1;

          const p1 = allPoints[idx1];
          const p2 = allPoints[idx2];

          // Interpolate local 2D point (before 3D transform)
          const x1 = p1.x - centerOffset.x;
          const y1 = p1.y - centerOffset.y;
          const z1 = p1.z - centerOffset.z;

          const x2 = p2.x - centerOffset.x;
          const y2 = p2.y - centerOffset.y;
          const z2 = p2.z - centerOffset.z;

          const ix = x1 + (x2 - x1) * frac;
          const iy = y1 + (y2 - y1) * frac;
          const iz = z1 + (z2 - z1) * frac;

          // Create vector and apply rotation
          const v = new THREE.Vector3(ix, iy, iz);
          
          // Apply 3D rotation
          v.applyQuaternion(quaternion);

          // Apply World Offset
          v.x += xOffset;
          v.y += yOffset;

          // Orthographic Projection (Flat)
          // Just scale x and y, ignore z for projection
          const px = v.x * currentScale;
          const py = v.y * currentScale;

          bufferA[bufferIdx] = px;
          bufferB[bufferIdx] = py;
          bufferIdx++;
        }
      }

      setSignalA(bufferA);
      setSignalB(bufferB);

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [active, font, text, pointsCount, cloneCount]);

  return { signalA, signalB };
}
