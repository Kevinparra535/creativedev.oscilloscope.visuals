import { Canvas } from "@react-three/fiber";
import { CRTScreen } from "./components/CRTScreen";
import { GridOverlay } from "./components/GridOverlay";
import { SceneSetup } from "./components/SceneSetup";

const R3FCanvas = () => {
  return (
    <Canvas
      camera={{
        position: [0, 0, 12],
        fov: 50,
      }}
    >
      <SceneSetup />
      <CRTScreen width={8} height={6} />
      <GridOverlay
        width={8}
        height={6}
        divisions={{ horizontal: 8, vertical: 10 }}
        color="#00ff00"
        opacity={0.4}
      />
    </Canvas>
  );
};

export default R3FCanvas;
