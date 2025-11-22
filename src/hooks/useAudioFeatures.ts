import { useEffect, useRef, useState } from "react";
import { getSharedAudioContext } from "../utils/sharedAudioContext";

export interface UseAudioFeaturesOptions {
  fftSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192;
  source?: "mic" | "osc";
  frequency?: number; // osc fallback
  updateIntervalMs?: number;
  smoothingAlpha?: number; // envelope smoothing
  beatThreshold?: number; // onset multiplier (1.3–1.6)
  beatCooldownMs?: number; // min time between beats
}

export interface AudioFeatures {
  fft: Float32Array; // normalized [0,1] frequency magnitudes
  rmsGlobal: number; // 0..1 range
  bands: {
    low: { instant: number; smoothed: number }; // 20–160 Hz
    mid: { instant: number; smoothed: number }; // 160–2000 Hz
    high: { instant: number; smoothed: number }; // 2000–12000 Hz
  };
  beat: {
    isBeat: boolean;
    confidence: number; // 0..1
    lastBeatTime: number; // timestamp
  };
  sampleRate: number;
}

/**
 * useAudioFeatures: Analyzes audio stream for FFT, RMS, band envelopes, onset/beat detection.
 * Designed for mapping music features → visual parameters.
 */
const useAudioFeatures = ({
  fftSize = 2048,
  source = "mic",
  frequency = 440,
  updateIntervalMs = 33,
  smoothingAlpha = 0.15,
  beatThreshold = 1.4,
  beatCooldownMs = 120,
}: UseAudioFeaturesOptions = {}): AudioFeatures => {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [sampleRate, setSampleRate] = useState(44100);

  // State for features
  const [fft, setFft] = useState<Float32Array>(
    () => new Float32Array(fftSize / 2)
  );
  const [rmsGlobal, setRmsGlobal] = useState(0);
  const [bands, setBands] = useState({
    low: { instant: 0, smoothed: 0 },
    mid: { instant: 0, smoothed: 0 },
    high: { instant: 0, smoothed: 0 },
  });
  const [beat, setBeat] = useState({
    isBeat: false,
    confidence: 0,
    lastBeatTime: 0,
  });

  // Internal refs for smoothing & beat tracking
  const bandSmoothRef = useRef({ low: 0, mid: 0, high: 0 });
  const energyHistoryRef = useRef<number[]>([]);
  const lastBeatRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const { context: ctx, analyser } = getSharedAudioContext();
    analyserRef.current = analyser;
    Promise.resolve().then(() => setSampleRate(ctx.sampleRate));

    // Don't connect sources here - useAudioInput handles all source connections
    // This hook only reads from the shared analyser for feature extraction

    // Analysis loop
    intervalRef.current = window.setInterval(() => {
      if (!analyserRef.current) return;

      // FFT
      const freqData = new Float32Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getFloatFrequencyData(freqData); // dB scale
      // Normalize to [0,1]: dB range typically -100..0
      const fftNorm = new Float32Array(freqData.length);
      for (let i = 0; i < freqData.length; i++) {
        fftNorm[i] = Math.max(0, (freqData[i] + 100) / 100);
      }
      setFft(fftNorm);

      // Time domain for RMS & beat
      const timeBuf = new Float32Array(analyserRef.current.fftSize);
      analyserRef.current.getFloatTimeDomainData(timeBuf);

      // Global RMS
      let sumSq = 0;
      for (let i = 0; i < timeBuf.length; i++) {
        sumSq += timeBuf[i] * timeBuf[i];
      }
      const rms = Math.sqrt(sumSq / timeBuf.length);
      setRmsGlobal(Math.min(1, rms * 2)); // scale to ~[0,1]

      // Band RMS (from FFT)
      const binHz = ctx.sampleRate / analyserRef.current.fftSize;
      const lowBin = Math.floor(20 / binHz);
      const lowEnd = Math.floor(160 / binHz);
      const midEnd = Math.floor(2000 / binHz);
      const highEnd = Math.floor(12000 / binHz);

      const bandRMS = (start: number, end: number) => {
        let sum = 0;
        for (let i = start; i < Math.min(end, fftNorm.length); i++) {
          sum += fftNorm[i];
        }
        return sum / (end - start);
      };

      const lowInst = bandRMS(lowBin, lowEnd);
      const midInst = bandRMS(lowEnd, midEnd);
      const highInst = bandRMS(midEnd, highEnd);

      // Smooth
      const lowSmooth =
        bandSmoothRef.current.low +
        (lowInst - bandSmoothRef.current.low) * smoothingAlpha;
      const midSmooth =
        bandSmoothRef.current.mid +
        (midInst - bandSmoothRef.current.mid) * smoothingAlpha;
      const highSmooth =
        bandSmoothRef.current.high +
        (highInst - bandSmoothRef.current.high) * smoothingAlpha;
      bandSmoothRef.current = {
        low: lowSmooth,
        mid: midSmooth,
        high: highSmooth,
      };

      setBands({
        low: { instant: lowInst, smoothed: lowSmooth },
        mid: { instant: midInst, smoothed: midSmooth },
        high: { instant: highInst, smoothed: highSmooth },
      });

      // Beat detection (simple onset via energy spike)
      const energy = rms;
      const history = energyHistoryRef.current;
      history.push(energy);
      if (history.length > 43) history.shift(); // ~1s at 43Hz update

      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const now = Date.now();
      let isBeat = false;
      let conf = 0;

      if (
        energy > mean * beatThreshold &&
        now - lastBeatRef.current > beatCooldownMs
      ) {
        isBeat = true;
        conf = Math.min(1, energy / (mean * beatThreshold) - 1);
        lastBeatRef.current = now;
      }

      setBeat({ isBeat, confidence: conf, lastBeatTime: lastBeatRef.current });
    }, updateIntervalMs);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      // Don't close shared AudioContext
    };
  }, [
    fftSize,
    source,
    frequency,
    updateIntervalMs,
    smoothingAlpha,
    beatThreshold,
    beatCooldownMs,
  ]);

  return { fft, rmsGlobal, bands, beat, sampleRate };
};

export default useAudioFeatures;
