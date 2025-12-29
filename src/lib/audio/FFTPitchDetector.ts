/**
 * Simple FFT-based pitch detector
 * Uses Web Audio API's built-in FFT to find dominant frequency
 * Much more reliable for vocal input than autocorrelation
 */
import type { PitchDetectionResult } from './types.js';

export class FFTPitchDetector {
  private sampleRate: number;
  private bufferSize: number;
  private minFreq: number;
  private maxFreq: number;
  private frequencyBins: Float32Array;

  constructor(sampleRate: number, bufferSize: number = 4096) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.minFreq = 80;   // E2
    this.maxFreq = 1200; // D6

    // Pre-allocate frequency data array
    this.frequencyBins = new Float32Array(bufferSize / 2);

    console.log(`FFT Pitch Detector initialized: ${this.minFreq}-${this.maxFreq}Hz, FFT size: ${bufferSize}`);
  }

  detectPitch(analyser: AnalyserNode): PitchDetectionResult | null {
    // Get frequency domain data from the analyser
    analyser.getFloatFrequencyData(this.frequencyBins);

    // Calculate frequency resolution
    const frequencyResolution = this.sampleRate / (this.bufferSize);

    // Convert frequency range to bin indices
    const minBin = Math.floor(this.minFreq / frequencyResolution);
    const maxBin = Math.floor(this.maxFreq / frequencyResolution);

    // Find the bin with the highest magnitude in our frequency range
    let maxMagnitude = -Infinity;
    let dominantBin = -1;

    for (let bin = minBin; bin <= maxBin; bin++) {
      if (this.frequencyBins[bin] > maxMagnitude) {
        maxMagnitude = this.frequencyBins[bin];
        dominantBin = bin;
      }
    }

    // Check if we found a strong enough signal (very low threshold for testing)
    if (maxMagnitude < -80) { // Much lower threshold for testing
      console.log('❌ FFT: Signal too weak', maxMagnitude.toFixed(1) + 'dB');
      return null;
    }

    // Calculate the frequency
    const frequency = dominantBin * frequencyResolution;

    // Calculate confidence based on how much stronger the peak is than surrounding bins
    const confidence = this.calculateConfidence(dominantBin, maxMagnitude);

    console.log('🔍 FFT Debug:', {
      dominantBin: dominantBin,
      frequency: frequency.toFixed(1) + 'Hz',
      magnitude: maxMagnitude.toFixed(1) + 'dB',
      confidence: confidence.toFixed(3),
      frequencyResolution: frequencyResolution.toFixed(2) + 'Hz/bin'
    });

    // Return result if confidence is reasonable
    if (confidence > 0.1) {
      console.log('✅ FFT Success:', frequency.toFixed(1) + 'Hz');
      return {
        frequency,
        confidence,
        period: this.sampleRate / frequency
      };
    }

    console.log('❌ FFT: Low confidence', confidence.toFixed(3));
    return null;
  }

  private calculateConfidence(dominantBin: number, maxMagnitude: number): number {
    // Look at surrounding bins to calculate how distinct this peak is
    const windowSize = 3;
    let surroundingAverage = 0;
    let count = 0;

    for (let i = -windowSize; i <= windowSize; i++) {
      const bin = dominantBin + i;
      if (bin >= 0 && bin < this.frequencyBins.length && i !== 0) {
        surroundingAverage += this.frequencyBins[bin];
        count++;
      }
    }

    if (count === 0) return 0;

    surroundingAverage /= count;
    const peakStrength = maxMagnitude - surroundingAverage;

    // Normalize to 0-1 range
    return Math.min(Math.max(peakStrength / 20, 0), 1);
  }
}