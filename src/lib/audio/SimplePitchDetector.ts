/**
 * Dead simple pitch detector - just finds loudest frequency
 * No fancy algorithms, no complex math, just basic FFT peak finding
 */
import type { PitchDetectionResult } from './types.js';

export class SimplePitchDetector {
  private sampleRate: number;
  private bufferSize: number;
  private frequencyData: Uint8Array;
  private stabilityBuffer: { frequency: number; confidence: number; timestamp: number }[];
  private readonly stabilityFrames = 1; // Immediate response for testing
  private readonly stabilityTolerance = 30; // Hz tolerance for "same" frequency

  constructor(sampleRate: number, bufferSize: number = 4096) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.frequencyData = new Uint8Array(bufferSize / 2);
    this.stabilityBuffer = [];

    console.log(`Simple Pitch Detector: ${sampleRate}Hz, ${bufferSize} samples`);
  }

  detectPitch(analyser: AnalyserNode): PitchDetectionResult | null {
    // Get frequency data (0-255 values)
    analyser.getByteFrequencyData(this.frequencyData);

    // Reasonable threshold for actual vocal input
    const threshold = 120; // Lowered to detect actual voice

    // Find the loudest frequency
    let maxValue = 0;
    let loudestBin = 0;

    const minBin = 10; // Skip very low frequencies (noise)
    const maxBin = Math.min(this.frequencyData.length, 300); // Only check up to ~3.6kHz

    // Log spectrum data to understand what's happening
    const strongBins = [];
    for (let i = minBin; i < maxBin; i++) {
      if (this.frequencyData[i] > maxValue) {
        maxValue = this.frequencyData[i];
        loudestBin = i;
      }
      // Collect all bins above a lower threshold for analysis
      if (this.frequencyData[i] > 150) {
        const freq = (i * this.sampleRate / this.bufferSize).toFixed(1);
        strongBins.push(`${freq}Hz:${this.frequencyData[i]}`);
      }
    }

    // Log spectrum analysis every few seconds
    if (Date.now() % 3000 < 100) { // Every ~3 seconds
      console.log('📊 Spectrum Analysis:', {
        loudest: `${loudestBin}bin=${(loudestBin * this.sampleRate / this.bufferSize).toFixed(1)}Hz:${maxValue}`,
        threshold: threshold,
        allStrongBins: strongBins.slice(0, 10), // Top 10 to avoid spam
        decision: maxValue >= threshold ? 'WILL_PROCESS' : 'WILL_REJECT'
      });
    }

    // Simple threshold check - no complex noise floor logic
    if (maxValue < threshold) {
      // Clear stability buffer if signal is too weak
      this.stabilityBuffer = [];
      return null;
    }

    // Calculate frequency
    const frequencyResolution = this.sampleRate / this.bufferSize;
    const frequency = loudestBin * frequencyResolution;
    const confidence = maxValue / 255;
    const currentTime = Date.now();

    // Add to stability buffer
    this.stabilityBuffer.push({
      frequency,
      confidence,
      timestamp: currentTime
    });

    // Remove old entries (older than 500ms)
    this.stabilityBuffer = this.stabilityBuffer.filter(
      entry => currentTime - entry.timestamp < 500
    );

    // Check for pitch stability
    const stableResult = this.checkPitchStability();

    if (stableResult) {
      console.log('🎯 Stable Pitch Detected:', {
        frequency: stableResult.frequency.toFixed(1) + 'Hz',
        confidence: stableResult.confidence.toFixed(3),
        frames: this.stabilityBuffer.length + '/' + this.stabilityFrames
      });
      return stableResult;
    }

    // Log transient detection but don't return it
    console.log('⚡ Transient (unstable):', {
      frequency: frequency.toFixed(1) + 'Hz',
      frames: this.stabilityBuffer.length + '/' + this.stabilityFrames
    });

    return null;
  }

  private checkPitchStability(): PitchDetectionResult | null {
    // Need at least the required number of frames
    if (this.stabilityBuffer.length < this.stabilityFrames) {
      return null;
    }

    // Check if all recent frequencies are within tolerance
    const recentFrames = this.stabilityBuffer.slice(-this.stabilityFrames);
    const referenceFreq = recentFrames[0].frequency;

    for (const frame of recentFrames) {
      if (Math.abs(frame.frequency - referenceFreq) > this.stabilityTolerance) {
        return null; // Not stable enough
      }
    }

    // Calculate average frequency and confidence from stable frames
    const avgFrequency = recentFrames.reduce((sum, frame) => sum + frame.frequency, 0) / recentFrames.length;
    const avgConfidence = recentFrames.reduce((sum, frame) => sum + frame.confidence, 0) / recentFrames.length;

    return {
      frequency: avgFrequency,
      confidence: avgConfidence,
      period: this.sampleRate / avgFrequency
    };
  }
}