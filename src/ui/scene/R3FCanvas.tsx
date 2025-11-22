import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { Leva, useControls, folder } from "leva";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";
import { CanvasContainer } from "../styles/ScopeControls.styled";
import AudioFileUpload from "../components/AudioFileUpload";
import { CRTScreen } from "./components/CRTScreen.tsx";
import { GridOverlay } from "./components/GridOverlay.tsx";
import { SceneSetup } from "./components/SceneSetup.tsx";
import Waveform from "./components/Waveform.tsx";
import XYPlot from "./components/XYPlot.tsx";
import WaveformTrail from "./components/WaveformTrail.tsx";
import useAudioWindow from "../../hooks/useAudioWindow";
import useStereoAudioWindow from "../../hooks/useStereoAudioWindow";
import useAudioFeatures from "../../hooks/useAudioFeatures";
import useAudioInput from "../../hooks/useAudioInput";
import useCubeSignal from "../../hooks/useCubeSignal";
import useTextSignal from "../../hooks/useTextSignal";
import { createTestSignal } from "../../utils/signalGenerator";

const R3FCanvas = () => {
  const [uploadedFile, setUploadedFile] = useState<string>("");
  const [beamSpeed, setBeamSpeed] = useState(1000);
  const [cubeRotationSpeed, setCubeRotationSpeed] = useState(0);
  const [cloneCount, setCloneCount] = useState(1);

  const { mode, figureType, audioSource, textInput } = useControls({
    Mode: folder({
      mode: {
        options: { "Y–T": "yt", XY: "xy" },
        value: "xy",
      },
      figureType: {
        options: { "Default": "default", "3D Cube": "cube", "3D Text": "text" },
        value: "cube",
        label: "Figure",
      },
      textInput: {
        value: "OSCILLOSCOPE",
        label: "Text Input",
        render: (get) => get("Mode.figureType") === "text",
      },
      audioSource: {
        options: { Microphone: "mic", "Upload File": "file" },
        value: "mic",
        label: "Audio Source",
        render: (get) => get("Mode.figureType") === "default",
      },
    }),
  });

  // Calculate dynamic max clones based on text length
  const maxClonesLimit = useMemo(() => {
    if (figureType === "cube") return 8;
    // Use the actual text length that will be rendered (substring 0, 12)
    const effectiveText = textInput.substring(0, 12);
    const len = effectiveText.length || 1;
    // Heuristic: 12 chars -> 5 clones (60/12). 
    return Math.max(1, Math.min(8, Math.floor(60 / len)));
  }, [figureType, textInput]);

  const { enableFormation, formationDelay, targetClones } = useControls(
    "Animation",
    {
      enableFormation: { value: true, label: "Enable Formation" },
      formationDelay: { value: 40, min: 0, max: 120, step: 1, label: "Start Delay (s)" },
      targetClones: {
        value: 5,
        min: 1,
        max: maxClonesLimit,
        step: 1,
        label: "Target Count",
      },
    },
    [maxClonesLimit]
  );

  // Ensure we don't exceed the limit even if the slider value is stale
  const effectiveTargetClones = Math.min(targetClones, maxClonesLimit);

  // Default values for removed controls
  const msPerDiv = 10;
  const autoGain = true;
  const manualGain = 1.5;
  const showTrigger = true;
  const showPersistence = false;
  const trailLength = 20;
  const bloomIntensity = 4.0;
  const bloomThreshold = 0.05;
  const scaleGain = 0.5;
  const rotateGain = 0.3;
  const thicknessGain = 0.5;
  const trailBoost = 10;
  const offsetX = 0;
  const offsetY = 0;
  const divisionsX = 8;
  const effectiveWindowSize = useMemo(
    () => Math.max(128, Math.round((msPerDiv * divisionsX * 44100) / 1000)),
    [msPerDiv]
  );

  // Centralized audio input management (mic/file)
  const { loadAudioFile } = useAudioInput({
    source: audioSource as "mic" | "file",
  });

  const handleFileUpload = (file: File) => {
    loadAudioFile(file);
    setUploadedFile(file.name);
  };

  // Audio features for visual mapping
  const { rmsGlobal, bands, beat } = useAudioFeatures({
    fftSize: 2048,
    source: "mic", // Features always come from mic/shared context for now
    updateIntervalMs: 33,
    smoothingAlpha: 0.15,
    beatThreshold: 1.4,
    beatCooldownMs: 120,
  });

  // Cube Signal Generator
  const { signalA: cubeA, signalB: cubeB } = useCubeSignal({
    active: figureType === "cube",
    pointsCount: cloneCount > 1 ? 4000 : 2000,
    rotationSpeed: cubeRotationSpeed,
    cloneCount,
  });

  // Text Signal Generator
  const { signalA: textA, signalB: textB } = useTextSignal({
    active: figureType === "text",
    text: textInput.substring(0, 12), // Limit to 12 chars to prevent overflow
    pointsCount: cloneCount > 1 ? 4000 : 2000,
    rotationSpeed: cubeRotationSpeed,
    cloneCount,
  });

  // Speed Ramp Logic for Cube/Text Mode
  useEffect(() => {
    if (figureType === "cube" || figureType === "text") {
      let frameId: number;
      const startTime = performance.now();
      const duration = 30000; // 30 seconds ramp for smoother buildup
      
      // Reset clone state on mode change (deferred to avoid sync update warning)
      const resetTimer = setTimeout(() => setCloneCount(1), 0);
      
      // Timer for multi-element appearance
      const formationTimers: NodeJS.Timeout[] = [];
      
      if (enableFormation) {
        const startFormation = setTimeout(() => {
          let count = 1;
          const interval = setInterval(() => {
            if (count < effectiveTargetClones) {
              count++;
              setCloneCount(count);
            } else {
              clearInterval(interval);
            }
          }, 2000); // Add a new clone every 2 seconds
          formationTimers.push(setTimeout(() => clearInterval(interval), (effectiveTargetClones * 2000) + 5000)); // Safety clear
        }, formationDelay * 1000);
        formationTimers.push(startFormation);
      }

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Target speed: Traverse full buffer (2000 points) every frame (1/60s)
        // 2000 * 60 = 120,000 points/sec
        const targetSpeed = 120000;
        const startSpeed = 1; // Start fast enough to see movement

        // Quartic ease-in: starts very slow, accelerates steeply at the end
        const ease = Math.pow(progress, 4);
        const current = startSpeed + (targetSpeed - startSpeed) * ease;

        setBeamSpeed(current);

        // Ramp rotation speed: Start static (0) and ramp to 1
        // Delay rotation slightly to let the shape form first?
        // Let's ramp it alongside beam speed but maybe slower curve
        const rotationEase = Math.pow(progress, 3); // Cubic ease for rotation (starts later/slower)
        setCubeRotationSpeed(rotationEase);

        if (progress < 1) {
          frameId = requestAnimationFrame(animate);
        }
      };

      // Start animation loop
      frameId = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(resetTimer);
        formationTimers.forEach(t => clearTimeout(t));
      };
    } else {
      // Defer state update to avoid synchronous effect warning
      const timeoutId = setTimeout(() => {
        setBeamSpeed(1000);
        setCubeRotationSpeed(0);
        setCloneCount(1);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [figureType, enableFormation, formationDelay, effectiveTargetClones]);

  // Read-only monitors
  // useControls(
  //   "Monitors",
  //   {
  //     rmsGlobal: { value: rmsGlobal, editable: false },
  //     lowBand: { value: bands.low.smoothed, editable: false },
  //     midBand: { value: bands.mid.smoothed, editable: false },
  //     highBand: { value: bands.high.smoothed, editable: false },
  //     beatConf: { value: beat.confidence, editable: false },
  //   },
  //   [rmsGlobal, bands, beat]
  // );

  const {
    window: liveWindow,
    scale: dynamicScale,
    triggerIndex,
  } = useAudioWindow({
    source: "mic",
    windowSize: effectiveWindowSize,
    fftSize: 2048,
    triggerEnabled: true,
    triggerLevel: 0,
    triggerEdge: "rising",
    autoScale: autoGain,
    targetPeak: 0.9,
    scaleAlpha: 0.15,
  });

  const fallback = useMemo(() => createTestSignal("sine", 440, 0.1), []);
  const signalToDraw =
    figureType === "cube"
      ? cubeA
      : figureType === "text"
      ? textA
      : liveWindow.some((v) => v !== 0)
        ? liveWindow
        : fallback;

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
    figureType === "cube"
      ? cubeA
      : figureType === "text"
      ? textA
      : isStereoXY && leftXY.some((v) => v !== 0)
        ? leftXY
        : signalToDraw;
  const xySignalB =
    figureType === "cube"
      ? cubeB
      : figureType === "text"
      ? textB
      : isStereoXY && rightXY.some((v) => v !== 0)
        ? rightXY
        : secondarySignal;

  // Feature mapping
  const scaleMod = 1 + rmsGlobal * scaleGain;
  const rotateMod = bands.high.smoothed * rotateGain * Math.PI * 2;
  const thicknessMod = 0.03 + bands.mid.smoothed * thicknessGain * 0.02;
  const trailLengthMod = Math.floor(
    trailLength + bands.low.smoothed * trailBoost
  );
  const beatFlash = beat.isBeat ? 1.2 : 1;

  return (
    <CanvasContainer>
      <AudioFileUpload
        onFileSelect={handleFileUpload}
        currentFile={uploadedFile}
        show={figureType === "default" && audioSource === "file"}
      />
      <Leva collapsed />
      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={["#050805"]} />
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
          scale={mode === "xy" || figureType === "cube" || figureType === "text" ? scaleMod : 1}
        >
          {mode === "yt" ? (
            <Waveform
              signal={signalToDraw}
              width={8}
              height={6}
              amplitudeScale={
                (autoGain ? 1.5 * dynamicScale : manualGain) * beatFlash
              }
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
              scaleX={
                1.2 *
                (figureType === "cube" || figureType === "text" ? 1 : (isStereoXY ? xyScale : 1)) *
                beatFlash
              }
              scaleY={
                1.2 *
                (figureType === "cube" || figureType === "text" ? 1 : (isStereoXY ? xyScale : 1)) *
                beatFlash
              }
              color="#00ff00"
              mode={mode === "yt" ? "yt" : "xy"}
              speed={beamSpeed}
            />
          )}
        </group>

        {showPersistence && trailLengthMod > 0 && (
          <group position={[offsetX, offsetY, 0]}>
            <WaveformTrail
              signal={signalToDraw}
              signalB={mode === "xy" || figureType === "cube" || figureType === "text" ? xySignalB : undefined}
              mode={mode === "yt" ? "yt" : "xy"}
              trailLength={trailLengthMod}
              width={8}
              height={6}
              amplitudeScale={autoGain ? 1.5 * dynamicScale : manualGain}
              scaleX={
                1.2 *
                (figureType === "cube" || figureType === "text" ? 1 : (isStereoXY ? xyScale : 1)) *
                beatFlash
              }
              scaleY={
                1.2 *
                (figureType === "cube" || figureType === "text" ? 1 : (isStereoXY ? xyScale : 1)) *
                beatFlash
              }
              color="#00ff00"
              lineWidth={0.02}
            />
          </group>
        )}

        <EffectComposer>
          <Bloom
            intensity={bloomIntensity * (beat.isBeat ? 1.2 : 1)}
            luminanceThreshold={bloomThreshold}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
          <Noise opacity={0.05} />
        </EffectComposer>
      </Canvas>
    </CanvasContainer>
  );
};

export default R3FCanvas;
