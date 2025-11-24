import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useState, useRef } from "react";
import * as THREE from "three";
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
import usePlanetSignal from "../../hooks/usePlanetSignal";
import useChaosSignal from "../../hooks/useChaosSignal";
import useBrainSignal from "../../hooks/useBrainSignal";
import useEyeSignal from "../../hooks/useEyeSignal";
import { useAIBrain, type BrainProfile } from "../../hooks/useAIBrain";

import { createTestSignal } from "../../utils/signalGenerator";

import {
  CanvasContainer,
  ModalOverlay,
  ModalContent,
  ModalTitle,
  TextArea,
  ButtonGroup,
  Button,
  LoaderContainer,
  Spinner,
} from "../styles/ScopeControls.styled";

const SCREEN_WIDTH = 8;
const SCREEN_HEIGHT = 6;

interface AudioFeatures {
  rmsGlobal: number;
  bands: {
    low: { smoothed: number };
    mid: { smoothed: number };
    high: { smoothed: number };
  };
  beat: {
    isBeat: boolean;
    confidence: number;
  };
}

interface PhysicsState {
  warmth: number;
  stability: number;
  focus: number;
}

// Inner component to handle AI Brain logic inside Canvas context
const AIDirector = ({
  analysis,
  audioFeatures,
  setFigureType,
  setAttractorType,
  setTextInput,
  setLayoutMode,
  setTargetClones,
  setMode,
  setBeamSpeed,
  groupRef,
  physicsRef,
}: {
  analysis: BrainProfile;
  audioFeatures: AudioFeatures;
  setFigureType: (type: string) => void;
  setAttractorType: (type: string) => void;
  setTextInput: (text: string) => void;
  setLayoutMode: (mode: string) => void;
  setTargetClones: (count: number) => void;
  setMode: (mode: string) => void;
  setBeamSpeed: (speed: number) => void;
  groupRef: React.MutableRefObject<THREE.Group | null>;
  physicsRef: React.MutableRefObject<PhysicsState>;
}) => {
  const { brainState, getRealtimeValues } = useAIBrain(analysis, audioFeatures);

  // 1. Sync "Slow" State (Modes, Colors, Generator Params)
  useEffect(() => {
    if (brainState.currentFigure) setFigureType(brainState.currentFigure);
    if (brainState.attractorType) setAttractorType(brainState.attractorType);
    if (brainState.textString) setTextInput(brainState.textString);
    if (brainState.layoutMode) setLayoutMode(brainState.layoutMode);
    if (brainState.cloneCount) setTargetClones(brainState.cloneCount);
    if (brainState.mode) setMode(brainState.mode);
    if (brainState.beamSpeed) setBeamSpeed(brainState.beamSpeed);

    // Note: Color syncing would go here if we exposed setGroupColor
  }, [
    brainState,
    setFigureType,
    setAttractorType,
    setTextInput,
    setLayoutMode,
    setTargetClones,
    setMode,
    setBeamSpeed,
  ]);

  // 2. Sync "Fast" Physics (Rotation, Distortion)
  useFrame(() => {
    const values = getRealtimeValues();

    // Sync to shared ref for other components
    if (physicsRef.current) {
      physicsRef.current.warmth = values.warmth;
      physicsRef.current.focus = values.focus;
      physicsRef.current.stability = values.stability;
    }

    // Apply rotation directly to the group ref for performance
    if (groupRef.current) {
      const is3D = ["cube", "planet", "brain", "eye", "chaos"].includes(
        brainState.currentFigure
      );

      if (is3D) {
        // Rotate X and Y for 3D feel
        groupRef.current.rotation.y += values.rotation * 0.01;
        groupRef.current.rotation.x += values.rotation * 0.005;
      } else {
        // Reset rotation for 2D figures (Text, Waveform) to ensure visibility
        // Smoothly interpolate back to 0 to avoid snapping
        groupRef.current.rotation.y *= 0.9;
        groupRef.current.rotation.x *= 0.9;
        if (Math.abs(groupRef.current.rotation.y) < 0.001)
          groupRef.current.rotation.y = 0;
        if (Math.abs(groupRef.current.rotation.x) < 0.001)
          groupRef.current.rotation.x = 0;
      }

      // Apply zoom/scale breathing
      // Base scale from AI brain (default 1 if undefined)
      const baseScale = brainState.targetScale || 1;
      const breathing = 1 + (values.zoom - 12) * 0.05;
      groupRef.current.scale.setScalar(baseScale * breathing);
    }
  });

  return null;
};

