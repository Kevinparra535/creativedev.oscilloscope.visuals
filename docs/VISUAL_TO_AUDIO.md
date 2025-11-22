# Visual → Audio Pipeline Strategy

**Goal**: Convert designed parametric shapes (XY figures, logos, text) back into stereo audio signals that recreate those visuals on an oscilloscope.

This is the foundation of **oscilloscope music** / **oscilloscope art**: intentionally designing waveforms to draw specific images.

---

## Core Concept

In XY mode, the oscilloscope plots:

- X(t) = Left channel amplitude at time t
- Y(t) = Right channel amplitude at time t

Each sample `(L[i], R[i])` maps to a point `(x, y)` on the screen.

**Reversing the flow**: Given a desired path (list of (x, y) coordinates), generate stereo samples `(L[i], R[i])` that trace that path.

---

## Path Representation

### Input Formats

1. **Parametric Functions**: Analytic curves like circles, spirals, Lissajous.
   - Example: Circle → `L(t) = cos(2πft)`, `R(t) = sin(2πft)`
   - Frequency `f` controls speed; phase offset controls rotation.

2. **Sampled Paths**: Array of `{ x, y }` coordinates from:
   - Vector drawing tools (SVG → point list).
   - Text rendering (convert glyphs to outlines).
   - Custom hand-drawn curves.

3. **Segmented Paths**: Multiple disconnected shapes (e.g., letters). Requires "pen lift" strategy (see below).

---

## Sampling Strategy

### Time Mapping

- Total duration: `D` seconds at sample rate `SR` (e.g., 44100 Hz).
- Total samples: `N = D * SR`.
- Path has `P` points.
- Mapping options:
  1. **Linear Interpolation**: Distribute `P` points across `N` samples. For each sample index `i`, interpolate between nearest path points.
  2. **Arc-Length Parameterization**: Sample proportional to path length to ensure uniform speed (prevents bunching on tight curves).
  3. **Time-Based**: If path already has timestamps (e.g., from recording), map directly.

### Interpolation

- **Linear**: Fast, causes sharp corners → high-frequency noise → audible clicks.
- **Catmull-Rom / Cubic**: Smooth, avoids aliasing. Recommended.
- **Spline (Bézier)**: Oversmooth may lose sharp features; use for organic shapes only.

### Normalization

- Scale (x, y) to fit [-1, 1] range (audio amplitude limits).
- Maintain aspect ratio or allow user-controlled stretch per axis.

---

## Multi-Shape Handling ("Pen Lift")

**Problem**: Disconnected shapes (e.g., separate letters in a word) create jumps. A jump from (x₁, y₁) to (x₂, y₂) introduces a transient → audible click.

**Solutions**:

1. **Silence Insertion**: Insert zeros (or low-amplitude ramp) between shapes.
   - Trade-off: Visible gap on screen (beam moves slowly or vanishes briefly).
2. **Rapid Transition**: Move extremely fast between disconnected segments.
   - High-frequency content; apply lowpass filter to reduce audible artifact.
   - Screen shows faint connecting line.

3. **Z-Modulation (Advanced)**: If supporting hardware, modulate beam intensity (Z-axis).
   - Turn beam off during transitions. Requires third audio channel or external hardware.

4. **Ordering Optimization**: Reorder shapes to minimize total travel distance (Traveling Salesman Problem variant).

---

## Audio Post-Processing

### Anti-Aliasing

- Oversampling: Render at 2× or 4× sample rate, then downsample with FIR lowpass.
- Prevents Nyquist foldback on sharp corners.

### Bandlimiting

- Apply gentle lowpass (e.g., 12 kHz cutoff) to remove inaudible ultrasonic content that wastes headroom.
- Ensures compatibility with consumer audio gear.

### Normalization & Headroom

- Peak normalize to ~-1 dBFS to avoid clipping.
- Leave headroom for downstream processing (reverb, dynamics).

### Stereo Compatibility

- Most oscilloscope art intentionally creates non-standard stereo (XY correlation).
- Mid/Side processing not applicable; preserve L/R independently.

---

## Playback & Verification

### Real-Time Rendering

- Generate waveform on-the-fly; stream via Web Audio API `AudioBufferSourceNode`.
- Use `ScriptProcessorNode` or `AudioWorklet` for dynamic paths (e.g., user drawing in real-time).

### Export to WAV

- Encode stereo `Float32Array` → 16-bit PCM or 24-bit PCM.
- Include metadata (sample rate, duration).
- User downloads `.wav` file for playback on external oscilloscope or software sim.

### Preview

- Play generated audio back through existing `useStereoAudioWindow` → XYPlot loop.
- Visual verification before export.

---

## Implementation Roadmap

### Phase 1: Parametric Generator (POC)

- Function: `generateLissajous(freqA, freqB, phase, duration, sampleRate)` → `{ left: Float32Array, right: Float32Array }`.
- UI: Leva sliders for frequency ratio, phase, preview + export button.
- Validate: Render in XY mode; confirm expected shape.

### Phase 2: Path Sampler

- Function: `pathToStereo(points: {x, y}[], duration, sampleRate, interpolation)`.
- Interpolation: Catmull-Rom default.
- Test: Simple shapes (square, triangle, circle).

### Phase 3: SVG → Audio

- Parse SVG path data → list of points.
- Handle multi-path (letters, complex logos).
- Pen-lift strategy selector (silence vs rapid transition).

### Phase 4: Text Rendering

- Use `CanvasRenderingContext2D.measureText()` + font outlines.
- Convert glyph paths → points.
- Sequence letters with spacing.

### Phase 5: Real-Time Drawing

- Canvas overlay for user to draw freehand.
- Capture stroke as point list.
- Instant audio generation + playback.

### Phase 6: Advanced Features

- Z-modulation support (third channel export or trigger encoding).
- Temporal effects: morph between shapes (crossfade L/R arrays).
- Rhythm sync: align shape loops to musical tempo (BPM → duration calculation).

---

## References & Resources

- **Jerobeam Fenderson**: Pioneer of oscilloscope music. Study waveform structures from released tracks.
- **Shadertoy Oscilloscope Demos**: Visual simulation techniques.
- **Audacity / Sonic Visualiser**: Inspect existing oscilloscope music files for reverse-engineering insights.
- **Web Audio API**: `OfflineAudioContext` for non-realtime rendering.

---

## Technical Constraints

- **Nyquist Limit**: Max displayable frequency = sampleRate / 2. Sharp corners require high harmonics; balance detail vs bandwidth.
- **Persistence**: CRT phosphor decay (~ms) vs sample rate (~μs). Rapid movements create trails; consider "strobe" effect (brief pauses).
- **Stereo Phase**: Perfect XY correlation (mono summed = zero) risks phase cancellation if played on mono systems. Add slight decorrelation if dual-use (music + visual).

---

## Future Integrations

- Import `.svg` / `.png` (edge detection) → parametric path.
- AI-assisted path optimization (reduce sample count while preserving shape).
- Live performance mode: MIDI control of parameters (frequency, rotation, scale).
- Shader-based GPU rendering for complex paths (offload CPU).

---

**Status**: Design document. Implementation pending phase 1 (parametric generator).
