import { useEffect, useRef, useState } from "react";

export type AudioInputSource = "mic" | "file" | "osc";

export interface UseAudioInputOptions {
  source: AudioInputSource;
  frequency?: number; // for osc fallback
  onSourceReady?: (analyser: AnalyserNode) => void;
}

/**
 * useAudioInput: Manages audio source (mic, uploaded file, or oscillator).
 * Returns AudioContext and AnalyserNode for downstream hooks.
 */
const useAudioInput = ({
  source,
  frequency = 440,
  onSourceReady,
}: UseAudioInputOptions) => {
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<
    MediaStreamAudioSourceNode | AudioBufferSourceNode | OscillatorNode | null
  >(null);
  const [isReady, setIsReady] = useState(false);
  const fileBufferRef = useRef<AudioBuffer | null>(null);

  // Cleanup helper
  const cleanup = () => {
    if (sourceNodeRef.current) {
      try {
        if ("stop" in sourceNodeRef.current) {
          sourceNodeRef.current.stop();
        }
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // Ignore cleanup errors
        console.error(e);
      }
      sourceNodeRef.current = null;
    }
    setIsReady(false);
  };

  // Load file from user upload
  const loadAudioFile = async (file: File) => {
    if (!contextRef.current || !analyserRef.current) return;

    cleanup();

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await contextRef.current.decodeAudioData(arrayBuffer);
    fileBufferRef.current = audioBuffer;

    // Create buffer source and loop it
    const bufferSource = contextRef.current.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.loop = true;
    bufferSource.connect(analyserRef.current);
    // Also connect to destination to hear the audio
    bufferSource.connect(contextRef.current.destination);
    bufferSource.start(0);

    sourceNodeRef.current = bufferSource;
    setIsReady(true);
    onSourceReady?.(analyserRef.current);
  };

  useEffect(() => {
    const AudioCtx: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    const ctx = new AudioCtx();
    contextRef.current = ctx;

    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0;
    // Connect analyser to destination to hear audio
    analyserNode.connect(ctx.destination);
    analyserRef.current = analyserNode;

    const connectSource = async () => {
      if (!analyserNode) return;
      cleanup();

      if (source === "mic") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          const micSource = ctx.createMediaStreamSource(stream);
          micSource.connect(analyserNode);
          sourceNodeRef.current = micSource;
          setIsReady(true);
          onSourceReady?.(analyserNode);
        } catch {
          console.warn("Mic access denied, falling back to oscillator");
          // Fallback to osc
          const osc = ctx.createOscillator();
          osc.frequency.value = frequency;
          osc.connect(analyserNode);
          osc.start();
          sourceNodeRef.current = osc;
          setIsReady(true);
          onSourceReady?.(analyserNode);
        }
      } else if (source === "osc") {
        const osc = ctx.createOscillator();
        osc.frequency.value = frequency;
        osc.connect(analyserNode);
        osc.start();
        sourceNodeRef.current = osc;
        setIsReady(true);
        onSourceReady?.(analyserNode);
      }
      // 'file' source is handled via loadAudioFile callback
    };

    connectSource();

    return () => {
      cleanup();
      ctx.close();
    };
  }, [source, frequency, onSourceReady]);

  return {
    analyserRef, // Return ref instead of .current
    isReady,
    loadAudioFile, // Expose for file upload
  };
};

export default useAudioInput;
