# Concepto Fundamental: Osciloscopio

## ¿Qué es un osciloscopio?

**Una herramienta que dibuja cómo cambia una señal en el tiempo.**

## Visión General y Propósito Artístico

Este proyecto NO es sólo un "visual" genérico: es la construcción de un VISOR DE SEÑALES inspirado en un osciloscopio clásico que luego se hackeará como lienzo creativo.

### Qué simula

- Un buffer de samples (audio u otra señal continua discretizada).
- Un modo tiempo (Y–T): eje X = tiempo, eje Y = amplitud/voltaje.
- Un modo XY: eje X = señal 1, eje Y = señal 2 (figuras de Lissajous / dibujos paramétricos).

### Analógico vs Digital (mentalidad)

- Analógico: haz de electrones barrido continuo, persistencia fósforo.
- Digital: rasterización por píxeles, line geometry en GPU.
En el POC usamos geometrías lineales pero pretendemos emular ciertos rasgos analógicos (color fósforo, potencial persistencia futura).

### Objetivo Evolutivo

1. Base Y–T estable (ventana + trigger opcional).
2. Modo XY para empezar a generar figuras (dos señales sintéticas o canales distintos).
3. Extender con capas artísticas: persistencia, desenfoque selectivo, modulación de intensidad, composición multi-señal.

### Modo Y–T vs Modo XY

| Aspecto | Y–T (Tiempo) | XY (Señal vs Señal) |
|---------|--------------|---------------------|
| X       | Tiempo       | Amplitud señal A    |
| Y       | Amplitud     | Amplitud señal B    |
| Uso     | Forma de onda| Figuras / Lissajous |
| Estabilidad | Trigger | Fase relativa       |

### Lienzo Hackeable

La arquitectura busca que cada "fuente" de datos pueda plugarse como señal A/B (audio, síntesis, datos externos) y que la capa de render permita overlays (grid, efectos, postprocesado) sin romper el núcleo conceptual.

## Fundamentos Audio Digital

### Sample Rate

Cantidad de muestras (samples) por segundo. Ejemplos comunes:

- 44.1 kHz (música / CD)
- 48 kHz (video / broadcast)
- 96 kHz / 192 kHz (producción alta fidelidad)

Un sample rate de 44.1 kHz significa 44,100 muestras cada segundo. Si muestras 10 ms en pantalla:

```text
10 ms = 0.010 s → 0.010 * 44,100 ≈ 441 samples
```

Esto define cuántos puntos tiene tu ventana de tiempo.

### Teorema de Nyquist

Frecuencia máxima reproducible ≈ sampleRate / 2.

- A 44.1 kHz → Nyquist ≈ 22.05 kHz.
- Cualquier contenido por encima se pliega (aliasing) si no se filtra.

Para visual: si intentas representar una señal que cambia más rápido que Nyquist, la forma se distorsiona.

### Buffers de Audio

El audio llega en bloques (frames) no de a una muestra. El `AnalyserNode` te entrega un array (FFT size) que representa un pequeño segmento temporal.

Patrón típico:

```typescript
const temp = new Float32Array(analyser.fftSize)
analyser.getFloatTimeDomainData(temp) // llena temp
// De temp seleccionas los últimos windowSize samples
```

Tu lógica convierte ese bloque en una ventana dibujable.

### Canales

- Mono (1 canal): ideal para modo Y–T (una sola amplitud vs tiempo).
- Stereo (2 canales: Left, Right): habilita modo XY (X = L, Y = R) → figuras de Lissajous.

Si sólo tienes mono pero quieres XY puedes sintetizar segunda señal (fase/frecuencia distinta).

### Amplitud

Valor instantáneo de la señal normalizado usualmente en rango [-1, 1].

- 0 = silencio / centro.
- 1 = máximo positivo.
- -1 = máximo negativo.

Mapeo vertical (mundo centrado): `y = a * (height/2) * amplitudeScale`.

### Clipping

Ocurre si la señal excede el rango permitido. Se recorta la cima y la forma se aplana.

En visual: se ve como picos "cortados" (línea plana en ±1). Puedes colorear esos segmentos para indicar saturación en futuras capas.

### Rango Dinámico y Auto-Escala

Señales muy pequeñas (p.ej. ±0.02) parecen una línea casi plana. Auto-escalar:

```typescript
function computeScale(buf: Float32Array, targetPeak = 0.9) {
  let peak = 0
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]))
  return peak === 0 ? 1 : targetPeak / peak
}
```

