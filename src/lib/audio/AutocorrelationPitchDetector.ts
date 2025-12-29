/**
 * Simple and reliable autocorrelation-based pitch detector
 * Often more accurate than YIN for vocal input
 */
import type { PitchDetectionResult } from './types.js';

export class AutocorrelationPitchDetector {
  private sampleRate: number;
  private bufferSize: number;
  private minFreq: number;
  private maxFreq: number;
  private maxPeriod: number;
  private minPeriod: number;

  constructor(sampleRate: number, bufferSize: number = 4096) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.minFreq = 80;   // E2
    this.maxFreq = 800;  // G5 - optimal vocal range

    this.maxPeriod = Math.floor(this.sampleRate / this.minFreq);
    this.minPeriod = Math.floor(this.sampleRate / this.maxFreq);

    console.log(`Autocorrelation initialized: ${this.minFreq}-${this.maxFreq}Hz, periods ${this.minPeriod}-${this.maxPeriod}`);
  }

  detectPitch(audioBuffer: Float32Array): PitchDetectionResult | null {
    if (audioBuffer.length < this.bufferSize) {
      return null;
    }

    // Check signal level
    const rms = Math.sqrt(audioBuffer.reduce((sum, x) => sum + x * x, 0) / audioBuffer.length);
    console.log('🔍 Autocorr Signal Level:', rms.toFixed(4));

    if (rms < 0.002) { // Reasonable threshold to allow vocal detection
      console.log('❌ Autocorr: Signal too quiet');
      return null;
    }

    // Normalize the signal
    const normalized = this.normalizeSignal(audioBuffer);

    // Calculate autocorrelation
    const autocorrelation = this.calculateAutocorrelation(normalized);

    // Find the best period
    const period = this.findBestPeriod(autocorrelation);

    console.log('🔍 Autocorr Period Search:', {
      foundPeriod: period,
      minPeriod: this.minPeriod,
      maxPeriod: this.maxPeriod,
      autocorrLength: autocorrelation.length
    });

    if (period === -1) {
      console.log('❌ Autocorr: No valid period found');
      return null;
    }

    const frequency = this.sampleRate / period;
    const confidence = autocorrelation[period];

    // Validate frequency range
    if (frequency < this.minFreq || frequency > this.maxFreq) {
      return null;
    }

    // Confidence threshold for reliable pitch detection (increased from 0.1 to 0.3)
    const CONFIDENCE_THRESHOLD = 0.3;

    // Add debug info before confidence check
    console.log('🔍 Autocorr Before Confidence Check:', {
      period: period,
      frequency: frequency.toFixed(1) + 'Hz',
      confidence: confidence.toFixed(3),
      rms: rms.toFixed(4),
      confThreshold: CONFIDENCE_THRESHOLD
    });

    // Reject low-confidence detections to reduce noise
    if (confidence < CONFIDENCE_THRESHOLD) {
      console.log('❌ Autocorr: Low confidence:', confidence.toFixed(3));
      return null;
    }

    console.log('✅ Autocorrelation Success:', {
      period: period,
      frequency: frequency.toFixed(1) + 'Hz',
      confidence: confidence.toFixed(3),
      rms: rms.toFixed(4)
    });

    return {
      frequency,
      confidence,
      period
    };
  }

  private normalizeSignal(buffer: Float32Array): Float32Array {
    const result = new Float32Array(buffer.length);
    let sum = 0;

    // Calculate mean
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i];
    }
    const mean = sum / buffer.length;

    // Remove DC offset and normalize
    let maxAbs = 0;
    for (let i = 0; i < buffer.length; i++) {
      result[i] = buffer[i] - mean;
      maxAbs = Math.max(maxAbs, Math.abs(result[i]));
    }

    // Normalize to [-1, 1]
    if (maxAbs > 0) {
      for (let i = 0; i < result.length; i++) {
        result[i] /= maxAbs;
      }
    }

    return result;
  }

  private calculateAutocorrelation(buffer: Float32Array): Float32Array {
    const autocorr = new Float32Array(this.maxPeriod);

    for (let lag = this.minPeriod; lag < this.maxPeriod; lag++) {
      let sum = 0;
      let count = 0;

      for (let i = 0; i < buffer.length - lag; i++) {
        sum += buffer[i] * buffer[i + lag];
        count++;
      }

      autocorr[lag] = sum / count;
    }

    // Normalize by autocorrelation at lag 0
    const normalizationFactor = autocorr[0] || 1;
    for (let i = 0; i < autocorr.length; i++) {
      autocorr[i] /= normalizationFactor;
    }

    return autocorr;
  }

  private findBestPeriod(autocorr: Float32Array): number {
    let bestPeriod = -1;
    let bestValue = 0;
    let peakCount = 0;

    // Find the highest peak in the autocorrelation
    for (let period = this.minPeriod; period < this.maxPeriod; period++) {
      if (autocorr[period] > bestValue) {
        // Check if this is a local maximum
        if (period > this.minPeriod && period < this.maxPeriod - 1) {
          if (autocorr[period] > autocorr[period - 1] &&
              autocorr[period] > autocorr[period + 1]) {
            bestValue = autocorr[period];
            bestPeriod = period;
            peakCount++;
          }
        } else {
          bestValue = autocorr[period];
          bestPeriod = period;
          peakCount++;
        }
      }
    }

    console.log('🔍 Autocorr Peak Search:', {
      bestPeriod: bestPeriod,
      bestValue: bestValue.toFixed(3),
      peakCount: peakCount,
      threshold: 0.1,
      willAccept: bestValue > 0.1
    });

    // Reasonable threshold for vocal input detection
    if (bestValue > 0.1) { // Lower threshold to allow actual vocal detection
      return bestPeriod;
    }

    return -1;
  }
}