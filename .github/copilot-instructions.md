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

## ESLint / Code Quality
- Flat config extends: `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` recommended, `react-refresh` Vite rules.
- Strictness: project relies on TS strict plus ESLint; avoid disabling rules globally—prefer localized `// eslint-disable-next-line` only when unavoidable.

## TypeScript Conventions
- Compiler options emphasize ESNext & bundler resolution: keep `moduleResolution: "bundler"`, `verbatimModuleSyntax`, and `noEmit` in place.
- Prefer explicit extensions when importing TypeScript (`import App from './App.tsx'` pattern). Keep JSX mode `react-jsx`.
- Avoid CommonJS syntax (`require`, `module.exports`). Use native ESM everywhere.

## Adding Code
- New UI components: create `.tsx` in `src/` or a subfolder; functional components with hooks; export defaults or named exports consistently.
- Styling: project uses **`styled-components`** for component styles. Colocate styled definitions in the same file as the component (e.g., `const CanvasContainer = styled.div\`...\``). Avoid global CSS files.
- Assets: import via relative path; for new static assets place under `src/assets/` (consistent with existing `react.svg`). Use Vite's asset handling (no manual bundler config needed).
- Environment variables: use `import.meta.env.VITE_*` naming; add to a `.env` file if introduced (not present yet). Document additions in README if created.

## Build & Performance
- React Compiler plugin present in `vite.config.ts`: if adding Babel plugins, append to `babel.plugins` array—do not remove existing `babel-plugin-react-compiler`.
- Keep plugin array minimal; confirm before introducing heavy transforms (e.g. macros, emotion, etc.).

## Oscilloscope Visuals — Domain Notes
- Goal: render visuals faithful to a CRT oscilloscope (timebase, grid, intensity/persistence, XY/Lissajous mode) using **React Three Fiber** for 3D representation.
- Rendering stack: React Three Fiber (`@react-three/fiber`) + Three.js for 3D oscilloscope; `@react-three/drei` for helpers like `OrbitControls`.
- Component structure:
  - `src/ui/scene/R3FCanvas.tsx`: main Canvas container (fullscreen, dark background, camera config).
  - `src/ui/scene/components/CRTScreen.tsx`: CRT screen mesh with phosphor-like material (`meshStandardMaterial` with emissive green).
  - `src/ui/scene/components/GridOverlay.tsx`: grid lines for time/voltage divisions using `lineSegments` and `BufferGeometry`.
  - `src/ui/scene/components/SceneSetup.tsx`: scene lighting (`ambientLight`, `pointLight`, `directionalLight`) + `OrbitControls` for camera manipulation.
- Data source: start with simulated `Float32Array` signals (sine, square, noise) via a small generator util. When ready, integrate Web Audio API (`AudioContext` + `AnalyserNode`) behind a thin hook like `useAudioSamples()`.
- Props & scaling: expose `timePerDiv`, `voltsPerDiv`, `samplesPerSec`, `triggerLevel`, `mode: 'YT' | 'XY'`. Map samples → 3D vertices/positions; avoid global state.
- Triggering: implement simple rising-edge software trigger first; draw a stable frame per animation tick. Defer advanced triggers until needed.
- Persistence: emulate CRT persistence using shader materials with alpha decay or layered render targets; make persistence configurable.
- Performance: minimize React re-renders; use `useRef` for mesh references; memoize geometries/materials with `useMemo`; cleanup Three.js resources in `useEffect` return.
- Styling: grid drawn with `lineSegments` geometry; "phosphor green" (`#00ff00`) default theme; component containers use styled-components.
- Testing/debug: `OrbitControls` enabled for camera manipulation during development. Add UI toggle to freeze animation and seed for deterministic waveforms later.

## Patterns & Guardrails
- State: local only; before adding global state (Redux, Zustand, Context), confirm necessity.
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