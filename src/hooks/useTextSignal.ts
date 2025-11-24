import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FontLoader, Font } from "three/examples/jsm/loaders/FontLoader.js";

interface UseTextSignalOptions {
  active: boolean;
  text: string;
  pointsCount?: number;
  rotationSpeed?: number;
  cloneCount?: number;
  layoutMode?: "polygon" | "grid";
  gridRows?: number;
  gridCols?: number;
  screenWidth?: number;
  screenHeight?: number;
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
  layoutMode = "polygon",
  gridRows = 2,
  gridCols = 3,
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
  const offsetsRef = useRef<{ x: number; y: number }[]>([]);
  const scaleRef = useRef({ x: 0.4, y: 0.4 });

  useEffect(() => {
    speedRef.current = rotationSpeed;
  }, [rotationSpeed]);

  // Load Font
  useEffect(() => {
    const loader = new FontLoader();
    // Using Helvetiker Bold for a thicker look
    loader.load(
      "https://threejs.org/examples/fonts/helvetiker_bold.typeface.json",
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
      let textWidth = 1;
      let textHeight = 1;

      if (geometry.boundingBox) {
        geometry.boundingBox.getCenter(centerOffset);
        textWidth = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        textHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
      }

      // Simplified Outline Logic (Oscilloscope Style)
      // Just the path of the letters, sequential, left to right
      // With "underscore" trail connection between letters

      let lastShapeEnd: THREE.Vector3 | null = null;

      shapes.forEach((shape) => {
        const shapePoints: THREE.Vector3[] = [];

        const processPath = (path: THREE.Path | THREE.Shape) => {
          let points = path.getPoints();

          // Rotate points to start at bottom-left (min Y, then min X)
          // This ensures entry/exit lines are at the bottom, avoiding cuts through the letter
          if (points.length > 0) {
            let minIdx = 0;
            let minValY = points[0].y;
            let minValX = points[0].x;

            for (let i = 1; i < points.length; i++) {
              // Prioritize Y (bottom), then X (left)
              if (
                points[i].y < minValY ||
                (Math.abs(points[i].y - minValY) < 0.01 &&
                  points[i].x < minValX)
              ) {
                minValY = points[i].y;
                minValX = points[i].x;
                minIdx = i;
              }
            }

            if (minIdx > 0) {
              points = [...points.slice(minIdx), ...points.slice(0, minIdx)];
            }
          }

          points.forEach((p) => {
            shapePoints.push(new THREE.Vector3(p.x, p.y, 0));
          });
          // Close the loop
          if (points.length > 0) {
            shapePoints.push(new THREE.Vector3(points[0].x, points[0].y, 0));
          }
        };

        processPath(shape);
        if (shape.holes && shape.holes.length > 0) {
          shape.holes.forEach((hole) => processPath(hole));
        }

        if (shapePoints.length > 0) {
          // Add connector from previous shape if exists
          if (lastShapeEnd) {
            const startOfCurrent = shapePoints[0];

            // "Underscore" style connection
            // 1. Drop down from previous letter end
            // 2. Draw a line at the bottom (the "_")
            // 3. Go up to next letter start

            const bottomY = 0; // Baseline

            // Point 1: Drop down
            allPoints.push(new THREE.Vector3(lastShapeEnd.x, bottomY, 0));

            // Point 2: Move across (The visible trail)
            allPoints.push(new THREE.Vector3(startOfCurrent.x, bottomY, 0));

            // Point 3: Go up to start (will be connected automatically to startOfCurrent by the next push)
          }

          // Add current shape points
          allPoints.push(...shapePoints);

          // Update last point
          lastShapeEnd = shapePoints[shapePoints.length - 1];
        }
      });

      if (allPoints.length === 0) return;

      // Generate Buffer
      const bufferA = new Float32Array(pointsCount);
      const bufferB = new Float32Array(pointsCount);

      // Interpolate path to fit pointsCount
      const totalSourcePoints = allPoints.length;

      // If dual, we split the buffer in two halves
      const passes =
        layoutMode === "grid" ? gridRows * gridCols : Math.max(1, cloneCount);
      const pointsPerPass = Math.floor(pointsCount / passes);

      // Initialize new offsets at center (0,0) if needed
      while (offsetsRef.current.length < passes) {
        offsetsRef.current.push({ x: 0, y: 0 });
      }

      // Smooth Scale Transition
      // Calculate dynamic scale to fit text in available space
      // We work in NORMALIZED SIGNAL SPACE [-1, 1]
      // XYPlot will scale this by width/2 and height/2 later.

      const N_WIDTH = 2.0;
      const N_HEIGHT = 2.0;

      let targetScaleX = 0.16;
      let targetScaleY = 0.16;

      // Safety check for dimensions
      const safeTextWidth = Math.max(textWidth, 0.1);
      const safeTextHeight = Math.max(textHeight, 0.1);
      const safeGridCols = Math.max(gridCols || 1, 1);
      const safeGridRows = Math.max(gridRows || 1, 1);

      if (layoutMode === "grid") {
        // Grid Mode: Fit within cell
        // Cell Width = 2.0 / Cols
        // Use 80% of cell size for padding
        const cellW = (N_WIDTH / safeGridCols) * 0.8;
        const cellH = (N_HEIGHT / safeGridRows) * 0.8;

        targetScaleX = cellW / safeTextWidth;
        targetScaleY = cellH / safeTextHeight;
      } else {
        // Polygon/Single Mode
        if (passes > 1) {
          // Multiple clones in circle
          // Radius ~ 0.5 (Normalized)
          const maxW = 0.6;
          const maxH = 0.5;
          targetScaleX = maxW / safeTextWidth;
          targetScaleY = maxH / safeTextHeight;
        } else {
          // Single centered text
          // Fit to screen (leave margin)
          // Use 90% of normalized screen
          const maxW = N_WIDTH * 0.9;
          const maxH = N_HEIGHT * 0.9;
          targetScaleX = maxW / safeTextWidth;
          targetScaleY = maxH / safeTextHeight;
        }
      }

      // Safety clamp for scale
      if (!isFinite(targetScaleX) || targetScaleX <= 0) targetScaleX = 0.01;
      if (!isFinite(targetScaleY) || targetScaleY <= 0) targetScaleY = 0.01;

      scaleRef.current.x += (targetScaleX - scaleRef.current.x) * 0.05;
      scaleRef.current.y += (targetScaleY - scaleRef.current.y) * 0.05;

      const currentScaleX = scaleRef.current.x;
      const currentScaleY = scaleRef.current.y;

      let bufferIdx = 0;

      for (let pass = 0; pass < passes; pass++) {
        // Calculate Target Offset
        let targetX = 0;
        let targetY = 0;

        if (layoutMode === "grid") {
          const col = pass % gridCols;
          const row = Math.floor(pass / gridCols);

          // Grid spacing - Normalized
          const spacingX = N_WIDTH / safeGridCols;
          const spacingY = N_HEIGHT / safeGridRows;

          const gridWidth = (safeGridCols - 1) * spacingX;
          const gridHeight = (safeGridRows - 1) * spacingY;

          targetX = col * spacingX - gridWidth / 2;
          // Flip Y so row 0 is top
          targetY = -(row * spacingY - gridHeight / 2);
        } else if (passes > 1) {
          const radius = 0.5; // Normalized radius
          const angle = (pass / passes) * Math.PI * 2 + Math.PI / 2;
          targetX = Math.cos(angle) * radius;
          targetY = Math.sin(angle) * radius;
        }

        // Smooth Position Transition (Lerp)
        offsetsRef.current[pass].x +=
          (targetX - offsetsRef.current[pass].x) * 0.05;
        offsetsRef.current[pass].y +=
          (targetY - offsetsRef.current[pass].y) * 0.05;

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

          // Apply Scale FIRST (Local Scale)
          v.x *= currentScaleX;
          v.y *= currentScaleY;

          // Apply World Offset
          v.x += xOffset;
          v.y += yOffset;

          // Orthographic Projection (Flat)
          const px = v.x;
          const py = v.y;

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
  }, [
    active,
    font,
    text,
    pointsCount,
    cloneCount,
    layoutMode,
    gridRows,
    gridCols,
  ]);

  return { signalA, signalB };
}
