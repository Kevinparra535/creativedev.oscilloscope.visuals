import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { CRTScreen } from "./components/CRTScreen";
import { GridOverlay } from "./components/GridOverlay";
import { SceneSetup } from "./components/SceneSetup";
import { ElectronBeam } from "./components/ElectronBeam";
import { createTestSignal } from "../../utils/signalGenerator";

const R3FCanvas = () => {
  // Generate test waveform signals
  const sineWave = useMemo(() => createTestSignal("sine", 440, 0.1), []);

  return (
    <Canvas
      camera={{
        position: [0, 0, 12],
        fov: 50,
      }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={["#000000"]} />
      <SceneSetup />
      <CRTScreen width={8} height={6} />
      <GridOverlay
        width={8}
        height={6}
        divisions={{ horizontal: 8, vertical: 10 }}
        color="#00ff00"
        opacity={0.4}
      />
      {/* Realistic electron beam trace */}
      <ElectronBeam
        signal={sineWave}
        width={8}
        height={6}
        voltsPerDiv={1}
        color="#00ff00"
        beamWidth={0.03}
        intensity={1.2}
        persistence={0.98}
      />
    </Canvas>
  );
};

export default R3FCanvas;