Filtrado suave para evitar saltos bruscos:

```typescript
let smooth = 1
function smoothScale(next: number, alpha = 0.2) {
  smooth = smooth + (next - smooth) * alpha
  return smooth
}
```

### Filtros (Futuro)

- Low-pass: atenúa altas frecuencias (suaviza curva).
- High-pass: elimina DC / bajas frecuencias (acentúa cambios rápidos).
- Band-pass / notch: aislar o remover bandas específicas.

En esta etapa se evita para mantener pureza de representación y menor complejidad. Se añadirá cuando quieras destacar trazas artísticas (ej. sólo componentes graves / agudas).

### Resumen Rápido

- Sample rate: determina densidad temporal.
- Nyquist: límites de frecuencia representable.
- Buffer: chunk periódico de muestras para construir ventana.
- Canales: habilitan Y–T (mono) y XY (stereo o síntesis).
- Amplitud: valor vertical, escala ajustable.
- Clipping: recorte del rango, puede resaltarse.
- Filtros: mejorar claridad / estética (fase futura).



## Componentes Conceptuales

### 1. **Señal**

- Una función que cambia en el tiempo
- En código: un array de valores (Float32Array)
- Ejemplo: audio → valores de -1 a 1
- Cada valor representa la amplitud en un momento

### 2. **Ejes**

#### **Eje X (horizontal) = TIEMPO**

```text
¿Cuándo? → Índice en el array
Para cada sample i en signal:
  x = (i / total_samples) * ancho_pantalla
```

#### **Eje Y (vertical) = AMPLITUD**

```text
¿Qué tan fuerte? → Valor de la señal
Para cada sample i en signal:
  y = signal[i] * escala_vertical
```

## Mapeo Básico (Código → Pantalla)

```typescript
// Tienes: Un array de valores
const signal: Float32Array = [0.0, 0.5, 0.8, 1.0, 0.8, 0.5, 0.0, ...]

// Quieres: Dibujar una línea en pantalla
for (let i = 0; i < signal.length; i++) {
  const x = (i / signal.length) * screenWidth  // TIEMPO
  const y = signal[i] * amplitudeScale         // AMPLITUD
  
  // Conectar (x, y) con el punto anterior → línea
}
```

## Relación FPS vs Sample Rate

### **Tu Visual (FPS)**

- Corre a ~60 FPS (frames por segundo)
- Cada frame redibuja la pantalla

### **Audio (Sample Rate)**

- 44,100 samples/segundo (CD quality)
- Mucho más rápido que FPS

### **Solución**

Cada frame:

1. Toma un "slice" de los últimos N samples
2. Dibuja esos N samples como una línea
3. En el siguiente frame, toma los siguientes N samples

```typescript
// Pseudo-código
const SAMPLES_PER_FRAME = 2048

function onFrame() {
  const slice = audioBuffer.slice(currentIndex, currentIndex + SAMPLES_PER_FRAME)
  drawWaveform(slice)
  currentIndex += SAMPLES_PER_FRAME
}
```

## Ventana de Tiempo (Time Window)

## 2.2 Mapeo de Datos a Pantalla

Esta sección detalla paso a paso cómo convertir (índice, amplitud) del buffer de audio en coordenadas X/Y del espacio de render (píxeles o unidades del mundo Three.js).

### Dominios

- Dominio de entrada (señal): tiempo discreto (índice i), amplitud a.
- Dominio de salida (pantalla): coordenada horizontal X, coordenada vertical Y.

### Selección de Ventana Temporal

Si deseas mostrar T milisegundos:

```typescript
function samplesForWindow(ms: number, sampleRate: number) {
  return Math.round(sampleRate * ms / 1000)
}

const sampleRate = 44100 // Hz
const windowMs = 10
const windowSamples = samplesForWindow(windowMs, sampleRate) // ≈ 441
```

Este `windowSamples` es N (tamaño de la ventana que se dibuja en un frame).

### Índice → X

Normaliza el índice a [0,1] y escala.

Si estás en coordenadas de píxeles (origen arriba-izquierda):

```typescript
const t = i / (N - 1)            // i en [0..N-1]
const x_px = t * width_px        // width_px = ancho del canvas en píxeles
```

Si estás en coordenadas centradas en Three.js (rango [-W/2, W/2]):

```typescript
const t = i / (N - 1)
const x_world = t * W - W / 2    // W = ancho en unidades del mundo
```

