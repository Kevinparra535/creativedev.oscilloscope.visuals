# AI Coding Agent Instructions

These instructions capture current, observable patterns in this React + TypeScript + Vite project. Keep changes aligned with existing strict TS, ES module, and Vite conventions. Do not introduce tooling or architecture shifts without confirmation.

## Core Architecture

- Entry point: `src/main.tsx` mounts `<App />` using React 19 `createRoot` with `<StrictMode>`.
- App shell: `src/App.tsx` purely functional component; local state via `useState`; assets imported (SVG) and global styles from `App.css` / `index.css`.
- Build chain: Vite (overridden to `rolldown-vite@7.2.5`) + React plugin + Babel React Compiler plugin. No custom routing, state management, or data layer yet.
- TypeScript is split: `tsconfig.json` references `tsconfig.app.json` and `tsconfig.node.json` (composite build). App config isolates browser code; node config isolates Vite config.

## Tooling & Scripts

- Dev (HMR + Fast Refresh + React Compiler): `npm run dev` (Vite).
- Type + prod build: `npm run build` (runs `tsc -b` for composite type checking, then `vite build`). Keep this order; do not remove `tsc -b`.
- Preview built output: `npm run preview`.
- Lint: `npm run lint` using flat ESLint config (`eslint.config.js`).
- Runtime Controls: Project now uses **Leva** (`leva`) for interactive oscilloscope parameters (mode, timebase, gain, trigger, persistence). Prefer adding new adjustable visualization parameters via `useControls` instead of bespoke styled sliders.

## ESLint / Code Quality

- Flat config extends: `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` recommended, `react-refresh` Vite rules.
- Strictness: project relies on TS strict plus ESLint; avoid disabling rules globally—prefer localized `// eslint-disable-next-line` only when unavoidable.

## TypeScript Conventions

- Compiler options emphasize ESNext & bundler resolution: keep `moduleResolution: "bundler"`, `verbatimModuleSyntax`, and `noEmit` in place.
- Prefer explicit extensions when importing TypeScript (`import App from './App.tsx'` pattern). Keep JSX mode `react-jsx`.
- Avoid CommonJS syntax (`require`, `module.exports`). Use native ESM everywhere.

## Adding Code

- New UI components: create `.tsx` in `src/` or a subfolder; functional components with hooks; export defaults or named exports consistently.
- Styling: project uses **`styled-components`** with a light design system. DO NOT inline styled definitions inside feature components; instead place shared styled primitives & tokens under `src/ui/styled/` and `src/ui/theme.ts`. Components import these primitives (e.g., `CanvasContainer`, `ToggleBar`). Avoid ad-hoc style duplication.
- Assets: import via relative path; for new static assets place under `src/assets/` (consistent with existing `react.svg`). Use Vite's asset handling (no manual bundler config needed).
- Environment variables: use `import.meta.env.VITE_*` naming; add to a `.env` file if introduced (not present yet). Document additions in README if created.

## Build & Performance

- React Compiler plugin present in `vite.config.ts`: if adding Babel plugins, append to `babel.plugins` array—do not remove existing `babel-plugin-react-compiler`.
- Keep plugin array minimal; confirm before introducing heavy transforms (e.g. macros, emotion, etc.).

## Oscilloscope Visuals — Domain Notes

- Goal: render visuals faithful to a CRT oscilloscope (timebase, grid, intensity/persistence, XY/Lissajous mode) using **React Three Fiber** for 3D representation.
- **Core Concept**: Oscilloscope as a signal viewer (not a generic visual). Y–T mode: X = time (sample index), Y = amplitude. XY mode: X = signal A amplitude, Y = signal B amplitude (Lissajous / parametric figures). This viewer will be later hacked as an artistic canvas (persistence, multi-layer, modulation).
- Rendering stack: React Three Fiber (`@react-three/fiber`) + Three.js for 3D oscilloscope; `@react-three/drei` for helpers like `CameraControls`.
- Component structure:
  - `src/ui/scene/R3FCanvas.tsx`: main Canvas container (fullscreen, dark background, camera config).
  - `src/ui/scene/components/CRTScreen.tsx`: CRT screen mesh with phosphor-like material (`meshStandardMaterial` with emissive green).
  - `src/ui/scene/components/GridOverlay.tsx`: grid lines for time/voltage divisions using `lineSegments` and `BufferGeometry`.
  - `src/ui/scene/components/Waveform.tsx`: **core component** mapping signal array to line geometry (Y–T mode).
  - `src/ui/scene/components/XYPlot.tsx`: **Physics-based renderer**. Uses a moving "Beam Head" (Mesh + Light) and a "Trail" (BufferGeometry) to simulate CRT physics.
  - `src/ui/scene/components/SceneSetup.tsx`: scene lighting (`ambientLight`, `pointLight`, `directionalLight`) + `CameraControls` (Dolly only).
