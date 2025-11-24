import { useEffect, useRef, useState } from "react";
import {
  getSharedAudioContext,
  resumeSharedAudioContext,
} from "../utils/sharedAudioContext";

export type AudioInputSource = "mic" | "file";

export interface UseAudioInputOptions {
  source: AudioInputSource;
  onSourceReady?: (analyser: AnalyserNode) => void;
}

/**
 * useAudioInput: Manages audio source (mic or uploaded file).
 * Returns AudioContext and AnalyserNode for downstream hooks.
 */
const useAudioInput = ({ source, onSourceReady }: UseAudioInputOptions) => {
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<
    MediaStreamAudioSourceNode | AudioBufferSourceNode | null
  >(null);
  const [isReady, setIsReady] = useState(false);
  const fileBufferRef = useRef<AudioBuffer | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [sourceNode, setSourceNode] = useState<AudioBufferSourceNode | null>(
    null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [context] = useState<AudioContext | null>(() => {
    if (typeof window !== "undefined") {
      return getSharedAudioContext().context;
    }
    return null;
  });
  const [startTime, setStartTime] = useState(0);
  const [pausedAt, setPausedAt] = useState(0);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

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
    setSourceNode(null);
    setIsPlaying(false);
    pausedAtRef.current = 0;
    setPausedAt(0);
  };

  const play = () => {
    if (!contextRef.current || !analyserRef.current || !fileBufferRef.current)
      return;
    if (isPlaying) return;

    if (contextRef.current.state === "suspended") {
      contextRef.current.resume();
    }

    const bufferSource = contextRef.current.createBufferSource();
    bufferSource.buffer = fileBufferRef.current;
    bufferSource.loop = true;
    bufferSource.connect(analyserRef.current);
    bufferSource.connect(contextRef.current.destination);

    const offset = pausedAtRef.current % fileBufferRef.current.duration;
    bufferSource.start(0, offset);

    sourceNodeRef.current = bufferSource;
    setSourceNode(bufferSource);
    startTimeRef.current = contextRef.current.currentTime - offset;
    setStartTime(startTimeRef.current);
    setIsPlaying(true);
  };

  const pause = () => {
    if (!sourceNodeRef.current || !isPlaying) return;

    try {
      if ("stop" in sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
    } catch (e) {
      console.error(e);
    }

    if (contextRef.current) {
      pausedAtRef.current =
        contextRef.current.currentTime - startTimeRef.current;
      setPausedAt(pausedAtRef.current);
    }

    setIsPlaying(false);
    setSourceNode(null);
  };

  const stop = () => {
    if (sourceNodeRef.current) {
      try {
        if ("stop" in sourceNodeRef.current) {
          sourceNodeRef.current.stop();
        }
      } catch (e) {
        console.error(e);
      }
    }
    pausedAtRef.current = 0;
    setPausedAt(0);
    setIsPlaying(false);
    setSourceNode(null);
  };

  // Seek functionality
  const seekTo = (time: number) => {
    if (!contextRef.current || !analyserRef.current || !fileBufferRef.current)
      return;
    if (isPlaying) {
      // Stop current node
      if (sourceNodeRef.current) {
        try {
          if ("stop" in sourceNodeRef.current) {
            sourceNodeRef.current.stop();
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Create new node starting at 'time'
      const bufferSource = contextRef.current.createBufferSource();
      bufferSource.buffer = fileBufferRef.current;
      bufferSource.loop = true;

      bufferSource.connect(analyserRef.current);
      bufferSource.connect(contextRef.current.destination);

      bufferSource.start(0, time);

      sourceNodeRef.current = bufferSource;
      setSourceNode(bufferSource);
      startTimeRef.current = contextRef.current.currentTime - time;
      setStartTime(startTimeRef.current);
    } else {
      pausedAtRef.current = time;
      setPausedAt(time);
    }
  };

  // Load file from user upload
  const loadAudioFile = async (file: File) => {
    if (!contextRef.current || !analyserRef.current) return;

    cleanup();

    // Resume context if suspended (browser autoplay policy)
    await resumeSharedAudioContext();

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await contextRef.current.decodeAudioData(arrayBuffer);
    fileBufferRef.current = audioBuffer;
    setAudioBuffer(audioBuffer);

    // Auto-play on load
    pausedAtRef.current = 0;
    setPausedAt(0);
    play(); // Use the play function to centralize logic

    setIsReady(true);
    onSourceReady?.(analyserRef.current);
  };

  useEffect(() => {
    // Use shared singleton AudioContext
    const { context: ctx, analyser: analyserNode } = getSharedAudioContext();
    contextRef.current = ctx;
    analyserRef.current = analyserNode;

    const connectSource = async () => {
      if (!analyserNode) return;

      // Cleanup previous source before connecting new one
      if (sourceNodeRef.current) {
        try {
          if ("stop" in sourceNodeRef.current) {
            sourceNodeRef.current.stop();
          }
          sourceNodeRef.current.disconnect();
        } catch (e) {
          console.error("Error disconnecting previous source:", e);
        }
        sourceNodeRef.current = null;
      }

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
        } catch (error) {
          console.error("Microphone access denied:", error);
          setIsReady(false);
        }
      }
      // 'file' source is handled via loadAudioFile callback
    };

    connectSource();

    return () => {
      cleanup();
      // Don't close shared context here
    };
  }, [source, onSourceReady]);

  return {
    analyserRef, // Return ref instead of .current
    isReady,
    loadAudioFile, // Expose for file upload
    audioBuffer,
    sourceNode,
    context,
    seekTo,
    startTime,
    pausedAt,
    isPlaying,
    play,
    pause,
    stop,
  };
};

export default useAudioInput;
