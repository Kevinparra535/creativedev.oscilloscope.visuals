import { useEffect, useRef, useState } from "react";
import {
  TimelineContainer,
  Canvas,
  Playhead,
  TimeLabel,
  EmptyState,
  HiddenInput,
  ControlsContainer,
  ControlButton,
} from "../styles/AudioTimeline.styled";

interface AudioTimelineProps {
  audioBuffer: AudioBuffer | null;
  context: AudioContext | null;
  startTime: number;
  pausedAt?: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onFileUpload: (file: File) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export default function AudioTimeline({
  audioBuffer,
  context,
  startTime,
  pausedAt = 0,
  isPlaying,
  onSeek,
  onFileUpload,
  onPlay,
  onPause,
  onStop,
}: AudioTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [liveProgress, setLiveProgress] = useState(0);
  const [liveTimeStr, setLiveTimeStr] = useState("00:00");

  // Format time helper
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const durationStr = audioBuffer ? formatTime(audioBuffer.duration) : "00:00";

  // Derived state for display
  const displayProgress = isPlaying
    ? liveProgress
    : audioBuffer
    ? (pausedAt / audioBuffer.duration) * 100
    : 0;

  const displayTimeStr = isPlaying ? liveTimeStr : formatTime(pausedAt);

  // Draw Waveform
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const channelData = audioBuffer.getChannelData(0); // Use left channel
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    // Background is handled by container, but we can add a tint
    ctx.fillStyle = "rgba(0, 20, 0, 0.5)";
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 1;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      // Find min/max in this chunk (downsampling)
      for (let j = 0; j < step; j++) {
        const datum = channelData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      // Draw vertical line for this pixel column
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }

    ctx.stroke();

    // Draw grid lines (center line)
    ctx.strokeStyle = "rgba(0, 255, 0, 0.3)";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [audioBuffer]);

  // Update Playhead Loop
  useEffect(() => {
    if (!context || !audioBuffer || !isPlaying) return;

    let animationFrame: number;

    const update = () => {
      const now = context.currentTime;
      let elapsed = now - startTime;

      // Handle looping visually (simple modulo)
      if (elapsed > audioBuffer.duration) {
        elapsed = elapsed % audioBuffer.duration;
      }

      const pct = (elapsed / audioBuffer.duration) * 100;
      setLiveProgress(pct);
      setLiveTimeStr(formatTime(elapsed));

      animationFrame = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [context, isPlaying, audioBuffer, startTime]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuffer || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const seekTime = percentage * audioBuffer.duration;

    // Optimistic update for live state (if playing)
    if (isPlaying) {
      setLiveProgress(percentage * 100);
      setLiveTimeStr(formatTime(seekTime));
    }
    
    onSeek(seekTime);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <TimelineContainer>
      {!audioBuffer ? (
        <EmptyState onClick={handleUploadClick}>
          Click to Load Audio File
          <HiddenInput
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
          />
        </EmptyState>
      ) : (
        <>
          <ControlsContainer>
            <ControlButton onClick={isPlaying ? onPause : onPlay}>
              {isPlaying ? "PAUSE" : "PLAY"}
            </ControlButton>
            <ControlButton onClick={onStop}>STOP</ControlButton>
            <ControlButton onClick={handleUploadClick}>REPLACE</ControlButton>
          </ControlsContainer>
          <TimeLabel>
            {displayTimeStr} / {durationStr}
          </TimeLabel>
          <Canvas ref={canvasRef} onClick={handleClick} />
          <Playhead left={displayProgress} />
          <HiddenInput
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
          />
        </>
      )}
    </TimelineContainer>
  );
}
