import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { Leva, useControls, folder } from "leva";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";

import AudioTimeline from "../components/AudioTimeline";
import CRTScreen from "./components/CRTScreen.tsx";
import GridOverlay from "./components/GridOverlay.tsx";
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

import { CanvasContainer } from "../styles/ScopeControls.styled";

const SCREEN_WIDTH = 8;
const SCREEN_HEIGHT = 6;

const R3FCanvas = () => {
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
        options: { Default: "default", "3D Cube": "cube", "3D Text": "text" },
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
    "Animation (Radial)",
    {
      enableFormation: { value: true, label: "Enable Formation" },
      formationDelay: {
        value: 40,
        min: 0,
        max: 120,
        step: 1,
        label: "Start Delay (s)",
      },
      targetClones: {
        value: 5,
        min: 1,
        max: maxClonesLimit,
        step: 1,
        label: "Target Count",
      },
    },
    {
      collapsed: false,
      render: (get) => get("Animation Style.layoutMode") === "polygon",
    },
    [maxClonesLimit]
  );

  const { gridRows, gridCols } = useControls(
    "Animation (Grid)",
    {
      gridRows: {
        value: 2,
        min: 1,
        max: 5,
        step: 1,
        label: "Rows",
      },
      gridCols: {
        value: 3,
        min: 1,
        max: 5,
        step: 1,
        label: "Columns",
      },
    },
    {
      collapsed: false,
      render: (get) => get("Animation Style.layoutMode") === "grid",
    }
  );

  const { layoutMode } = useControls("Animation Style", {
    layoutMode: {
      options: { "Radial (Polygon)": "polygon", "Matrix (Grid)": "grid" },
      value: "polygon",
      label: "Formation Type",
    },
  });

  const { enableRotation, zDepth } = useControls("3D Volumetric", {
    enableRotation: { value: false, label: "Enable Rotation" },
    zDepth: { value: 0, min: 0, max: 20, step: 0.1, label: "Time Depth" },
  });

  // Ensure we don't exceed the limit even if the slider value is stale
  const effectiveTargetClones =
    layoutMode === "grid"
      ? gridRows * gridCols
      : Math.min(targetClones, maxClonesLimit);

  // Dynamic points count to ensure quality in grid mode
  // 2000 points total is not enough for multiple grid cells.
  // We'll allocate ~1000 points per clone/cell to ensure high resolution.
  const dynamicPointsCount = Math.max(2000, effectiveTargetClones * 1000);

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
  const { loadAudioFile, audioBuffer, context, seekTo, startTime, isPlaying, play, pause, stop, pausedAt } = useAudioInput({
    source: audioSource as "mic" | "file",
  });

  const handleFileUpload = (file: File) => {
    loadAudioFile(file);
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
    pointsCount: dynamicPointsCount,
    rotationSpeed: cubeRotationSpeed,
    cloneCount,
    layoutMode: layoutMode as "polygon" | "grid",
    gridRows,
    gridCols,
  });

  // Text Signal Generator
  const { signalA: textA, signalB: textB } = useTextSignal({
    active: figureType === "text",
    text: textInput,
    pointsCount: dynamicPointsCount,
    rotationSpeed: 0,
    cloneCount,
    layoutMode: layoutMode as "polygon" | "grid",
    gridRows,
    gridCols,
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,
  });

  // Speed Ramp Logic for Cube/Text Mode
  useEffect(() => {
    if (figureType === "cube" || figureType === "text") {
      let frameId: number;
      const startTime = performance.now();
      const duration = 30000; // 30 seconds ramp for smoother buildup

      const formationTimers: NodeJS.Timeout[] = [];

      // Formation Logic
      if (layoutMode === "grid") {
        // Grid Mode: Instant update, no animation reset
        // We set cloneCount directly to match the grid size
        setCloneCount(effectiveTargetClones);
      } else {
        // Polygon Mode: Formation animation
        // Reset clone state on mode change (deferred to avoid sync update warning)
        const resetTimer = setTimeout(() => setCloneCount(1), 0);
        formationTimers.push(resetTimer);

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
            formationTimers.push(
              setTimeout(
                () => clearInterval(interval),
                effectiveTargetClones * 2000 + 5000
              )
            ); // Safety clear
          }, formationDelay * 1000);
          formationTimers.push(startFormation);
        }
      }

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Target speed: Traverse full buffer (dynamic size) every frame
        // Base speed needs to scale with points count to maintain brightness/continuity
        const pointsBase = dynamicPointsCount;
        const targetSpeed = pointsBase * 60; // Traverse full buffer 60 times a second? No, once per frame (60fps)
        // Actually, speed is points per second.
        // To draw the whole shape once per frame: speed = pointsCount * 60.
        
        const startSpeed = 1000; 

        // Quartic ease-in: starts very slow, accelerates steeply at the end
        const ease = Math.pow(progress, 4);
        const current = startSpeed + (targetSpeed - startSpeed) * ease;

        setBeamSpeed(current);

        // Ramp rotation speed: Start static (0) and ramp to 1
        const rotationEase = Math.pow(progress, 3); 
        setCubeRotationSpeed(rotationEase);

        if (progress < 1) {
          frameId = requestAnimationFrame(animate);
        }
      };

      // Start animation loop
      frameId = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(frameId);
        formationTimers.forEach((t) => clearTimeout(t));
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
  }, [figureType, enableFormation, formationDelay, effectiveTargetClones, layoutMode, dynamicPointsCount]);

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
      <AudioTimeline
        audioBuffer={audioBuffer}
        context={context}
        startTime={startTime}
        pausedAt={pausedAt}
        isPlaying={isPlaying}
        onSeek={seekTo}
        onFileUpload={handleFileUpload}
        onPlay={play}
        onPause={pause}
        onStop={stop}
      />
      <Leva collapsed />
      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={["#050805"]} />
        <SceneSetup enableRotation={enableRotation} />
        <CRTScreen width={SCREEN_WIDTH} height={SCREEN_HEIGHT} />

        <GridOverlay
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          divisions={{ horizontal: 8, vertical: 10 }}
          color="#00ff00"
          opacity={0.4}
        />

        <group
          position={[offsetX, offsetY, 0]}
          rotation={[0, 0, mode === "xy" && figureType === "default" ? rotateMod : 0]}
          scale={
            mode === "xy" && figureType === "default"
              ? scaleMod
              : 1
          }
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
                (figureType === "text" ? 1 : 1.2) *
                (figureType === "cube" || figureType === "text"
                  ? 1
                  : isStereoXY
                    ? xyScale
                    : 1) *
                (figureType === "default" ? beatFlash : 1)
              }
              scaleY={
                (figureType === "text" ? 1 : 1.2) *
                (figureType === "cube" || figureType === "text"
                  ? 1
                  : isStereoXY
                    ? xyScale
                    : 1) *
                (figureType === "default" ? beatFlash : 1)
              }
              color="#00ff00"
              mode={mode === "yt" ? "yt" : "xy"}
              speed={beamSpeed}
              zDepth={zDepth}
            />
          )}
        </group>

        {showPersistence && trailLengthMod > 0 && (
          <group position={[offsetX, offsetY, 0]}>
            <WaveformTrail
              signal={signalToDraw}
              signalB={
                mode === "xy" || figureType === "cube" || figureType === "text"
                  ? xySignalB
                  : undefined
              }
              mode={mode === "yt" ? "yt" : "xy"}
              trailLength={trailLengthMod}
              width={8}
              height={6}
              amplitudeScale={autoGain ? 1.5 * dynamicScale : manualGain}
              scaleX={
                (figureType === "text" ? 1 : 1.2) *
                (figureType === "cube" || figureType === "text"
                  ? 1
                  : isStereoXY
                    ? xyScale
                    : 1) *
                (figureType === "default" ? beatFlash : 1)
              }
              scaleY={
                (figureType === "text" ? 1 : 1.2) *
                (figureType === "cube" || figureType === "text"
                  ? 1
                  : isStereoXY
                    ? xyScale
                    : 1) *
                (figureType === "default" ? beatFlash : 1)
              }
              color="#00ff00"
              lineWidth={0.02}
            />
          </group>
        )}

        <EffectComposer>
          <Bloom
            intensity={bloomIntensity * (beat.isBeat && figureType === "default" ? 1.2 : 1)}
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
