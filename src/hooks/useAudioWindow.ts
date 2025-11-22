import { useEffect, useRef, useState } from "react";

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
}: UseAudioWindowOptions = {}) => {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Float32Array>(new Float32Array(windowSize));
  const [signal, setSignal] = useState<Float32Array>(
    () => new Float32Array(windowSize)
  );
  // Removed requestAnimationFrame usage; we rely on interval updates for controlled re-render frequency.
  const intervalRef = useRef<number | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    const AudioCtx: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = fftSize;
    analyserRef.current = analyser;

    const connectMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const sourceNode = ctx.createMediaStreamSource(stream);
        sourceNode.connect(analyser);
      } catch (e) {
        console.warn(
          "[useAudioWindow] Microphone unavailable, falling back to oscillator.",
          e
        );
        connectOscillator();
      }
    };

    const connectOscillator = () => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      osc.connect(analyser);
      osc.start();
    };

    if (source === "mic") {
      void connectMic();
    } else {
      connectOscillator();
    }

    // Periodic update without forcing 60 re-renders
    intervalRef.current = window.setInterval(() => {
      if (!analyserRef.current) return;
      const temp = new Float32Array(analyserRef.current.fftSize);
      analyserRef.current.getFloatTimeDomainData(temp);
      // Copy the last windowSize samples (time window)
      const sliceStart = Math.max(0, temp.length - windowSize);
      dataRef.current.set(temp.subarray(sliceStart, sliceStart + windowSize));
      // Create a new Float32Array to trigger React state update (immutable)
      setSignal(new Float32Array(dataRef.current));
    }, updateIntervalMs);

    return () => {
      disposedRef.current = true;
      if (intervalRef.current !== null)
        window.clearInterval(intervalRef.current);
      ctx.close().catch(() => {});
    };
  }, [fftSize, windowSize, source, frequency, updateIntervalMs]);

  return signal;
};

export default useAudioWindow;