- Signal mapping (Y–T): `x = (i/(N-1)) * width - width/2`, `y = signal[i] * (height/2) * amplitudeScale`.
- Signal mapping (XY): `x = signalA[i] * (width/2) * scaleX`, `y = signalB[i] * (height/2) * scaleY`.
- Data source: start with simulated `Float32Array` signals (sine, square, noise) via `utils/signalGenerator.ts`. When ready, integrate Web Audio API (`AudioContext` + `AnalyserNode`) behind a thin hook like `useAudioSamples()`.
- Props & scaling: expose `amplitudeScale` for Y-axis scaling. Map samples → 3D vertices; avoid global state.
- Triggering: Rising edge alignment for stability (Y–T). XY stability emerges from relative phase between A/B; optional phase controls or delay lines later.
- Persistence: Implemented via `WaveformTrail` or internal buffer in `XYPlot`. Uses a history buffer (ring buffer or shift) to store past beam positions and render them with fading opacity.
- Performance: minimize React re-renders; use `useRef` for mesh references; memoize geometries/materials with `useMemo`; cleanup Three.js resources in `useEffect` return.
- Styling: grid drawn with `lineSegments` geometry; "phosphor green" (`#00ff00`) default theme; component containers use styled-components.
- Testing/debug: `CameraControls` enabled for zoom (dolly) only. No rotation or pan allowed to maintain "seated in front of scope" perspective.
- **FPS vs Sample Rate**: ~60 FPS vs 44.1kHz audio. Each frame selects a window (e.g. 1024 samples). Rolling vs Windowed approach chosen: POC uses Windowed for clarity; Rolling can be added for historical trail.

## Modes Architecture

- Local `mode` state in `R3FCanvas` (`'yt' | 'xy'`).
- Shared window length for both signals; second signal can be synthetic (phase-shift sine) when mic provides only one channel.
- Components render conditionally: `mode === 'yt' ? <Waveform .../> : <XYPlot .../>`.
- Future: allow dynamic source routing (mic left/right, synthesized pairs, external data). Keep abstractions thin: hooks produce `Float32Array` windows.
 - Time scale (ms/div): user adjustable; effective window size = `sampleRate * msPerDiv * horizontalDivs / 1000`. Maintain a minimum window length to avoid underflow.
 - Gain control: manual multiplier vs auto-scale (peak normalization with exponential smoothing). Auto mode multiplies base scale by dynamic factor; manual uses user slider.

## XY Parametric Art Fundamentals

- Parametric Curve: XY mode renders samples as x(t)=L(t), y(t)=R(t). Any designed stereo signal becomes a 2D path.
- Lissajous Figures: Simple sine pairs with frequency ratios (f1:f2) and phase offsets φ produce stable geometric shapes (circles, ellipses, knots). Small phase changes radically alter topology.
- Frequency Ratios: Integer ratios (e.g. 1:2, 3:5) yield closed figures; irrational or detuned ratios create drifting, evolving forms.
- Phase Control: Adjusting relative phase shifts rotates or skews the figure; dynamic phase modulation animates morphology.
- Ordering Matters: The temporal ordering of (x,y) points defines stroke traversal; identical spatial sets with different ordering appear tangled. Designing waveforms includes controlling traversal order.
- Stereo Source Strategies: (1) True stereo capture; (2) Dual oscillators with independent frequency/phase; (3) Encoded parametric audio (purpose-built for drawing logos/text); (4) Procedural synthesis (e.g. additive or FM) with coordinated envelopes.
- Closure & Looping: To draw a stable shape, ensure both channels complete an integer number of cycles over the window; windowSize selection affects perceived completeness.
- Scaling & Normalization: Use shared auto-scale to avoid channel clipping; consider per-channel normalization only if intentional aspect ratio warping is desired.
- Anti-Tangle Techniques: Phase-lock segments or inject brief silence/marker pulses to reposition path; advanced: reorder samples (not real-time faithful) for artistic post-processing.
- Future Enhancements: Persistence trail for phosphor decay, variable point density, derivative-based glow (speed → brightness), path morphing via crossfades between stereo signal sets.