### Amplitud → Y

La amplitud bruta puede venir en:

- Float32 [-1, 1]
- PCM16 [-32768, 32767]

Primero normaliza a [-1,1] si es necesario:

```typescript
function normalizePcm16(raw: number) { return raw / 32768 }
```

Luego transforma.

Caso píxeles (origen arriba, Y crece hacia abajo):

```typescript
// Queremos 0 (silencio) en la línea central.
// a en [-1,1]
const y_px = (1 - (a + 1) / 2) * height_px
// Explicación:
// a=-1 → (1 - (0)/2) = 1 → y=height (parte inferior)
// a= 0 → (1 - (1)/2) = 0.5 → y=height/2 (centro)
// a= 1 → (1 - (2)/2) = 0   → y=0 (parte superior)
```

Caso mundo centrado (Three.js, centro en 0):

```typescript
const amplitudeScale = 1.0 // factor configurable
const y_world = a * (H / 2) * amplitudeScale // H = alto total en unidades
```

### Poniéndolo Junto

```typescript
for (let i = 0; i < N; i++) {
  const t = i / (N - 1)
  const x = t * W - W/2
  const a = signal[i]            // ya normalizado en [-1,1]
  const y = a * (H/2) * amplitudeScale
  // Push (x, y, 0) a la geometría
}
```

### Ejemplo Numérico

Mostrar 10 ms a 44.1 kHz:

```text
windowSamples = 441
i = 220 (punto medio temporal) → t ≈ 220 / 440 ≈ 0.5 → x ≈ W/2 - W/2 = 0 (centro)
signal[220] = 0.6 → y_world = 0.6 * (H/2) * amplitudeScale
```

### Escala de Amplitud Dinámica

Si la señal es muy pequeña (p. ej. ±0.05) puedes auto-ajustar:

```typescript
function autoScale(signal: Float32Array, targetPeak = 0.9) {
  let peak = 0
  for (let i = 0; i < signal.length; i++) peak = Math.max(peak, Math.abs(signal[i]))
  return peak === 0 ? 1 : (targetPeak / peak)
}

const amplitudeScale = autoScale(windowSlice)
```

Evita cambios bruscos filtrando exponencialmente:

```typescript
let smoothScale = 1
function updateScale(next: number) {
  const alpha = 0.15
  smoothScale = smoothScale + (next - smoothScale) * alpha
  return smoothScale
}
```

### Selección de la Ventana

Partiendo de un buffer circular:

```typescript
const start = (writeIndex - N + circular.length) % circular.length
for (let k = 0; k < N; k++) {
  windowSlice[k] = circular[(start + k) % circular.length]
}
```

### Trigger (Alineación Temporal)

Para señales periódicas, busca un cruce ascendente:

```typescript
function findRisingEdge(sig: Float32Array, level = 0) {
  for (let i = 1; i < sig.length; i++) {
    if (sig[i-1] < level && sig[i] >= level) return i
  }
  return 0
}

const edge = findRisingEdge(windowSlice)
const aligned = windowSlice.subarray(edge)
```

### Resumen Mapeo

- Tiempo: índice → normalizar → escalar a ancho.
- Amplitud: valor → normalizar → escalar a alto.
- Ventana define cuántos samples se dibujan (ms → samples).
- Trigger estabiliza la fase.
- AmplitudeScale ajusta la altura visual.


La señal completa puede ser enorme (stream continuo). No podemos ni necesitamos dibujarla toda simultáneamente.

En su lugar visualizamos una "ventana" (window) de tamaño fijo: por ejemplo 1024 samples.

### Concepto

```text
Stream continuo: [...............................................................]
Ventana actual:                [1024 samples]
Siguiente frame:                  [1024 samples]
```

Se desplaza la ventana conforme llega audio nuevo.

### Estrategias de ventana

- Últimos N samples (rolling tail)
- Segmento centrado en trigger (estabilizar forma)
- Recorrido cíclico (buffer circular)

### Buffer circular (idea base)

```typescript
const circular = new Float32Array(TOTAL_CAPACITY) // grande (p.e. 44100)
let writeIndex = 0

function pushSamples(chunk: Float32Array) {
  for (let i = 0; i < chunk.length; i++) {
    circular[writeIndex] = chunk[i]
    writeIndex = (writeIndex + 1) % circular.length
  }
}

function readWindow(windowSize: number): Float32Array {
  const out = new Float32Array(windowSize)
  let start = (writeIndex - windowSize + circular.length) % circular.length
  for (let i = 0; i < windowSize; i++) {
    const idx = (start + i) % circular.length
    out[i] = circular[idx]
  }
  return out
}
```

