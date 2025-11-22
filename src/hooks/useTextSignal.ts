import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FontLoader, Font } from "three/examples/jsm/loaders/FontLoader.js";

interface UseTextSignalOptions {
  active: boolean;
  text: string;
  pointsCount?: number;
  rotationSpeed?: number;
}

// Helper function for point in polygon check (Ray Casting algorithm)
function isPointInPolygon(point: THREE.Vector2, vs: THREE.Vector2[]) {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].x, yi = vs[i].y;
      const xj = vs[j].x, yj = vs[j].y;
      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
  }
  return inside;
}

export default function useTextSignal({
  active,
  text,
  pointsCount = 2000,
  rotationSpeed = 1,
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
      // Slight tilt to show depth
      const tiltX = -0.1; 
      const tiltY = 0.3; 
      const tiltZ = 0.0;

      const euler = new THREE.Euler(tiltX, tiltY, tiltZ);
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      // Generate Shapes
      const shapes = font.generateShapes(text, 1); // Size 1
      
      // Extract points
      const allPoints: THREE.Vector3[] = [];
      const depth = 0.2; // Extrusion depth
      
      // Calculate bounding box to center text
      const geometry = new THREE.ShapeGeometry(shapes);
      geometry.computeBoundingBox();
      const centerOffset = new THREE.Vector3();
      if (geometry.boundingBox) {
        geometry.boundingBox.getCenter(centerOffset);
      }

      // 1. Generate Scanlines for "Fill" (Horizontal lines)
      // This looks much cleaner on an oscilloscope than triangulation
      const scanlineSpacing = 0.15; // Density of fill lines
      
      shapes.forEach((shape) => {
        // Get shape bounds
        const shapeGeometry = new THREE.ShapeGeometry(shape);
        shapeGeometry.computeBoundingBox();
        const bounds = shapeGeometry.boundingBox;
        
        if (!bounds) return;

        // Discretize shape and holes for point-inside checks
        const shapePoints = shape.getPoints(12);
        const holesPoints = shape.holes.map(h => h.getPoints(12));

        // Helper to check if point is inside shape but outside holes
        const isInside = (pt: THREE.Vector2) => {
           // Check inside outer shape
           if (!isPointInPolygon(pt, shapePoints)) return false;
           
           // Check outside all holes
           for (const hole of holesPoints) {
             if (isPointInPolygon(pt, hole)) return false;
           }
           return true;
        };

        // Scan vertically
        for (let y = bounds.min.y; y <= bounds.max.y; y += scanlineSpacing) {
          let lineStart: THREE.Vector2 | null = null;
          
          // Scan horizontally with fine step to detect segments
          const resolution = 0.05;
          for (let x = bounds.min.x; x <= bounds.max.x; x += resolution) {
            const pt = new THREE.Vector2(x, y);
            const inside = isInside(pt);

            if (inside) {
              if (!lineStart) lineStart = pt; // Start of a segment
            } else {
              if (lineStart) {
                // End of a segment, push line
                const vStart = new THREE.Vector3(lineStart.x, lineStart.y, depth / 2);
                const vEnd = new THREE.Vector3(x - resolution, y, depth / 2);
                allPoints.push(vStart, vEnd);
                lineStart = null;
              }
            }
          }
          // Close pending segment at end of row
          if (lineStart) {
             const vStart = new THREE.Vector3(lineStart.x, lineStart.y, depth / 2);
             const vEnd = new THREE.Vector3(bounds.max.x, y, depth / 2);
             allPoints.push(vStart, vEnd);
          }
        }
      });
      
      // 2. Add Extrusion Lines (Connect Front to Back) & Outlines
      // We iterate the shapes to get the outline
      shapes.forEach((shape) => {
        const processPath = (path: THREE.Path | THREE.Shape) => {
          const points = path.getPoints(6); // Lower resolution for outline
          
          // Create Back Loop (z = -depth/2)
          const backPoints = points.map(p => new THREE.Vector3(p.x, p.y, -depth / 2));
          // Front points for connection
          const frontPoints = points.map(p => new THREE.Vector3(p.x, p.y, depth / 2));
          
          // Draw Back Loop
          for (let i = 0; i < backPoints.length - 1; i++) {
             allPoints.push(backPoints[i], backPoints[i+1]);
          }
          // Close loop
          allPoints.push(backPoints[backPoints.length-1], backPoints[0]);

          // Connect Front to Back (Struts)
          for (let i = 0; i < frontPoints.length; i++) {
            allPoints.push(frontPoints[i], backPoints[i]);
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
      
      // We want to traverse the text points and map them to the buffer
      // If buffer is larger than points, we interpolate.
      // If smaller, we skip.
      
      for (let i = 0; i < pointsCount; i++) {
        // Map buffer index to source point index
        // Use a "virtual" index that loops or clamps
        // For text, we probably want to loop the drawing if pointsCount is huge, 
        // or just stretch the drawing.
        // Let's stretch/interpolate along the total length of the text path.
        
        const t = i / (pointsCount - 1);
        const virtualIndex = t * (totalSourcePoints - 1);
        const idx1 = Math.floor(virtualIndex);
        const idx2 = Math.min(idx1 + 1, totalSourcePoints - 1);
        const frac = virtualIndex - idx1;

        const p1 = allPoints[idx1];
        const p2 = allPoints[idx2];

        // Interpolate local 2D point (before 3D transform)
        // Actually, let's center them first
        const x1 = p1.x - centerOffset.x;
        const y1 = p1.y - centerOffset.y;
        const z1 = p1.z - centerOffset.z; // z is 0, so just -centerOffset.z (which is 0 usually)

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

        // Perspective Projection
        const dist = 2.5; 
        const scale = 0.4; // Reduced scale to fit grid
        
        const px = (v.x / (v.z + dist)) * scale;
        const py = (v.y / (v.z + dist)) * scale;

        bufferA[i] = px;
        bufferB[i] = py;
      }

      setSignalA(bufferA);
      setSignalB(bufferB);

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [active, font, text, pointsCount]);

  return { signalA, signalB };
}
