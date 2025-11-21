/**
 * Signal Generator for Oscilloscope Test Waveforms
 * Generates Float32Array buffers representing various test signals
 */

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise'

export interface SignalConfig {
  frequency: number // Hz
  amplitude: number // Volts (normalized -1 to 1)
  phase: number // Radians
  offset: number // DC offset
  sampleRate: number // Samples per second
  duration: number // Seconds
}

export class SignalGenerator {
  // Generate a sine wave
  generateSine(config: SignalConfig): Float32Array {
    const samples = Math.floor(config.sampleRate * config.duration)
    const buffer = new Float32Array(samples)
    const angularFreq = 2 * Math.PI * config.frequency

    for (let i = 0; i < samples; i++) {
      const t = i / config.sampleRate
      buffer[i] =
        config.amplitude * Math.sin(angularFreq * t + config.phase) +
        config.offset
    }

    return buffer
  }

  // Generate a square wave
  generateSquare(config: SignalConfig): Float32Array {
    const samples = Math.floor(config.sampleRate * config.duration)
    const buffer = new Float32Array(samples)
    const period = 1 / config.frequency

    for (let i = 0; i < samples; i++) {
      const t = i / config.sampleRate
      const phaseTime = (t + config.phase / (2 * Math.PI)) % period
      buffer[i] =
        config.amplitude * (phaseTime < period / 2 ? 1 : -1) + config.offset
    }

    return buffer
  }

  // Generate a sawtooth wave
  generateSawtooth(config: SignalConfig): Float32Array {
    const samples = Math.floor(config.sampleRate * config.duration)
    const buffer = new Float32Array(samples)
    const period = 1 / config.frequency

    for (let i = 0; i < samples; i++) {
      const t = i / config.sampleRate
      const phaseTime = (t + config.phase / (2 * Math.PI)) % period
      buffer[i] =
        config.amplitude * (2 * (phaseTime / period) - 1) + config.offset
    }

    return buffer
  }

  // Generate a triangle wave
  generateTriangle(config: SignalConfig): Float32Array {
    const samples = Math.floor(config.sampleRate * config.duration)
    const buffer = new Float32Array(samples)
    const period = 1 / config.frequency

    for (let i = 0; i < samples; i++) {
      const t = i / config.sampleRate
      const phaseTime = (t + config.phase / (2 * Math.PI)) % period
      const normalized = phaseTime / period
      buffer[i] =
        config.amplitude * (normalized < 0.5 ? 4 * normalized - 1 : 3 - 4 * normalized) +
        config.offset
    }

    return buffer
  }

  // Generate white noise
  generateNoise(config: SignalConfig): Float32Array {
    const samples = Math.floor(config.sampleRate * config.duration)
    const buffer = new Float32Array(samples)

    for (let i = 0; i < samples; i++) {
      buffer[i] = config.amplitude * (Math.random() * 2 - 1) + config.offset
    }

    return buffer
  }

  // Generate waveform by type
  generate(type: WaveformType, config: SignalConfig): Float32Array {
    switch (type) {
      case 'sine':
        return this.generateSine(config)
      case 'square':
        return this.generateSquare(config)
      case 'sawtooth':
        return this.generateSawtooth(config)
      case 'triangle':
        return this.generateTriangle(config)
      case 'noise':
        return this.generateNoise(config)
      default:
        return this.generateSine(config)
    }
  }

  // Apply simple rising-edge trigger
  findTriggerPoint(
    buffer: Float32Array,
    level: number = 0,
    edge: 'rising' | 'falling' = 'rising'
  ): number {
    for (let i = 1; i < buffer.length; i++) {
      if (edge === 'rising') {
        if (buffer[i - 1] < level && buffer[i] >= level) {
          return i
        }
      } else {
        if (buffer[i - 1] > level && buffer[i] <= level) {
          return i
        }
      }
    }
    return 0
  }
}

// Helper function for quick signal generation
export function createTestSignal(
  type: WaveformType = 'sine',
  frequency: number = 440,
  duration: number = 0.1
): Float32Array {
  const generator = new SignalGenerator()
  return generator.generate(type, {
    frequency,
    amplitude: 0.8,
    phase: 0,
    offset: 0,
    sampleRate: 44100,
    duration,
  })
}
