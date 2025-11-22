import { useEffect, useRef, useState } from "react";

export interface UseStereoAudioWindowOptions {
  fftSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384;
  windowSize?: number;
  source?: "mic" | "osc";
  frequencyA?: number; // primary oscillator freq fallback
  frequencyB?: number; // secondary oscillator freq fallback
  phaseOffset?: number; // phase offset for oscillator B
  updateIntervalMs?: number;
  autoScale?: boolean; // single scale for both channels for now
  targetPeak?: number;
  scaleAlpha?: number;
}

/**
 * useStereoAudioWindow: captures left/right channel windows for XY mode.
 * - If microphone provides stereo, splits channels.
 * - If mono or unavailable, falls back to two synthesized sine waves (A,B).
 */
const useStereoAudioWindow = ({
  fftSize = 2048,
  windowSize = 1024,
  source = "mic",
  frequencyA = 440,
  frequencyB = 660,
  phaseOffset = Math.PI / 3,
  updateIntervalMs = 33,
  autoScale = true,
  targetPeak = 0.9,
  scaleAlpha = 0.15,
}: UseStereoAudioWindowOptions = {}) => {
  const analyserLeftRef = useRef<AnalyserNode | null>(null);
  const analyserRightRef = useRef<AnalyserNode | null>(null);
  const [left, setLeft] = useState<Float32Array>(() => new Float32Array(windowSize));
  const [right, setRight] = useState<Float32Array>(() => new Float32Array(windowSize));
  const [sampleRate, setSampleRate] = useState<number>(44100);
  const [isStereo, setIsStereo] = useState<boolean>(false);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let ctx: AudioContext | null = null;
    let oscA: OscillatorNode | null = null;
    let oscB: OscillatorNode | null = null;
    const setup = async () => {
      const AudioCtx: typeof AudioContext =
        window.AudioContext || (window as unknown as { AudioContext: typeof AudioContext }).AudioContext;
      ctx = new AudioCtx();
      setSampleRate(ctx.sampleRate);

      const createTwoAnalysers = () => {
        const aL = ctx!.createAnalyser();
        const aR = ctx!.createAnalyser();
        aL.fftSize = fftSize;
        aR.fftSize = fftSize;
        analyserLeftRef.current = aL;
        analyserRightRef.current = aR;
      };

      createTwoAnalysers();

      const connectMic = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 2 },
          });
          const src = ctx!.createMediaStreamSource(stream);
          // Detect channel count via audio track settings if available
          const tracks = stream.getAudioTracks();
          const settings = tracks[0]?.getSettings();
          const channels = (settings?.channelCount as number) || 1;
          setIsStereo(channels >= 2);
          if (channels >= 2) {
            const splitter = ctx!.createChannelSplitter(2);
            src.connect(splitter);
            splitter.connect(analyserLeftRef.current! , 0);
            splitter.connect(analyserRightRef.current!, 1);
          } else {
            // Mono: duplicate into both analysers
            src.connect(analyserLeftRef.current!);
            src.connect(analyserRightRef.current!);
          }
        } catch (e) {
          console.warn("[useStereoAudioWindow] Mic unavailable, falling back to oscillators", e);
          connectOscFallback();
        }
      };

      const connectOscFallback = () => {
        oscA = ctx!.createOscillator();
        oscB = ctx!.createOscillator();
        oscA.type = "sine";
        oscB.type = "sine";
        oscA.frequency.value = frequencyA;
        oscB.frequency.value = frequencyB;
        // Phase offset: use DelayNode or custom ScriptProcessor? Simpler: start times offset
        // We'll approximate by scheduling start of B slightly later; not perfect phase but acceptable POC.
        const gainA = ctx!.createGain();
        const gainB = ctx!.createGain();
        gainA.gain.value = 0.8;
        gainB.gain.value = 0.8;
        oscA.connect(gainA);
        oscB.connect(gainB);
        gainA.connect(analyserLeftRef.current!);
        gainB.connect(analyserRightRef.current!);
        oscA.start();
        // Use current time + phaseOffset converted to time fraction of frequencyB period
        const periodB = 1 / frequencyB;
        oscB.start(ctx!.currentTime + (phaseOffset / (2 * Math.PI)) * periodB);
      };

      if (source === "mic") {
        await connectMic();
      } else {
        connectOscFallback();
      }

      intervalRef.current = window.setInterval(() => {
        if (!analyserLeftRef.current || !analyserRightRef.current) return;
        const bufA = new Float32Array(analyserLeftRef.current.fftSize);
        const bufB = new Float32Array(analyserRightRef.current.fftSize);
        analyserLeftRef.current.getFloatTimeDomainData(bufA);
        analyserRightRef.current.getFloatTimeDomainData(bufB);

        const sliceStartA = Math.max(0, bufA.length - windowSize);
        const sliceStartB = Math.max(0, bufB.length - windowSize);
        const sliceA = bufA.subarray(sliceStartA, sliceStartA + windowSize);
        const sliceB = bufB.subarray(sliceStartB, sliceStartB + windowSize);

        if (autoScale) {
          let peak = 0;
            for (let i = 0; i < windowSize; i++) {
              const va = Math.abs(sliceA[i]);
              const vb = Math.abs(sliceB[i]);
              if (va > peak) peak = va;
              if (vb > peak) peak = vb;
            }
            const target = peak === 0 ? 1 : targetPeak / peak;
            scaleRef.current = scaleRef.current + (target - scaleRef.current) * scaleAlpha;
            setScale(scaleRef.current);
        }

        setLeft(new Float32Array(sliceA));
        setRight(new Float32Array(sliceB));
      }, updateIntervalMs);
    };

    setup();

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      ctx?.close().catch(() => {});
      oscA?.stop();
      oscB?.stop();
    };
  }, [
    fftSize,
    windowSize,
    source,
    frequencyA,
    frequencyB,
    phaseOffset,
    updateIntervalMs,
    autoScale,
    targetPeak,
    scaleAlpha,
  ]);

  return { left, right, sampleRate, isStereo, scale };
};

export default useStereoAudioWindow;
