/**
 * Singleton AudioContext + AnalyserNode shared across all audio hooks.
 * Prevents multiple AudioContexts from being created (browser limit + resource waste).
 */

let sharedContext: AudioContext | null = null;
let sharedAnalyser: AnalyserNode | null = null;

export const getSharedAudioContext = (): {
  context: AudioContext;
  analyser: AnalyserNode;
} => {
  if (!sharedContext) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    sharedContext = new AudioCtx();

    const analyser = sharedContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    // Connect to destination so we can hear the audio
    analyser.connect(sharedContext.destination);
    sharedAnalyser = analyser;
  }

  return {
    context: sharedContext,
    analyser: sharedAnalyser!,
  };
};

export const resetSharedAudioContext = () => {
  if (sharedContext) {
    sharedContext.close();
    sharedContext = null;
    sharedAnalyser = null;
  }
};

/**
 * Ensures the AudioContext is in 'running' state.
 * Call this after user interaction (file upload, button click, etc.)
 */
export const resumeSharedAudioContext = async (): Promise<void> => {
  const { context } = getSharedAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
};