## Postprocessing Effects Layer

- Goal: Add optional glow/bloom for high-energy moments and beat punctuation.
- Implementation: `@react-three/postprocessing` library wrapping Three.js `EffectComposer` + passes.
- Bloom Pass: Emissive/bright pixels (phosphor green waveform) bleed/glow outward simulating CRT halo.
- Controls (Leva Visual folder): `bloomIntensity` (default 4.0), `bloomThreshold` (default 0.05).
- Beat Reactivity: Bloom intensity multiplied by 1.5× on beat frames for punch.
- Performance: Bloom adds ~2ms per frame (60fps target maintained on modern GPU). Disable for low-end hardware.
- Future Enhancements: ChromaticAberration for CRT RGB misalignment, Vignette for screen edges, Noise for phosphor grain, FXAA for anti-aliasing.
- Conditional Rendering: Always active for realism.

## Audio Features & Visual Mapping (Audio→Visual Pipeline)

- Goal: Evolve from passive signal viewer to reactive visual editor that maps musical characteristics (spectrum, dynamics, rhythm) to visual transformations.
- Hook Architecture: `useAudioFeatures` separate from `useAudioWindow`/`useStereoAudioWindow` to avoid coupling time-domain windowing with frequency/energy analysis.
- FFT Analysis: `AnalyserNode.getFloatFrequencyData` provides dB-scale magnitudes; normalize to [0,1] via `(dB + 100) / 100`. Bin resolution = sampleRate / fftSize.
- Band Splitting: Separate spectrum into Low (20–160 Hz), Mid (160–2000 Hz), High (2000–12000 Hz). Compute per-band RMS from FFT bins for envelope following.
- Envelope Smoothing: Exponential smoothing `env = env + (instant - env) * alpha` (alpha ~0.15) to prevent flicker; different alpha per band optional (low slower, high faster).
- Global RMS: Time-domain energy `sqrt(Σ samples² / N)` scaled to ~[0,1]. Useful for instant amplitude-driven scaling.
- Onset/Beat Detection: Track energy over sliding window (~1s history at update rate). Beat = `energy > mean * threshold` (threshold 1.3–1.6) + cooldown (≥120ms). Confidence = `(energy / (mean * threshold)) - 1` clamped [0,1].
- Mapping Strategies:
  - Scale (XY): `baseScale * (1 + rmsGlobal * scaleGain)` — globals drive figure size.
  - Rotation (XY): Incremental `angle += bands.high.smoothed * rotateGain * 2π` — high frequencies spin figure.
  - Thickness: `baseWidth + bands.mid.smoothed * thicknessGain * k` — mid energy fattens lines.
  - Persistence: `baseTrail + floor(bands.low.smoothed * trailBoost)` — bass extends phosphor decay.
  - Translation: `offsetX/Y` user-controlled; future: map `(high - low) / (high + low)` to drift.
  - Beat Flash: Multiply amplitude/scale by `beatFlash` factor (e.g. 1.2) on beat frames for punch.
  - Color (future): Interpolate hue based on spectral centroid or `high / (low+mid+high)` ratio; flash white on beat.
- Leva Panel Organization:
  - Folders: Mode, Timebase, Gain, Visual (includes bloom controls), Mapping.
  - Visual folder: `showTrigger`, `showPersistence`, `trailLength`, `bloomIntensity`, `bloomThreshold`.
  - Mapping sliders: `scaleGain`, `rotateGain`, `thicknessGain`, `trailBoost`, `offsetX`, `offsetY`.
  - Read-only Monitors: `rmsGlobal`, `lowBand`, `midBand`, `highBand`, `beatConf` for live feedback.
