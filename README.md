# Oscilloscope Visuals

Interactive oscilloscope visualization editor built with React, Three.js, and Web Audio API.

## Features

### Audio Sources

- **Microphone**: Real-time audio capture from system microphone
- **Upload File**: Play and visualize uploaded audio files (MP3, WAV, etc.)
- **Playback Controls**: Full interactive control (Play, Pause, Stop, Seek, Replace File) with a visual timeline.

### Display Modes

- **Y–T Mode**: Traditional time-domain waveform (voltage vs time)
- **XY Mode**: Lissajous figures and parametric drawings (dual-channel visualization)
- **3D Figures**: Volumetric Cube and Text modes (non-reactive, purely aesthetic).

### Analog Realism (Physics Simulation)

- **Electron Beam Physics**: Simulates the physical movement of an electron beam, not just static lines.
- **Phosphor Persistence**: Realistic trail decay using a history buffer, simulating the fading of phosphor on a CRT screen.
- **Beam Intensity**: Dynamic brightness based on beam speed (slower = brighter).

### Visual Effects

- **HDR Bloom**: Always-on high-dynamic-range bloom for realistic "glowing light" effect.
- **CRT Atmosphere**: Vignette and subtle noise to simulate the texture of an analog screen.
- **Audio-Reactive Mapping**: Scale, rotation, line thickness, and trail modulation based on audio features (RMS, frequency bands, beat detection).

### Audio Features Integration

- FFT analysis with band splitting (low/mid/high)
- Beat detection with confidence scoring
- Global RMS energy tracking
- Smooth envelope following

## Tech Stack

- **React 19** + TypeScript (strict mode)
- **Vite** (rolldown-vite) with React Compiler
- **React Three Fiber** + Three.js for 3D rendering
- **Leva** for control panels
- **Web Audio API** for audio processing
- **styled-components** for styling

## Project Structure

```text
src/
├── hooks/
│   ├── useAudioInput.ts         # Mic/file audio source management
│   ├── useAudioWindow.ts        # Time-domain windowing (Y–T mode)
│   ├── useStereoAudioWindow.ts  # Stereo windowing (XY mode)
│   └── useAudioFeatures.ts      # FFT, RMS, beat detection
├── ui/
│   ├── scene/
│   │   ├── R3FCanvas.tsx        # Main 3D canvas container
│   │   └── components/
│   │       ├── CRTScreen.tsx    # CRT screen mesh
│   │       ├── GridOverlay.tsx  # Time/voltage grid
│   │       ├── Waveform.tsx     # Y–T waveform renderer
│   │       ├── WaveformTrail.tsx # Persistence trail effect
│   │       ├── XYPlot.tsx       # XY mode beam physics renderer
│   │       └── SceneSetup.tsx   # Lighting + camera controls
│   ├── components/
│   │   └── AudioTimeline.tsx    # Audio playback controls & timeline
│   └── styled/
│       ├── ScopeControls.tsx    # Styled UI primitives
│       └── theme.ts             # Design tokens
├── utils/
│   ├── sharedAudioContext.ts    # Singleton AudioContext
│   └── signalGenerator.ts       # Test signal generation
└── main.tsx                     # App entry point
```

## Development

```bash
# Install dependencies
npm install

# Start dev server with HMR
npm run dev

# Type check + build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

## Architecture Notes

### Singleton AudioContext Pattern

All audio hooks share a single `AudioContext` and `AnalyserNode` via `getSharedAudioContext()` to avoid browser limitations and ensure consistent audio state.

### Audio Pipeline

```text
useAudioInput (mic/file) → shared AnalyserNode → read-only hooks
                                                   ├─ useAudioWindow
                                                   ├─ useStereoAudioWindow
                                                   └─ useAudioFeatures
```

### Physics Rendering System

```text
Audio Signal → XYPlot (Physics Loop) → Beam Position Update → Trail Buffer Shift → Render
```

The visualization now uses a physics-based approach where a "Beam Head" (Mesh + Light) moves based on signal voltage, leaving a "Trail" (BufferGeometry) that fades over time.

## Control Panels (Leva)

- **Mode**: Display mode (Y–T/XY), audio source
- **Timebase**: ms/div control (Y–T mode)
- **Gain**: Auto-scale or manual gain control
- **Visual**: Trigger marker, persistence trail, bloom intensity/threshold
- **Mapping**: Audio-reactive modulation (scale, rotation, thickness, trail boost, offset)
- **Monitors**: Read-only displays (RMS, frequency bands, beat confidence)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
