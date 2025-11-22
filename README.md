# Oscilloscope Visuals

Interactive oscilloscope visualization editor built with React, Three.js, and Web Audio API.

## Features

### Audio Sources
- **Microphone**: Real-time audio capture from system microphone
- **Upload File**: Play and visualize uploaded audio files (MP3, WAV, etc.)
- **Parametric Shape**: Visual-only parametric shape generation (NO AUDIO - silent shapes for XY drawing)

### Display Modes
- **Y–T Mode**: Traditional time-domain waveform (voltage vs time)
- **XY Mode**: Lissajous figures and parametric drawings (dual-channel visualization)

### Parametric Shapes (Visual Only)
13 predefined shapes available for silent XY visualization:
- Basic: Circle, Square, Triangle, Pentagon, Hexagon
- Special: Heart, Star, Infinity, Rose
- Math: Lissajous, Spiral
- Letters: A, O

**Important**: Parametric shapes do NOT generate audio. They are visual-only for drawing in XY mode.

### Visual Effects
- **Persistence**: CRT phosphor decay simulation with trail length control
- **Bloom/Glow**: Post-processing glow effect with intensity and threshold controls
- **Audio-Reactive Mapping**: Scale, rotation, line thickness, and trail modulation based on audio features (RMS, frequency bands, beat detection)

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

```
src/
├── hooks/
│   ├── useAudioInput.ts         # Mic/file audio source management
│   ├── useAudioWindow.ts        # Time-domain windowing (Y–T mode)
│   ├── useStereoAudioWindow.ts  # Stereo windowing (XY mode)
│   ├── useAudioFeatures.ts      # FFT, RMS, beat detection
│   ├── useParametricShape.ts    # Visual-only shape generation (NEW - NO AUDIO)
│   └── useParametricAudio.ts    # [DEPRECATED] Audio-based shapes (unused)
├── ui/
│   ├── scene/
│   │   ├── R3FCanvas.tsx        # Main 3D canvas container
│   │   └── components/
│   │       ├── CRTScreen.tsx    # CRT screen mesh
│   │       ├── GridOverlay.tsx  # Time/voltage grid
│   │       ├── Waveform.tsx     # Y–T waveform renderer
│   │       ├── WaveformTrail.tsx # Persistence trail effect
│   │       ├── XYPlot.tsx       # XY mode line plot
│   │       └── SceneSetup.tsx   # Lighting + controls
│   └── styled/
│       ├── ScopeControls.tsx    # Styled UI primitives
│       └── theme.ts             # Design tokens
├── utils/
│   ├── sharedAudioContext.ts    # Singleton AudioContext
│   ├── signalGenerator.ts       # Test signal generation
│   ├── curveInterpolation.ts    # Point interpolation & normalization
│   ├── parametricShapes.ts      # 13 shape generators
│   ├── shapeToAudio.ts          # [DEPRECATED] Shape → audio conversion
│   └── shapeMorphing.ts         # Shape interpolation/morphing utilities
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
```
useAudioInput (mic/file) → shared AnalyserNode → read-only hooks
                                                   ├─ useAudioWindow
                                                   ├─ useStereoAudioWindow
                                                   └─ useAudioFeatures
```

### Parametric System (Visual-Only)
```
useParametricShape → Point2D[] → Float32Array signals → XYPlot (NO AUDIO)
```

Previous audio-based implementation (`useParametricAudio`, `shapeToAudio.ts`) has been replaced with silent visual-only approach per user request.

## Control Panels (Leva)

- **Mode**: Display mode (Y–T/XY), audio source, shape selection
- **Timebase**: ms/div control (Y–T mode)
- **Gain**: Auto-scale or manual gain control
- **Visual**: Trigger marker, persistence trail, bloom/glow effects
- **Mapping**: Audio-reactive modulation (scale, rotation, thickness, trail boost, offset)
- **Monitors**: Read-only displays (RMS, frequency bands, beat confidence)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
