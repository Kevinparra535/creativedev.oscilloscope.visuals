import { useEffect, useRef, useState } from "react";
import { getSharedAudioContext, resumeSharedAudioContext } from "../utils/sharedAudioContext";

export type AudioInputSource = "mic" | "file";

export interface UseAudioInputOptions {
  source: AudioInputSource;
  onSourceReady?: (analyser: AnalyserNode) => void;
}

/**
 * useAudioInput: Manages audio source (mic or uploaded file).
 * Returns AudioContext and AnalyserNode for downstream hooks.
 */
const useAudioInput = ({
  source,
  onSourceReady,
}: UseAudioInputOptions) => {
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<
    MediaStreamAudioSourceNode | AudioBufferSourceNode | null
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

    // Resume context if suspended (browser autoplay policy)
    await resumeSharedAudioContext();

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
  };
};

export default useAudioInput;
