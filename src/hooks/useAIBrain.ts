import { useState, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface BrainProfile {
  mood: string;
  complexity_preference: number;
  pace: string;
  color_bias: string;
  preferred_modes: string[];
  description: string;
  suggested_words?: string[];
  suggested_attractors?: string[];
}

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

interface BrainState {
  currentFigure: string;
  targetRotationSpeed: number;
  currentRotationSpeed: number;
  distortionLevel: number;
  bloomIntensity: number;
  color: string;
  cameraZoom: number;
  // New "Analog" Physics Parameters
  analogWarmth: number; // 0.0 (Digital/Perfect) to 1.0 (Noisy/Organic)
  beamFocus: number;    // 0.0 (Sharp) to 1.0 (Soft/Blurry)
  syncStability: number; // 1.0 (Locked) to 0.0 (Glitching)
  
  // Generator Parameters (AI Decisions)
  attractorType: "lorenz" | "rossler" | "aizawa";
  textString: string;
  layoutMode: "polygon" | "grid";
  cloneCount: number;
  mode: "yt" | "xy";
  beamSpeed: number;
  targetScale: number; // To fix clipping
}

const DEFAULT_PROFILE: BrainProfile = {
  mood: "neutral",
  complexity_preference: 0.5,
  pace: "medium",
  color_bias: "green_default",
  preferred_modes: ["cube", "brain", "default", "chaos", "text", "planet", "eye"], // Expanded pool
  description: "Default neutral profile",
  suggested_words: ["AI", "ALIVE", "PULSE", "SIGNAL", "NOISE", "ECHO", "VOID", "NEXUS", "DREAM", "WAKE"],
  suggested_attractors: ["lorenz", "rossler", "aizawa"]
};

export const useAIBrain = (
  profile: BrainProfile | null,
  audioFeatures: AudioFeatures
) => {
  const activeProfile = profile || DEFAULT_PROFILE;
  
  // State that drives the visuals
  const [brainState, setBrainState] = useState<BrainState>({
    currentFigure: "cube",
    targetRotationSpeed: 0,
    currentRotationSpeed: 0,
    distortionLevel: 0,
    bloomIntensity: 1.5,
    color: "#00ff00",
    cameraZoom: 12,
    analogWarmth: 0.2,
    beamFocus: 0.1,
    syncStability: 1.0,
    attractorType: "lorenz",
    textString: "AI",
    layoutMode: "polygon",
    cloneCount: 1,
    mode: "xy",
    beamSpeed: 1000,
    targetScale: 1.0,
  });

  // Internal memory for the "Brain"
  const memoryRef = useRef({
    lastModeChange: 0,
    modeHistory: [] as string[],
    energyHistory: [] as number[],
    timeSinceLastBeat: 0,
    currentModeIndex: 0,
    isGlitching: false,
  });

  // Refs for smooth interpolation (avoiding React state updates every frame for these)
  const smoothValues = useRef({
    rotation: 0,
    distortion: 0,
    zoom: 12,
    warmth: 0.2,
    focus: 0.1,
    stability: 1.0,
  });

  // --- DECISION ENGINE (Runs less frequently, e.g., on beats or intervals) ---
  useEffect(() => {
    if (!activeProfile) return;

    const now = Date.now();
    const mem = memoryRef.current;
    const { beat, rmsGlobal } = audioFeatures;

    // 1. Mode Switching Logic
    // Don't switch too fast, unless "frenetic"
    const minDuration = activeProfile.pace === "frenetic" ? 2000 : 
                        activeProfile.pace === "fast" ? 5000 : 
                        activeProfile.pace === "slow" ? 15000 : 8000;

    const timeSinceChange = now - mem.lastModeChange;
    
    // Trigger a change if: Time elapsed AND (Big Drop OR Random Chance on Beat)
    const isDrop = beat.isBeat && beat.confidence > 0.8 && rmsGlobal > 0.5;
    // Use complexity preference to determine switch frequency, but keep it deterministic if possible
    // We use a counter-based approach instead of pure random to respect the "AI plan"
    const shouldSwitch = timeSinceChange > minDuration && (isDrop || (now - mem.lastModeChange > minDuration * 1.5));

    const preferredModes = activeProfile.preferred_modes && activeProfile.preferred_modes.length > 0 
      ? activeProfile.preferred_modes 
      : ["cube", "default", "chaos", "text"]; // Fallback includes more variety

    if (shouldSwitch) {
      // Cycle through the AI's preferred modes sequentially
      // This respects the AI's "curation" rather than random selection
      const nextIndex = (mem.currentModeIndex + 1) % preferredModes.length;
      
      const nextMode = preferredModes[nextIndex];
      mem.currentModeIndex = nextIndex;
      mem.lastModeChange = now;
      
      // Trigger Glitch Transition
      mem.isGlitching = true;
      setTimeout(() => { mem.isGlitching = false; }, 400); // 400ms glitch

      // Decide new parameters based on Profile Suggestions
      const attractors = activeProfile.suggested_attractors || ["lorenz", "rossler", "aizawa"];
      const nextAttractor = attractors[nextIndex % attractors.length] as "lorenz" | "rossler" | "aizawa";
      
      const words = activeProfile.suggested_words || ["AI"];
      const nextWord = words[nextIndex % words.length];
      
      // Layout decisions can be mapped to complexity
      // High complexity = Grid, Low = Polygon
      const nextLayout = activeProfile.complexity_preference > 0.6 && (nextIndex % 2 === 0) ? "grid" : "polygon";
      
      // Clone count based on complexity
      let nextClones = mem.isGlitching ? 1 : brainState.cloneCount;
      if (nextLayout === "grid") nextClones = 6;
      else nextClones = Math.max(1, Math.floor(activeProfile.complexity_preference * 4));

      // View mode: 3D figures prefer XY, Waveforms prefer YT
      // But we can mix it up based on "pace"
      const nextViewMode = (nextMode === "default" || nextMode === "brain") && activeProfile.pace === "slow" ? "yt" : "xy";
      
      const nextBeamSpeed = activeProfile.pace === "frenetic" ? 2000 : 
                            activeProfile.pace === "fast" ? 1500 : 
                            activeProfile.pace === "slow" ? 500 : 1000;

      // Scale Logic to prevent clipping
      let nextScale = 1.0;
      if (nextMode === "cube") nextScale = 0.8;
      if (nextMode === "brain") nextScale = 0.7;
      if (nextMode === "planet") nextScale = 0.6;
      if (nextMode === "text") nextScale = 0.5; // Text is wide
      if (nextMode === "chaos") nextScale = 0.9;

      setTimeout(() => {
        setBrainState(prev => {
          // if (prev.currentFigure === nextMode) return prev; // Allow re-rolling params even if mode is same
          return { 
              ...prev, 
              currentFigure: nextMode,
              attractorType: nextAttractor,
              textString: nextWord,
              layoutMode: nextLayout,
              cloneCount: nextClones,
              mode: nextViewMode,
              beamSpeed: nextBeamSpeed,
              targetScale: nextScale
          };
        });
      }, 0);
      console.log(`[AI Brain] Switching to ${nextMode} (${activeProfile.mood})`);
    }

    // 2. Color Logic
    let targetColor = "#00ff00"; // Default Phosphor
    if (activeProfile.color_bias === "red_shift") {
        // Low energy = dark red, High energy = bright orange/yellow
        targetColor = rmsGlobal > 0.6 ? "#ffaa00" : "#ff0000";
    } else if (activeProfile.color_bias === "blue_cool") {
        targetColor = "#00ffff";
    } else if (activeProfile.color_bias === "neon_mix") {
        targetColor = beat.isBeat ? "#ff00ff" : "#00ffff";
    }
    
    // Update state (throttled by useEffect dependencies)
    setTimeout(() => {
      setBrainState(prev => {
        if (prev.color === targetColor) return prev;
        return { ...prev, color: targetColor };
      });
    }, 0);

  }, [activeProfile, audioFeatures, brainState.cloneCount]); // Run on beat or significant energy change


  // --- REAL-TIME PHYSICS (Runs every frame) ---
  useFrame((_state, delta) => {
    const { rmsGlobal, bands } = audioFeatures;
    const mem = memoryRef.current;

    // 1. Rotation Speed Calculation
    // Only rotate 3D objects
    const is3D = ["cube", "planet", "brain", "eye", "chaos"].includes(brainState.currentFigure);
    
    // Base speed from profile + Energy boost
    let baseSpeed = activeProfile.pace === "fast" ? 0.5 : 0.2;
    if (activeProfile.pace === "frenetic") baseSpeed = 1.0;
    
    // React to High Mids (Vocals/Snares) for rotation
    const energyFactor = bands.mid.smoothed * 2 + bands.high.smoothed;
    let targetRot = baseSpeed + (energyFactor * activeProfile.complexity_preference);

    if (!is3D) targetRot = 0; // Stop rotation for 2D/Text/Default

    // Smooth interpolation (Lerp)
    smoothValues.current.rotation = THREE.MathUtils.lerp(smoothValues.current.rotation, targetRot, delta * 2);

    // 2. Distortion / Noise
    // Bass drives distortion
    const bassImpact = bands.low.smoothed;
    let targetDistortion = bassImpact * activeProfile.complexity_preference;
    
    // "Calm" mood suppresses distortion
    if (activeProfile.mood === "calm") targetDistortion *= 0.2;
    
    smoothValues.current.distortion = THREE.MathUtils.lerp(smoothValues.current.distortion, targetDistortion, delta * 5);

    // 3. Camera Zoom (Breathing effect)
    // Zoom in on high energy
    const targetZoom = 12 - (rmsGlobal * 4); 
    smoothValues.current.zoom = THREE.MathUtils.lerp(smoothValues.current.zoom, targetZoom, delta * 1);

    // 4. Analog Physics (Warmth, Focus, Stability)
    // Warmth: Increases with complexity and low-mids (muddy sound = muddy visual)
    let targetWarmth = activeProfile.mood === "organic" || activeProfile.mood === "retro" ? 0.6 : 0.1;
    targetWarmth += bands.low.smoothed * 0.3;
    smoothValues.current.warmth = THREE.MathUtils.lerp(smoothValues.current.warmth, targetWarmth, delta * 1);

    // Focus: High energy = sharper focus (usually). Calm = softer.
    let targetFocus = activeProfile.mood === "digital" ? 0.05 : 0.4; // 0 is sharp
    if (rmsGlobal > 0.8) targetFocus = 0.02; // Sharp on peaks
    smoothValues.current.focus = THREE.MathUtils.lerp(smoothValues.current.focus, targetFocus, delta * 3);

    // Stability: Glitch on mode change or very high complexity
    let targetStability = mem.isGlitching ? 0.2 : 1.0;
    if (activeProfile.complexity_preference > 0.8 && Math.random() > 0.95) targetStability = 0.8; // Random micro-glitches
    smoothValues.current.stability = THREE.MathUtils.lerp(smoothValues.current.stability, targetStability, delta * 10); // Fast recovery

    // Update refs for consumption (we don't set state here to avoid re-renders)
    // We will return these refs or a getter function
  });

  return {
    brainState, // Stable state (mode, color theme)
    getRealtimeValues: () => smoothValues.current, // High frequency values (rotation, distortion)
  };
};
