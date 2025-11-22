import { useEffect, useRef, useState } from "react";
import { getSharedAudioContext } from "../utils/sharedAudioContext";

export interface UseAudioWindowOptions {
  /** Size of analyser FFT (power of two). Determines internal buffer size. */
  fftSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384;
  /** Number of samples to expose as the visible time window */
  windowSize?: number;
  /** Source: 'mic' uses getUserMedia, 'osc' uses internal oscillator */
  source?: "mic" | "osc";
  /** Frequency for oscillator fallback */
  frequency?: number;
  /** Update interval in ms (avoid 60fps React re-renders) */
  updateIntervalMs?: number;
  /** Enable simple rising-edge trigger alignment */
  triggerEnabled?: boolean;
  /** Trigger level to detect crossing (default 0) */
  triggerLevel?: number;
  /** Trigger edge type */
  triggerEdge?: "rising" | "falling";
  /** Enable dynamic auto-scale based on peak amplitude */
  autoScale?: boolean;
  /** Target visual peak after scaling (e.g. 0.9 of vertical space) */
  targetPeak?: number;
  /** Exponential smoothing factor for scale (0..1) */
  scaleAlpha?: number;
}

/**
 * useAudioWindow: Captures a rolling time-domain slice (time window) of an audio signal.
 * Concept:
 *   - The audio stream delivers samples continuously at sampleRate (e.g. 44100 Hz).
 *   - We only draw a small window (e.g. 1024 samples) per frame to visualize evolution.
 *   - Each update replaces the window buffer with the latest segment from the analyser.
 */
const useAudioWindow = ({
  fftSize = 2048,
  windowSize = 1024,
  source = "mic",
  frequency = 440,
  updateIntervalMs = 33, // ~30fps render updates
  triggerEnabled = false,
  triggerLevel = 0,
  triggerEdge = "rising",
  autoScale = false,
  targetPeak = 0.9,
  scaleAlpha = 0.2,
}: UseAudioWindowOptions = {}) => {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Float32Array>(new Float32Array(windowSize));
  const [windowBuf, setWindowBuf] = useState<Float32Array>(
    () => new Float32Array(windowSize)
  );
  const scaleRef = useRef<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [triggerIndex, setTriggerIndex] = useState<number>(0);
  const [sampleRate, setSampleRate] = useState<number>(44100);
  // Removed requestAnimationFrame usage; we rely on interval updates for controlled re-render frequency.
  const intervalRef = useRef<number | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    const { context: ctx, analyser } = getSharedAudioContext();
    analyserRef.current = analyser;
    // sampleRate stable for AudioContext lifetime; direct assign to state via microtask to avoid synchronous setState warning
    Promise.resolve().then(() => setSampleRate(ctx.sampleRate));

    // Don't connect sources here - useAudioInput handles all source connections
    // This hook only reads from the shared analyser

    // Periodic update without forcing 60 re-renders
    intervalRef.current = window.setInterval(() => {
      if (!analyserRef.current) return;
      const temp = new Float32Array(analyserRef.current.fftSize);
      analyserRef.current.getFloatTimeDomainData(temp);
      // Latest window slice
      const sliceStart = Math.max(0, temp.length - windowSize);
      const slice = temp.subarray(sliceStart, sliceStart + windowSize);

      let aligned: Float32Array;
      let foundTrigger = 0;
      if (triggerEnabled) {
        // Find trigger index
        let idx = 0;
        for (let i = 1; i < slice.length; i++) {
          if (triggerEdge === "rising") {
            if (slice[i - 1] < triggerLevel && slice[i] >= triggerLevel) {
              idx = i;
              break;
            }
          } else {
            if (slice[i - 1] > triggerLevel && slice[i] <= triggerLevel) {
              idx = i;
              break;
            }
          }
        }
        foundTrigger = idx;
        if (idx === 0) {
          aligned = new Float32Array(slice); // no trigger found, use as-is
        } else {
          aligned = new Float32Array(windowSize);
          const firstLen = slice.length - idx;
          aligned.set(slice.subarray(idx));
          if (firstLen < windowSize) {
            aligned.set(slice.subarray(0, windowSize - firstLen), firstLen);
          }
        }
      } else {
        aligned = new Float32Array(slice); // copy for immutability
      }

      // Auto-scale
      if (autoScale) {
        let peak = 0;
        for (let i = 0; i < aligned.length; i++) {
          const v = Math.abs(aligned[i]);
          if (v > peak) peak = v;
        }
        const target = peak === 0 ? 1 : targetPeak / peak;
        // Smooth
        scaleRef.current = scaleRef.current + (target - scaleRef.current) * scaleAlpha;
        setScale(scaleRef.current);
      }

      dataRef.current.set(aligned);
      setTriggerIndex(foundTrigger);
      setWindowBuf(new Float32Array(dataRef.current));
    }, updateIntervalMs);

    return () => {
      disposedRef.current = true;
      if (intervalRef.current !== null)
        window.clearInterval(intervalRef.current);
      // Don't close shared AudioContext
    };
  }, [
    fftSize,
    windowSize,
    source,
    frequency,
    updateIntervalMs,
    triggerEnabled,
    triggerLevel,
    triggerEdge,
    autoScale,
    targetPeak,
    scaleAlpha,
  ]);
  return { window: windowBuf, scale, sampleRate, triggerIndex };
};

export default useAudioWindow;