const DynamicEffects = ({
  physicsRef,
  beat,
}: {
  physicsRef: React.MutableRefObject<PhysicsState>;
  beat: AudioFeatures["beat"];
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bloomRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noiseRef = useRef<any>(null);

  useFrame(() => {
    if (!physicsRef.current) return;
    const { focus, warmth } = physicsRef.current;

    if (bloomRef.current) {
      const baseIntensity = 1.5 + focus * 3.0;
      const beatMult = beat.isBeat ? 1.5 : 1.0;
      // Smooth lerp for intensity to avoid flickering
      bloomRef.current.intensity = THREE.MathUtils.lerp(
        bloomRef.current.intensity,
        baseIntensity * beatMult,
        0.1
      );
      bloomRef.current.luminanceThreshold = 0.1 - focus * 0.08;
    }

    if (noiseRef.current) {
      noiseRef.current.opacity = 0.02 + warmth * 0.13;
    }
  });

  return (
    <EffectComposer>
      <Bloom ref={bloomRef} luminanceSmoothing={0.9} mipmapBlur />
      <Vignette eskil={false} offset={0.1} darkness={1.1} />
      <Noise ref={noiseRef} opacity={0.05} />
    </EffectComposer>
  );
};

const R3FCanvas = () => {
  const [beamSpeed, setBeamSpeed] = useState(1000);
  const [cloneCount, setCloneCount] = useState(1);
  const groupRef = useRef<THREE.Group>(null);
  const physicsRef = useRef<PhysicsState>({
    warmth: 0,
    stability: 1,
    focus: 0,
  });

  // AI State
  const [aiFigure, setAiFigure] = useState<string | null>(null);
  const [attractorType, setAttractorType] = useState("lorenz");
  const [textInput, setTextInput] = useState("AI");
  const [layoutMode, setLayoutMode] = useState("polygon");
  const [targetClones, setTargetClones] = useState(1);
  const [mode, setMode] = useState("xy"); // Default to XY
  const [audioSource] = useState("mic");

  // Analysis Modal State
  const [showModal, setShowModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [promptInput, setPromptInput] = useState("");

  // Removed Leva useControls
  const figureType = aiFigure || "cube"; // Default to cube if no AI

  // Hardcoded animation settings (controlled by AI via targetClones/layoutMode)
  const enableFormation = true;
  const formationDelay = 0;
  const gridRows = 2; // Default, AI can override if we add it to BrainState
  const gridCols = 3;
  const enableRotation = false;
  const zDepth = 0;

  // Centralized audio input management (mic/file)
  const {
    loadAudioFile,
    audioBuffer,
    context,
    seekTo,
    startTime,
    isPlaying,
    play,
    pause,
    stop,
    pausedAt,
    analysis,
    isAnalyzing,
    analyzeAudio,
  } = useAudioInput({
    source: audioSource as "mic" | "file",
  });

  const handleFileUpload = (file: File) => {
    console.log("File uploaded:", file.name);
    setPendingFile(file);
    setPromptInput(""); // Reset prompt
    setShowModal(true);
    loadAudioFile(file); // Pre-load buffer (but don't play yet)
  };

  const handleStartAnalysis = () => {
    if (pendingFile) {
      setShowModal(false);
      analyzeAudio(pendingFile, promptInput);
    }
  };

  const handleCancelAnalysis = () => {
    setShowModal(false);
    setPendingFile(null);
    stop(); // Stop any pre-loaded audio
  };

  // Determine effective figure type (AI overrides manual if analysis is present)
  const effectiveFigureType = analysis && aiFigure ? aiFigure : figureType;

  // Calculate dynamic max clones based on text length
  const maxClonesLimit = useMemo(() => {
    if (
      effectiveFigureType === "cube" ||
      effectiveFigureType === "planet" ||
      effectiveFigureType === "chaos" ||
      effectiveFigureType === "brain" ||
      effectiveFigureType === "eye"
    )
      return 8;
    // Use the actual text length that will be rendered (substring 0, 12)
    const effectiveText = textInput.substring(0, 12);
    const len = effectiveText.length || 1;
    // Heuristic: 12 chars -> 5 clones (60/12).
    return Math.max(1, Math.min(8, Math.floor(60 / len)));
  }, [effectiveFigureType, textInput]);

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

  // Audio features for visual mapping
  const { rmsGlobal, bands, beat } = useAudioFeatures({
    fftSize: 2048,
    source: "mic", // Features always come from mic/shared context for now
    updateIntervalMs: 16, // ~60fps analysis for smoother reaction
    smoothingAlpha: 0.15,
    beatThreshold: 1.4,
    beatCooldownMs: 120,
  });

  // Cube Signal Generator
  const { signalA: cubeA, signalB: cubeB } = useCubeSignal({
    active: effectiveFigureType === "cube",
    pointsCount: dynamicPointsCount,
    rotationSpeed: 0,
    cloneCount,
    layoutMode: layoutMode as "polygon" | "grid",
    gridRows,
    gridCols,
  });

  // Text Signal Generator
  const { signalA: textA, signalB: textB } = useTextSignal({
    active: effectiveFigureType === "text",
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

  // Planet Signal Generator
  const { signalA: planetA, signalB: planetB } = usePlanetSignal({
    active: effectiveFigureType === "planet",
    pointsCount: dynamicPointsCount,
    rotationSpeed: 0,
    cloneCount,
    layoutMode: layoutMode as "polygon" | "grid",
    gridRows,
    gridCols,
  });

  // Chaos Signal Generator
  const { signalA: chaosA, signalB: chaosB } = useChaosSignal({
    active: effectiveFigureType === "chaos",
    pointsCount: dynamicPointsCount,
    rotationSpeed: 0,
    cloneCount,
    layoutMode: layoutMode as "polygon" | "grid",
    gridRows,
    gridCols,
    attractorType: attractorType as "lorenz" | "rossler" | "aizawa",
  });

  // Brain Signal Generator
  const { signalA: brainA, signalB: brainB } = useBrainSignal({
    active: effectiveFigureType === "brain",
    pointsCount: dynamicPointsCount,
    rotationSpeed: 0,
    cloneCount,
    layoutMode: layoutMode as "polygon" | "grid",
    gridRows,
    gridCols,
  });

  // Eye Signal Generator
  const { signalA: eyeA, signalB: eyeB } = useEyeSignal({
    active: effectiveFigureType === "eye",
    pointsCount: dynamicPointsCount,
    cloneCount,
    layoutMode: layoutMode as "polygon" | "grid",
    gridRows,
    gridCols,
  });

  // Speed Ramp Logic for Cube/Text Mode
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (
      effectiveFigureType === "cube" ||
      effectiveFigureType === "text" ||
      effectiveFigureType === "planet" ||
      effectiveFigureType === "chaos" ||
      effectiveFigureType === "brain" ||
      effectiveFigureType === "eye"
    ) {
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
            let direction = 1; // 1 = expanding, -1 = contracting
            let holdCounter = 0;
            const HOLD_CYCLES = 2; // Wait extra cycles at the top

            const interval = setInterval(() => {
              if (effectiveTargetClones <= 1) return;

              if (direction === 1) {
                if (count < effectiveTargetClones) {
                  count++;
                } else {
                  // We reached the top, hold for a bit
                  if (holdCounter < HOLD_CYCLES) {
                    holdCounter++;
                  } else {
                    holdCounter = 0;
                    direction = -1;
                    count--;
                  }
                }
              } else {
                if (count > 1) {
                  count--;
                } else {
                  direction = 1;
                  count++;
                }
              }
              setCloneCount(count);
            }, 2000); // Update every 2 seconds

            formationTimers.push(interval);
          }, formationDelay * 1000);
          formationTimers.push(startFormation);
        }
      }

      // Target speed: Traverse full buffer (dynamic size) every frame
      // Base speed needs to scale with points count to maintain brightness/continuity
      const pointsBase = dynamicPointsCount;
      const targetSpeed = pointsBase * 60; // Traverse full buffer 60 times a second? No, once per frame (60fps)
      // Actually, speed is points per second.
      // To draw the whole shape once per frame: speed = pointsCount * 60.

      if (isFirstRender.current) {
        const animate = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          const startSpeed = 1000;

          // Quartic ease-in: starts very slow, accelerates steeply at the end
          const ease = Math.pow(progress, 4);
          const current = startSpeed + (targetSpeed - startSpeed) * ease;

          setBeamSpeed(current);

          if (progress < 1) {
            frameId = requestAnimationFrame(animate);
          }
        };

        // Start animation loop
        frameId = requestAnimationFrame(animate);
      } else {
        // Instant speed update for subsequent mode changes
        setBeamSpeed(targetSpeed);
      }

      return () => {
        if (frameId) cancelAnimationFrame(frameId);
        formationTimers.forEach((t) => clearTimeout(t));
        // Mark first render as done when we exit this effect (change mode)
        isFirstRender.current = false;
      };
    } else {
      // Defer state update to avoid synchronous effect warning
      const timeoutId = setTimeout(() => {
        setBeamSpeed(1000);
        setCloneCount(1);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [
    effectiveFigureType,
    enableFormation,
    formationDelay,
    effectiveTargetClones,
    layoutMode,
    dynamicPointsCount,
  ]);

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
    effectiveFigureType === "cube"
      ? cubeA
      : effectiveFigureType === "text"
        ? textA
        : effectiveFigureType === "planet"
          ? planetA
          : effectiveFigureType === "chaos"
            ? chaosA
            : effectiveFigureType === "brain"
              ? brainA
              : effectiveFigureType === "eye"
                ? eyeA
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
    effectiveFigureType === "cube"
      ? cubeA
      : effectiveFigureType === "text"
        ? textA
        : effectiveFigureType === "planet"
          ? planetA
          : effectiveFigureType === "chaos"
            ? chaosA
            : effectiveFigureType === "brain"
              ? brainA
              : effectiveFigureType === "eye"
                ? eyeA
                : isStereoXY && leftXY.some((v) => v !== 0)
                  ? leftXY
                  : signalToDraw;
  const xySignalB =
    effectiveFigureType === "cube"
      ? cubeB
      : effectiveFigureType === "text"
        ? textB
        : effectiveFigureType === "planet"
          ? planetB
          : effectiveFigureType === "chaos"
            ? chaosB
            : effectiveFigureType === "brain"
              ? brainB
              : effectiveFigureType === "eye"
                ? eyeB
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

        {/* AI Director */}
        {analysis && (
          <AIDirector
            analysis={analysis}
            audioFeatures={{ rmsGlobal, bands, beat }}
            setFigureType={setAiFigure}
            setAttractorType={setAttractorType}
            setTextInput={setTextInput}
            setLayoutMode={setLayoutMode}
            setTargetClones={setTargetClones}
            setMode={setMode}
            setBeamSpeed={setBeamSpeed}
            groupRef={groupRef}
            physicsRef={physicsRef}
          />
        )}

        <group
          ref={groupRef}
          position={[offsetX, offsetY, 0]}
          rotation={[
            0,
            0,
            mode === "xy" && effectiveFigureType === "default" ? rotateMod : 0,
          ]}
          scale={
            mode === "xy" && effectiveFigureType === "default" ? scaleMod : 1
          }
        >
          {mode === "yt" ? (
            <Waveform
              signal={signalToDraw}
              width={8}
              height={6}
              physicsRef={physicsRef}
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
              physicsRef={physicsRef}
              scaleX={
                (effectiveFigureType === "text" ||
                effectiveFigureType === "chaos" ||
                effectiveFigureType === "brain" ||
                effectiveFigureType === "eye"
                  ? 1
                  : 1.2) *
                (effectiveFigureType === "cube" ||
                effectiveFigureType === "text" ||
                effectiveFigureType === "planet" ||
                effectiveFigureType === "chaos" ||
                effectiveFigureType === "brain" ||
                effectiveFigureType === "eye"
                  ? 1
                  : isStereoXY
                    ? xyScale
                    : 1) *
                (effectiveFigureType === "default" ? beatFlash : 1)
              }
              scaleY={
                (effectiveFigureType === "text" ||
                effectiveFigureType === "chaos" ||
                effectiveFigureType === "brain" ||
                effectiveFigureType === "eye"
                  ? 1
                  : 1.2) *
                (effectiveFigureType === "cube" ||
                effectiveFigureType === "text" ||
                effectiveFigureType === "planet" ||
                effectiveFigureType === "chaos" ||
                effectiveFigureType === "brain" ||
                effectiveFigureType === "eye"
                  ? 1
                  : isStereoXY
                    ? xyScale
                    : 1) *
                (effectiveFigureType === "default" ? beatFlash : 1)
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
                mode === "xy" ||
                effectiveFigureType === "cube" ||
                effectiveFigureType === "text" ||
                effectiveFigureType === "planet" ||
                effectiveFigureType === "chaos" ||
                effectiveFigureType === "brain" ||
                effectiveFigureType === "eye"
                  ? xySignalB
                  : undefined
              }
              mode={mode === "yt" ? "yt" : "xy"}
              trailLength={trailLengthMod}
              width={8}
              height={6}
              amplitudeScale={autoGain ? 1.5 * dynamicScale : manualGain}
              scaleX={
                (effectiveFigureType === "text" ||
                effectiveFigureType === "chaos" ||
                effectiveFigureType === "brain" ||
                effectiveFigureType === "eye"
                  ? 1
                  : 1.2) *
                (effectiveFigureType === "cube" ||
                effectiveFigureType === "text" ||
                effectiveFigureType === "planet" ||
                effectiveFigureType === "chaos" ||
                effectiveFigureType === "brain" ||
                effectiveFigureType === "eye"
                  ? 1
                  : isStereoXY
                    ? xyScale
                    : 1) *
                (effectiveFigureType === "default" ? beatFlash : 1)
              }
              scaleY={
                (effectiveFigureType === "text" ||
                effectiveFigureType === "chaos" ||
                effectiveFigureType === "brain" ||
                effectiveFigureType === "eye"
                  ? 1
                  : 1.2) *
                (effectiveFigureType === "cube" ||
                effectiveFigureType === "text" ||
                effectiveFigureType === "planet" ||
                effectiveFigureType === "chaos" ||
                effectiveFigureType === "brain" ||
                effectiveFigureType === "eye"
                  ? 1
                  : isStereoXY
                    ? xyScale
                    : 1) *
                (effectiveFigureType === "default" ? beatFlash : 1)
              }
              color="#00ff00"
              lineWidth={0.02}
            />
          </group>
        )}

        <DynamicEffects physicsRef={physicsRef} beat={beat} />
      </Canvas>

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

      {/* Analysis Modal */}
      {showModal && (
        <ModalOverlay>
          <ModalContent>
            <ModalTitle>AI Context Analysis</ModalTitle>
            <div style={{ color: "#00ff00", fontSize: "12px", opacity: 0.8 }}>
              Provide context for the AI to analyze the emotional
              characteristics of this track.
            </div>
            <TextArea
              placeholder="e.g. This is a melancholic jazz track about lost love..."
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              autoFocus
            />
            <ButtonGroup>
              <Button onClick={handleCancelAnalysis}>Cancel</Button>
              <Button variant="primary" onClick={handleStartAnalysis}>
                Analyze & Play
              </Button>
            </ButtonGroup>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <ModalOverlay>
          <LoaderContainer>
            <Spinner />
            <div>Analyzing Audio Context...</div>
          </LoaderContainer>
        </ModalOverlay>
      )}
    </CanvasContainer>
  );
};

export default R3FCanvas;