## Hook de Audio (implementado)

`useAudioWindow.ts` encapsula:

- Creación de `AudioContext` + `AnalyserNode`
- Captura de micrófono (fallback a oscilador)
- Extracción periódica de datos (`getFloatTimeDomainData`)
- Selección de los últimos `windowSize` samples
- Exposición de un `Float32Array` listo para dibujar


### Uso

```typescript
const signal = useAudioWindow({
  source: 'mic',       // o 'osc'
  windowSize: 1024,
  fftSize: 2048,
  frequency: 440       // fallback si no hay mic
})
```

### Patrón de re-render

Se limita la frecuencia de actualización (intervalo ~33ms) para no provocar 60 re-renders por segundo y mantener suave la visual.

## Trigger aplicado a la ventana

Para estabilizar formas periódicas (ej. onda seno) se puede buscar el punto donde cruza un nivel (rising edge) y alinear la ventana desde ahí:

```typescript
function alignWindowByTrigger(signal: Float32Array, level = 0) {
  const idx = findTriggerPoint(signal, level)
  return signal.subarray(idx)
}
```

## Resumen ampliado

- El osciloscopio NO dibuja toda la historia: sólo una ventana temporal.
- Sample rate >> FPS, así que siempre estamos "resumiendo".
- El índice del array es tiempo discreto; el valor es amplitud.
- Ventana = subconjunto móvil de samples.
- Trigger estabiliza la ventana visual.

## Ejemplo Práctico

### Entrada

```typescript
// Señal de prueba (4 samples)
const signal = Float32Array.from([0.0, 1.0, 0.0, -1.0])
```

### Salida Visual

```text
  Y
  ↑
 1│    •
  │   / \
 0│  •   •
  │       \
-1│        •
  └─────────→ X
    0 1 2 3
```

### Código

```typescript
// i=0: x=0, y=0   → punto (0, 0)
// i=1: x=1, y=1   → punto (1, 1)
// i=2: x=2, y=0   → punto (2, 0)
// i=3: x=3, y=-1  → punto (3, -1)
// Conectar puntos → línea
```

## Componente Actual: `Waveform.tsx`

```typescript
<Waveform
  signal={audioSamples}    // Array de valores
  width={8}                // Ancho de pantalla
  height={6}               // Alto de pantalla
  amplitudeScale={1.5}     // Escala Y (amplificar señal)
  color="#00ff00"          // Color verde fósforo
/>
```

### ¿Qué hace?

1. Recibe `signal` (array de amplitudes)
2. Calcula para cada índice `i` los puntos: `x = (i / length) * width` y `y = signal[i] * scale`
3. Conecta todos los puntos (x,y) como una línea
4. Renderiza en 3D con Three.js

## Próximos Pasos

## 2.3 Sincronización: Sample Rate vs Frame Rate

La diferencia entre la velocidad del audio (sample rate) y la visual (FPS) define cómo "avanza" la forma de onda en pantalla.

### Datos Clave

- Sample rate típico: 44,100 Hz (44100 samples/segundo)
- FPS típico: 60 frames/segundo
- 1 frame ≈ 16.67 ms
- Samples por frame ≈ 44100 * 0.01667 ≈ 735

Puedes decidir mostrar todos esos samples o sólo una fracción (p.ej. ventana fija de 1024). La elección define la estética y estabilidad.

### Dos Enfoques Mentales

#### 1. Rolling Oscilloscope

- El eje X representa el tiempo que pasa y la señal se desplaza hacia la izquierda.
- Conservas historia parcial: lo que estaba en X se mueve a X - Δx.
- Se agrega la "cola" nueva a la derecha.
- Similar a un monitor de logs en movimiento.

Implementación básica (shift + append):

```typescript
// geometryPositions: Float32Array [x0,y0,z0,x1,y1,z1,...]
function rollingUpdate(signalChunk: Float32Array) {
  const pointStride = 3
  const totalPoints = geometryPositions.length / pointStride
  const newPoints = signalChunk.length
  // Shift existente hacia la izquierda (en índices)
  const keep = totalPoints - newPoints
  geometryPositions.copyWithin(0, newPoints * pointStride) // descarta los más antiguos
  // Escribir nuevos al final
  for (let i = 0; i < newPoints; i++) {
    const t = i / (newPoints - 1)
    const x = (t * W) - W/2
    const y = signalChunk[i] * (H/2) * amplitudeScale
    const base = (keep + i) * pointStride
    geometryPositions[base] = x
    geometryPositions[base + 1] = y
    geometryPositions[base + 2] = 0
  }
  geometry.attributes.position.needsUpdate = true
}
```

