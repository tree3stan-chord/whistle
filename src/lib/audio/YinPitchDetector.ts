/**
 * YIN Algorithm for fundamental frequency estimation
 * TypeScript implementation based on: "YIN, a fundamental frequency estimator for speech and music" 
 * by Alain de Cheveigné and Hideki Kawahara (2002)
 */
import type { PitchDetectionResult, YinConfig } from './types.js';

export class YinPitchDetector {
  private sampleRate: number;
  private bufferSize: number;
  private threshold: number;
  private minFreq: number;
  private maxFreq: number;
  private maxPeriod: number;
  private minPeriod: number;
  private yinBuffer: Float32Array;
  private probabilityBuffer: Float32Array;

  constructor(sampleRate: number, bufferSize: number = 2048, config?: Partial<YinConfig>) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.threshold = config?.threshold ?? 0.1;
    
    // Frequency range constraints (human vocal range + instruments)
    this.minFreq = config?.minFreq ?? 60;   // ~B1
    this.maxFreq = config?.maxFreq ?? 2000; // ~B6
    
    // Calculate period bounds from frequency range
    this.maxPeriod = Math.floor(this.sampleRate / this.minFreq);
    this.minPeriod = Math.floor(this.sampleRate / this.maxFreq);
    
    // Pre-allocate arrays for performance
    this.yinBuffer = new Float32Array(this.maxPeriod);
    this.probabilityBuffer = new Float32Array(this.maxPeriod);
    
    console.log(`YIN initialized: ${this.minFreq}-${this.maxFreq}Hz, periods ${this.minPeriod}-${this.maxPeriod}`);
  }

  /**
   * Main YIN pitch detection method
   */
  detectPitch(audioBuffer: Float32Array): PitchDetectionResult | null {
    if (audioBuffer.length < this.bufferSize) {
      return null;
    }
    
    // Step 1: Calculate difference function
    this.calculateDifferenceFunction(audioBuffer);
    
    // Step 2: Calculate cumulative mean normalized difference function (CMNDF)
    this.calculateCMNDF();
    
    // Step 3: Get absolute threshold
    const tauEst = this.absoluteThreshold();
    
    if (tauEst === -1) {
      return null; // No reliable period found
    }
    
    // Step 4: Parabolic interpolation for sub-sample accuracy
    const betterTau = this.parabolicInterpolation(tauEst);
    
    // Calculate frequency and confidence
    const frequency = this.sampleRate / betterTau;
    const confidence = 1 - this.yinBuffer[tauEst];
    
    // Validate frequency is in expected range
    if (frequency < this.minFreq || frequency > this.maxFreq) {
      return null;
    }
    
    return {
      frequency,
      confidence,
      period: betterTau
    };
  }

  /**
   * Step 1: Calculate the squared difference function
   * d_t(tau) = sum((x_j - x_{j+tau})^2)
   */
  private calculateDifferenceFunction(audioBuffer: Float32Array): void {
    let delta: number;
    
    // Calculate for each possible period (tau)
    for (let tau = 0; tau < this.maxPeriod; tau++) {
      this.yinBuffer[tau] = 0;
      
      for (let i = 0; i < this.maxPeriod; i++) {
        if (i + tau < audioBuffer.length) {
          delta = audioBuffer[i] - audioBuffer[i + tau];
          this.yinBuffer[tau] += delta * delta;
        }
      }
    }
  }

  /**
   * Step 2: Calculate Cumulative Mean Normalized Difference Function
   * d'_t(tau) = d_t(tau) / [(1/tau) * sum(d_t(j)) for j=1 to tau]
   */
  private calculateCMNDF(): void {
    this.yinBuffer[0] = 1.0; // Special case for tau = 0
    
    let runningSum = 0;
    for (let tau = 1; tau < this.maxPeriod; tau++) {
      runningSum += this.yinBuffer[tau];
      
      if (runningSum === 0) {
        this.yinBuffer[tau] = 1.0;
      } else {
        this.yinBuffer[tau] = this.yinBuffer[tau] * tau / runningSum;
      }
    }
  }

  /**
   * Step 3: Find the absolute threshold
   * Returns the first tau where d'_t(tau) < threshold
   */
  private absoluteThreshold(): number {
    // Start from minPeriod to avoid sub-harmonic detection
    for (let tau = this.minPeriod; tau < this.maxPeriod; tau++) {
      if (this.yinBuffer[tau] < this.threshold) {
        // Look for local minimum in the next few samples
        while (tau + 1 < this.maxPeriod && this.yinBuffer[tau + 1] < this.yinBuffer[tau]) {
          tau++;
        }
        return tau;
      }
    }
    return -1; // No period found below threshold
  }

  /**
   * Step 4: Parabolic interpolation for sub-sample accuracy
   */
  private parabolicInterpolation(tauEst: number): number {
    if (tauEst === 0 || tauEst === this.maxPeriod - 1) {
      return tauEst;
    }
    
    const s0 = this.yinBuffer[tauEst - 1];
    const s1 = this.yinBuffer[tauEst];
    const s2 = this.yinBuffer[tauEst + 1];
    
    // Parabolic interpolation formula
    const a = (s0 - 2 * s1 + s2) / 2;
    const b = (s2 - s0) / 2;
    
    if (a !== 0) {
      return tauEst - b / (2 * a);
    }
    
    return tauEst;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<YinConfig>): void {
    if (config.threshold !== undefined) {
      this.threshold = config.threshold;
    }
    if (config.minFreq !== undefined) {
      this.minFreq = config.minFreq;
      this.maxPeriod = Math.floor(this.sampleRate / this.minFreq);
    }
    if (config.maxFreq !== undefined) {
      this.maxFreq = config.maxFreq;
      this.minPeriod = Math.floor(this.sampleRate / this.maxFreq);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): YinConfig {
    return {
      threshold: this.threshold,
      probabilityThreshold: 0.9, // Not currently used but part of interface
      minFreq: this.minFreq,
      maxFreq: this.maxFreq
    };
  }
}