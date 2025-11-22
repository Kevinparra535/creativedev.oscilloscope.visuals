import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import {
  CanvasContainer,
  ToggleBar,
  ModeButton,
} from "../styles/ScopeControls.styled";

import { CRTScreen } from "./components/CRTScreen";
import { GridOverlay } from "./components/GridOverlay";
import { SceneSetup } from "./components/SceneSetup";
import Waveform from "./components/Waveform";
import XYPlot from "./components/XYPlot";

import useAudioWindow from "../../hooks/useAudioWindow";

import { createTestSignal } from "../../utils/signalGenerator";

const R3FCanvas = () => {
  const [mode, setMode] = useState<"yt" | "xy">("yt");
  // Live audio window (mic if available, oscillator fallback)
  const liveSignal = useAudioWindow({
    source: "mic",
    windowSize: 1024,
    fftSize: 2048,
    frequency: 440,
  });

  // Fallback static test signal if hook still initializing (all zeros)
  const fallback = useMemo(() => createTestSignal("sine", 440, 0.1), []);
  const signalToDraw = liveSignal.some((v) => v !== 0) ? liveSignal : fallback;
  // Second synthetic signal for XY (phase shifted + frequency ratio for Lissajous)
  const secondarySignal = useMemo(() => {
    const ratioFreq = 660; // relative to liveSignal (~440Hz mic/osc) for Lissajous
    const duration = 0.1;
    // Base signal currently unused (liveSignal serves as signalA); kept if future dual-source logic needed
    // const a = createTestSignal("sine", baseFreq, duration);
    const bRaw = createTestSignal("sine", ratioFreq, duration);
    // Apply phase offset
    const phaseOffset = Math.PI / 3; // 60°
    const b = new Float32Array(bRaw.length);
    for (let i = 0; i < bRaw.length; i++) {
      const t = i / 44100; // seconds
      b[i] = Math.sin(2 * Math.PI * ratioFreq * t + phaseOffset) * 0.8;
    }
    return b;
  }, []);

  return (
    <CanvasContainer>
      <ToggleBar>
        <ModeButton active={mode === "yt"} onClick={() => setMode("yt")}>
          Y–T
        </ModeButton>
        <ModeButton active={mode === "xy"} onClick={() => setMode("xy")}>
          XY
        </ModeButton>
      </ToggleBar>
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

        {mode === "yt" ? (
          <Waveform
            signal={signalToDraw}
            width={8}
            height={6}
            amplitudeScale={1.5}
            color="#00ff00"
            lineWidth={0.03}
          />
        ) : (
          <XYPlot
            signalA={signalToDraw}
            signalB={secondarySignal}
            width={8}
            height={6}
            scaleX={1.2}
            scaleY={1.2}
            color="#00ff00"
            lineWidth={0.025}
          />
        )}
      </Canvas>
    </CanvasContainer>
  );
};

export default R3FCanvas;
