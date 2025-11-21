import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ElectronBeamProps {
  signal: Float32Array;
  width?: number;
  height?: number;
  voltsPerDiv?: number;
  color?: string;
  beamWidth?: number;
  intensity?: number;
  persistence?: number;
}

export function ElectronBeam({
  signal,
  width = 8,
  height = 6,
  voltsPerDiv = 1,
  color = "#00ff00",
  beamWidth = 0.02,
  intensity = 1,
  persistence = 0.95,
}: ElectronBeamProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailsRef = useRef<THREE.Points>(null);
  const timeOffset = useRef(0);

  // Create geometry for the main beam trace as points
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(signal.length * 3);
    const colors = new Float32Array(signal.length * 3);
    const sizes = new Float32Array(signal.length);

    const colorRGB = new THREE.Color(color);

    for (let i = 0; i < signal.length; i++) {
      // Map time to X position (horizontal sweep)
      const x = (i / signal.length) * width - width / 2;

      // Map voltage to Y position (vertical deflection)
      const y = (signal[i] / voltsPerDiv) * (height / 8);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = 0.02;

      colors[i * 3] = colorRGB.r;
      colors[i * 3 + 1] = colorRGB.g;
      colors[i * 3 + 2] = colorRGB.b;

      sizes[i] = beamWidth * 50;
    }

    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    return geom;
  }, [signal, width, height, voltsPerDiv, color, beamWidth]);

  // Create phosphor persistence trail particles
  const trailGeometry = useMemo(() => {
    const particleCount = signal.length * 5;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const alphas = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      alphas[i] = 0;
      sizes[i] = beamWidth * 30;
    }

    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
    geom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    return geom;
  }, [signal.length, beamWidth]);

  // Particle material for persistence trails
  const trailMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        pointTexture: { value: createCircleTexture() },
      },
      vertexShader: /* glsl */ `
        attribute float alpha;
        attribute float size;
        varying float vAlpha;
        
        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        uniform sampler2D pointTexture;
        varying float vAlpha;
        
        void main() {
          vec4 texColor = texture2D(pointTexture, gl_PointCoord);
          vec3 glowColor = color * 1.5;
          gl_FragColor = vec4(glowColor, texColor.a * vAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [color]);

  // Animate the beam trace
  useFrame((_state, delta) => {
    if (!pointsRef.current || !trailsRef.current) return;

    timeOffset.current += delta;

    // Decay persistence trails
    const alphas = trailGeometry.getAttribute("alpha") as THREE.BufferAttribute;
    for (let i = 0; i < alphas.count; i++) {
      alphas.array[i] *= persistence;
    }
    alphas.needsUpdate = true;

    // Add new trail particles at current beam position
    const positions = geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const trailPositions = trailGeometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;

    const sampleIndex = Math.floor((timeOffset.current * 440) % signal.length);
    if (sampleIndex < positions.count) {
      const x = positions.getX(sampleIndex);
      const y = positions.getY(sampleIndex);
      const z = positions.getZ(sampleIndex);

      // Update a particle for persistence
      const particleIndex = Math.floor(Math.random() * alphas.count);
      trailPositions.setXYZ(particleIndex, x, y, z);
      alphas.array[particleIndex] = 1.0;
    }

    trailPositions.needsUpdate = true;
  });

  return (
    <group>
      {/* Main beam trace as points */}
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color={color}
          size={beamWidth * 50}
          transparent
          opacity={intensity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation={false}
        />
      </points>

      {/* Phosphor persistence trails */}
      <points
        ref={trailsRef}
        geometry={trailGeometry}
        material={trailMaterial}
      />
    </group>
  );
}

// Helper function to create circular point texture
function createCircleTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;

  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.3)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;

  return texture;
}
