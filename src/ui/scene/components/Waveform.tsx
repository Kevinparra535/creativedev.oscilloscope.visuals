import { useMemo } from "react";
import * as THREE from "three";

/**
 * CONCEPTO FUNDAMENTAL DE OSCILOSCOPIO:
 *
 * Un osciloscopio dibuja cómo cambia una señal en el tiempo.
 *
 * - EJE X (horizontal): TIEMPO
 *   Cada punto en X representa un momento en el tiempo.
 *   En un array de samples, el índice i es el "tiempo discreto".
 *
 * - EJE Y (vertical): AMPLITUD
 *   Qué tan fuerte/alta es la señal en ese momento.
 *   Valores típicos: -1 a 1 (audio normalizado)
 *
 * MAPEO BÁSICO:
 *   X = (índice / total_samples) * ancho_pantalla
 *   Y = amplitud * escala_vertical
 */

interface WaveformProps {
  signal: Float32Array;
  width?: number;
  height?: number;
  amplitudeScale?: number;
  color?: string;
  lineWidth?: number;
  triggerIndex?: number;
  showTrigger?: boolean;
}

const Waveform = ({
  signal,
  width = 8,
  height = 6,
  amplitudeScale = 1,
  color = "#00ff00",
  lineWidth = 0.02,
  triggerIndex = 0,
  showTrigger = false,
}: WaveformProps) => {
  // Crear geometría: una línea que conecta todos los puntos
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];

    // Recorrer todos los samples de la señal
    for (let i = 0; i < signal.length; i++) {
      // X = tiempo (normalizado de 0 a 1, luego escalado al ancho)
      // El índice i representa "cuándo" en la señal
      const normalizedTime = i / (signal.length - 1); // 0.0 a 1.0
      const x = normalizedTime * width - width / 2; // Centrar en 0

      // Y = amplitud (valor de la señal en ese momento)
      // signal[i] es típicamente -1 a 1 para audio
      const amplitude = signal[i];
      const y = amplitude * amplitudeScale * (height / 4); // Escalar a pantalla

      // Z = profundidad (0.01 para estar ligeramente al frente)
      const z = 0.01;

      points.push(new THREE.Vector3(x, y, z));
    }

    // BufferGeometry desde puntos
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [signal, width, height, amplitudeScale]);

  const triggerX = (triggerIndex / (signal.length - 1)) * width - width / 2;

  return (
    <group>
      {/* @ts-expect-error - R3F primitive */}
      <line geometry={geometry}>
        <lineBasicMaterial
          color={color}
          linewidth={lineWidth}
          transparent={true}
          opacity={0.9}
        />
      </line>
      {showTrigger && triggerIndex >= 0 && triggerIndex < signal.length && (
        <mesh position={[triggerX, 0, 0]}>
          <boxGeometry args={[0.02, height, 0.001]} />
          <meshBasicMaterial color="#ff0066" transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
};

export default Waveform;