- Performance: Update features at ~30–40Hz (not 60fps); reuse Float32Arrays; keep history buffers bounded (≤50 entries).
- Feature Hook Return: `{ fft, rmsGlobal, bands: { low, mid, high }, beat: { isBeat, confidence, lastBeatTime }, sampleRate }`.
- Transform Application: Wrap `<Waveform>` / `<XYPlot>` in `<group>` with `position`, `rotation`, `scale` driven by mapped values. Apply modulation params to `amplitudeScale`, `lineWidth` props.
- Future Enhancements: FFT-based spectral gating (filter visual by frequency band), derivative-based glow (speed → brightness), hue shift keyed to spectral centroid, postprocessing bloom on beat.

## Artistic Canvas Vision

- Base viewer = deterministic signal plot.
- Hack layers: persistence trail, glow, modulation of intensity by derivative, multi-signal overlays, parametric gating.
- Keep geometry memory stable (reuse buffers) and apply effects via post-processing or custom shaders later.

## Implementation Guidelines for New XYPlot

- Input props: `signalA`, `signalB`, `width`, `height`, `scaleX`, `scaleY`, `color`, `lineWidth`.
- Length mismatch: clamp to `min(signalA.length, signalB.length)`.
- Use `BufferGeometry` with preallocated `Float32Array` updated in `useEffect`/`useMemo`.
- Clean up geometry/material via React cleanup return.
- Support switching mode without remounting entire Canvas (only conditional plot components).
 - When time/gain controls change, only Y–T mode re-renders waveform; XY ignores ms/div but can adopt gain if unified look desired later.

## Trigger & Stability Notes

- Y–T: Optional rising-edge scan to anchor left edge of window.
- XY: For classic Lissajous, use frequency ratios (e.g. 440Hz vs 660Hz) or phase offsets. Provide simple phase param for synthetic second source.
 - Auto-scale smoothing: `scale = scale + (target - scale) * alpha` (alpha ~0.1–0.2) to prevent flicker.

## Persistence (Phosphor Decay Simulation)

- Concept: Legacy CRT phosphor retains brightness briefly; we emulate by drawing past frames with fading opacity.
- Implementation (current): Ring buffer of last N time-domain windows rendered as stacked lines behind the current waveform.
- Controls: `showPersistence` toggle and `trailLength` (frames). Length 0 disables buffer writes.
- Fading: Linear opacity falloff (newest ≈60% base, oldest → near 0). Future: exponential decay or additive blending.
- Performance: Each frame adds one Float32Array copy; cap at sane limit (≤ 60). Rebuild minimal geometries per frame; consider merging into a single BufferGeometry for optimization later.
- Future Enhancements: Render-to-texture with fragment shader decay, variable color shift over lifetime, glow proportional to derivative (speed), selective channel persistence.


## Patterns & Guardrails

- State: local only; before adding global state (Redux, Zustand, Context), confirm necessity.
- Styling separation: if a component needs new UI primitives, add them to `src/ui/styled/ScopeControls.tsx` or a new appropriately named file—do not embed style declarations next to logic.
- Routing: none; if introducing, isolate in `src/routes/` and update `main.tsx` root composition.
- Testing: absent. Ask before adding (e.g., Vitest + React Testing Library). Do not assume.
- Accessibility: not enforced yet—if adding ARIA or semantic fixes, keep changes incremental.

## Refactoring Guidelines

- Preserve strict TS signals: do not suppress `noUnusedLocals/Parameters`; remove unused code instead.
- Coherent imports: prefer absolute relative paths ("./", "../") until a path alias strategy is explicitly adopted.
- Avoid over-engineering: the project is minimal—add only code that directly supports requested features.

## Examples

- Component creation example:
  ```tsx
  // src/components/Counter.tsx
  import { useState } from 'react'
  export function Counter() {
    const [value, setValue] = useState(0)
    return <button onClick={() => setValue(v => v + 1)}>Value: {value}</button>
  }
  ```
  Integrate by importing into `App.tsx` and placing inside returned fragment.

## When Unsure

- If a feature implies architectural shift (state lib, routing, SSR, testing framework), pause and ask.
- Clarify intended visual design before heavy styling or animation work.

## PR / Change Hygiene (For Agents)

- Run: `npm run lint` before proposing commits.
- Validate build: `npm run build` (type + bundle) after significant TS changes.
- Keep diffs focused: one conceptual change per commit (feature, refactor, chore).

---
Feedback requested: Are there domain-specific visuals, oscilloscope data sources, or planned integrations not yet reflected that should guide component/data layer structure?
