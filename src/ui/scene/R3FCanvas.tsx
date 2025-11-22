import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { Leva, useControls, folder } from "leva";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { CanvasContainer } from "../styles/ScopeControls.styled";
import { CRTScreen } from "./components/CRTScreen";
import { GridOverlay } from "./components/GridOverlay";
import { SceneSetup } from "./components/SceneSetup";
import Waveform from "./components/Waveform";
import XYPlot from "./components/XYPlot";
import WaveformTrail from "./components/WaveformTrail";
import useAudioWindow from "../../hooks/useAudioWindow";
import useStereoAudioWindow from "../../hooks/useStereoAudioWindow";
import useAudioFeatures from "../../hooks/useAudioFeatures";
import { createTestSignal } from "../../utils/signalGenerator";

const R3FCanvas = () => {
  const {
    mode,
    msPerDiv,
    autoGain,
    manualGain,
    showTrigger,
    showPersistence,
    trailLength,
    enableBloom,
    bloomIntensity,
    bloomThreshold,
    scaleGain,
    rotateGain,
    thicknessGain,
    trailBoost,
    offsetX,
    offsetY,
  } = useControls({
    Mode: folder({
      mode: { options: { "Y–T": "yt", XY: "xy" }, value: "yt" },
    }),
    Timebase: folder({
      msPerDiv: { value: 10, min: 1, max: 50, step: 1, label: "ms/div" },
    }),
    Gain: folder({
      autoGain: { value: true, label: "Auto" },
      manualGain: { value: 1.5, min: 0.1, max: 5, step: 0.1, label: "Manual" },
    }),
    Visual: folder({
      showTrigger: { value: true, label: "Trigger Marker" },
      showPersistence: { value: false, label: "Persistence" },
      trailLength: { value: 20, min: 0, max: 60, step: 1, label: "Trail Length" },
      enableBloom: { value: false, label: "Glow/Bloom" },
      bloomIntensity: { value: 1.5, min: 0, max: 5, step: 0.1, label: "Bloom Intensity" },
      bloomThreshold: { value: 0.5, min: 0, max: 1, step: 0.05, label: "Bloom Threshold" },
    }),
    Mapping: folder({
      scaleGain: { value: 0.5, min: 0, max: 2, step: 0.1, label: "RMS→Scale" },
      rotateGain: { value: 0.3, min: 0, max: 2, step: 0.1, label: "High→Rotate" },
      thicknessGain: { value: 0.5, min: 0, max: 2, step: 0.1, label: "Mid→Thickness" },
      trailBoost: { value: 10, min: 0, max: 30, step: 1, label: "Low→Trail" },
      offsetX: { value: 0, min: -2, max: 2, step: 0.1, label: "Center X" },
      offsetY: { value: 0, min: -2, max: 2, step: 0.1, label: "Center Y" },
    }),
  });
  const divisionsX = 8;
  const effectiveWindowSize = useMemo(
    () => Math.max(128, Math.round((msPerDiv * divisionsX * 44100) / 1000)),
    [msPerDiv]
  );

  // Audio features for visual mapping
  const { rmsGlobal, bands, beat } = useAudioFeatures({
    fftSize: 2048,
    source: "mic",
    frequency: 440,
    updateIntervalMs: 33,
    smoothingAlpha: 0.15,
    beatThreshold: 1.4,
    beatCooldownMs: 120,
  });

  // Read-only monitors
  useControls("Monitors", {
    rmsGlobal: { value: rmsGlobal, editable: false },
    lowBand: { value: bands.low.smoothed, editable: false },
    midBand: { value: bands.mid.smoothed, editable: false },
    highBand: { value: bands.high.smoothed, editable: false },
    beatConf: { value: beat.confidence, editable: false },
  }, [rmsGlobal, bands, beat]);

  const {
    window: liveWindow,
    scale: dynamicScale,
    triggerIndex,
  } = useAudioWindow({
    source: "mic",
    windowSize: effectiveWindowSize,
    fftSize: 2048,
    frequency: 440,
    triggerEnabled: true,
    triggerLevel: 0,
    triggerEdge: "rising",
    autoScale: autoGain,
    targetPeak: 0.9,
    scaleAlpha: 0.15,
  });

  const fallback = useMemo(() => createTestSignal("sine", 440, 0.1), []);
  const signalToDraw = liveWindow.some((v) => v !== 0) ? liveWindow : fallback;

  const secondarySignal = useMemo(() => {
    const ratioFreq = 660;
    const duration = 0.1;
    const bRaw = createTestSignal("sine", ratioFreq, duration);
    const phaseOffset = Math.PI / 3;
    const b = new Float32Array(bRaw.length);
    for (let i = 0; i < bRaw.length; i++) {
      const t = i / 44100;
      b[i] = Math.sin(2 * Math.PI * ratioFreq * t + phaseOffset) * 0.8;
    }
    return b;
  }, []);

  const {
    left: leftXY,
    right: rightXY,
    isStereo: isStereoXY,
    scale: xyScale,
  } = useStereoAudioWindow({
    windowSize: effectiveWindowSize,
    autoScale: true,
    fftSize: 2048,
    source: "mic",
    frequencyA: 440,
    frequencyB: 660,
    phaseOffset: Math.PI / 3,
  });

  const xySignalA =
    isStereoXY && leftXY.some((v) => v !== 0) ? leftXY : signalToDraw;
  const xySignalB =
    isStereoXY && rightXY.some((v) => v !== 0) ? rightXY : secondarySignal;

  // Feature mapping
  const scaleMod = 1 + rmsGlobal * scaleGain;
  const rotateMod = bands.high.smoothed * rotateGain * Math.PI * 2;
  const thicknessMod = 0.03 + bands.mid.smoothed * thicknessGain * 0.02;
  const trailLengthMod = Math.floor(trailLength + bands.low.smoothed * trailBoost);
  const beatFlash = beat.isBeat ? 1.2 : 1;

  return (
    <CanvasContainer>
      <Leva collapsed />
      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
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

        <group
          position={[offsetX, offsetY, 0]}
          rotation={[0, 0, mode === "xy" ? rotateMod : 0]}
          scale={mode === "xy" ? scaleMod : 1}
        >
        {mode === "yt" ? (
          <Waveform
            signal={signalToDraw}
            width={8}
            height={6}
            amplitudeScale={(autoGain ? 1.5 * dynamicScale : manualGain) * beatFlash}
            color="#00ff00"
            lineWidth={thicknessMod}
            triggerIndex={triggerIndex}
            showTrigger={showTrigger}
          />
        ) : (
          <XYPlot
            signalA={xySignalA}
            signalB={xySignalB}
            width={8}
            height={6}
            scaleX={1.2 * (isStereoXY ? xyScale : 1) * beatFlash}
            scaleY={1.2 * (isStereoXY ? xyScale : 1) * beatFlash}
            color="#00ff00"
            lineWidth={thicknessMod * 0.8}
          />
        )}

        </group>

        {mode === "yt" && showPersistence && trailLengthMod > 0 && (
          <group position={[offsetX, offsetY, 0]}>
            <WaveformTrail
              signal={signalToDraw}
              trailLength={trailLengthMod}
              width={8}
              height={6}
              amplitudeScale={autoGain ? 1.5 * dynamicScale : manualGain}
              color="#00ff00"
              lineWidth={0.02}
            />
          </group>
        )}

        {enableBloom && (
          <EffectComposer>
            <Bloom
              intensity={bloomIntensity * (beat.isBeat ? 1.5 : 1)}
              luminanceThreshold={bloomThreshold}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Canvas>
    </CanvasContainer>
  );
};

export default R3FCanvas;