Pros:

- Sensación de desplazamiento continuo.
- Muestra cierta historia.

Contras:

- Puede provocar estiramientos si la velocidad visual no coincide exacta con la temporal.
- Más costoso si el buffer es grande (copyWithin frecuente).

#### 2. Windowed Oscilloscope

- Siempre dibuja sólo la ventana más reciente (snapshot).
- La forma parece "estable" si el trigger alinea fase.
- No hay historia hacia atrás; sólo el presente (últimos N ms).

Implementación básica (reemplazo completo):

```typescript
function windowedUpdate(latestWindow: Float32Array) {
  const N = latestWindow.length
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    positions[i*3] = t * W - W/2
    positions[i*3 + 1] = latestWindow[i] * (H/2) * amplitudeScale
    positions[i*3 + 2] = 0
  }
  geometry.attributes.position.needsUpdate = true
}
```

Pros:

- Simplicidad y menor costo.
- Fácil de estabilizar con trigger.

Contras:

- No muestra historia.
- El movimiento es más "parpadeo de snapshot" si la señal cambia rápido.

### ¿Cuál usar en el POC?

Para el POC es suficiente "windowed": clara relación índice→X, amplitud→Y y actualización suave.

### Estrategias de Suavizado Temporal

1. Fijar tamaño de ventana (p.ej. 1024 samples) e interpolar si el chunk real es mayor.
2. Usar un intervalo de extracción estable (setInterval ~16–33 ms) para desacoplar jitter.
3. Aplicar trigger sólo cada cierto número de frames para evitar saltos excesivos.

### Jitter y Deriva

- Si cada frame tomas un número distinto de samples la forma "respira" (ancho variable).
- Solución: acumular samples reales y seleccionar exactamente N por frame (descartando o esperando si faltan).

```typescript
let accumulator = new Float32Array(4096)
let accWrite = 0
function push(samples: Float32Array) {
  for (let i = 0; i < samples.length; i++) {
    accumulator[accWrite++] = samples[i]
    if (accWrite >= accumulator.length) accWrite = 0 // wrap
  }
}
function takeWindow(N: number): Float32Array {
  const out = new Float32Array(N)
  let start = (accWrite - N + accumulator.length) % accumulator.length
  for (let i = 0; i < N; i++) out[i] = accumulator[(start + i) % accumulator.length]
  return out
}
```

### Resumen Sincronización

- Audio produce muchos más samples que frames.
- Debes elegir cómo convertir ~735 samples por frame en una visual consistente.
- Rolling = desplazamiento histórico; Windowed = snapshot actual.
- Para el inicio: Windowed + trigger opcional.
- Controlar N fijo y escala temporal evita jitter.


### 1. **Señal Estática → Animada**

Actualmente: señal fija (sine de 440Hz)

```typescript
const sineWave = createTestSignal('sine', 440, 0.1)
```

Siguiente: actualizar señal cada frame

```typescript
useFrame(() => {
  const newSignal = getAudioSamples() // Web Audio API
  updateWaveform(newSignal)
})
```

### 2. **Web Audio API**

```typescript
// Pseudocódigo
const audioContext = new AudioContext()
const analyser = audioContext.createAnalyser()
const dataArray = new Float32Array(analyser.fftSize)

function getAudioSamples() {
  analyser.getFloatTimeDomainData(dataArray)
  return dataArray
}
```

### 3. **Trigger (Estabilizar)**

Para que la señal no "salte":

```typescript
function findTriggerPoint(signal: Float32Array, level = 0) {
  for (let i = 1; i < signal.length; i++) {
    if (signal[i-1] < level && signal[i] >= level) {
      return i // Rising edge
    }
  }
  return 0
}
```

## Resumen General

**Pregunta clave respondida:**
> "Si tengo una lista de valores que representan la señal, ¿cómo los dibujo en pantalla como una línea que se mueve?"

**Respuesta:**

1. Cada valor → punto (x, y)
2. x = índice (tiempo)
3. y = valor (amplitud)
4. Conectar puntos → línea
5. Actualizar cada frame con nuevos valores
