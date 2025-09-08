/**
 * Vocal Isolation Processor
 * Combines Voice Activity Detection with Spectral Subtraction for robust vocal isolation
 */

import { VoiceActivityDetector, type VADConfig, type VADResult } from './VoiceActivityDetector.js';
import { SpectralSubtraction, type SpectralSubtractionConfig } from './SpectralSubtraction.js';

export interface VocalIsolationConfig {
  vad: Partial<VADConfig>;
  spectralSubtraction: Partial<SpectralSubtractionConfig>;
  enabled: boolean;
  bypassDuringVoice: boolean;  // Skip processing during voice to preserve quality
}

export interface VocalIsolationResult {
  processedAudio: Float32Array;
  vadResult: VADResult;
  noiseReductionApplied: boolean;
  noiseProfileReady: boolean;
}

export class VocalIsolationProcessor {
  private config: VocalIsolationConfig;
  private vad: VoiceActivityDetector;
  private spectralSubtraction: SpectralSubtraction;
  
  private sampleRate: number;
  private fftSize: number;
  
  // Analysis buffers
  private frequencyData: Float32Array;
  private analyser: AnalyserNode | null = null;
  
  // Performance monitoring
  private processedFrames: number = 0;
  private voiceFrames: number = 0;
  
  constructor(
    sampleRate: number,
    fftSize: number,
    config: Partial<VocalIsolationConfig> = {}
  ) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    
    this.config = {
      vad: {},
      spectralSubtraction: {},
      enabled: true,
      bypassDuringVoice: false, // Process during voice for better results
      ...config
    };
    
    // Initialize components
    this.vad = new VoiceActivityDetector(sampleRate, fftSize, this.config.vad);
    this.spectralSubtraction = new SpectralSubtraction(fftSize, this.config.spectralSubtraction);
    
    this.frequencyData = new Float32Array(fftSize / 2);
  }
  
  /**
   * Process audio frame for vocal isolation
   * @param timeData Input time domain audio
   * @param analyser Optional analyser node for frequency data
   * @returns Processing result with enhanced audio
   */
  process(
    timeData: Float32Array,
    analyser?: AnalyserNode
  ): VocalIsolationResult {
    this.processedFrames++;
    
    // If disabled, pass through unchanged
    if (!this.config.enabled) {
      return {
        processedAudio: new Float32Array(timeData),
        vadResult: {
          isVoice: false,
          energy: 0,
          spectralCentroid: 0,
          confidence: 0
        },
        noiseReductionApplied: false,
        noiseProfileReady: false
      };
    }
    
    // Get frequency domain data for VAD analysis
    if (analyser) {
      analyser.getFloatFrequencyData(this.frequencyData);
    } else {
      // Simple fallback - convert time to frequency domain
      this.calculateFrequencyData(timeData);
    }
    
    // Run voice activity detection
    const vadResult = this.vad.analyze(timeData, this.frequencyData);
    
    if (vadResult.isVoice) {
      this.voiceFrames++;
    }
    
    // Apply noise reduction
    let processedAudio: Float32Array;
    let noiseReductionApplied = false;
    
    if (this.config.bypassDuringVoice && vadResult.isVoice) {
      // Bypass processing during voice to preserve vocal quality
      processedAudio = new Float32Array(timeData);
    } else {
      // Apply spectral subtraction
      processedAudio = this.spectralSubtraction.process(timeData, vadResult.isVoice);
      noiseReductionApplied = true;
    }
    
    return {
      processedAudio,
      vadResult,
      noiseReductionApplied,
      noiseProfileReady: this.spectralSubtraction.isReady()
    };
  }
  
  /**
   * Simple frequency domain calculation for VAD when no analyser available
   */
  private calculateFrequencyData(timeData: Float32Array): void {
    // Basic magnitude spectrum calculation
    // This is a simplified approach - in production you'd use proper FFT
    
    const binSize = timeData.length / this.frequencyData.length;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      let sum = 0;
      const startIdx = Math.floor(i * binSize);
      const endIdx = Math.floor((i + 1) * binSize);
      
      for (let j = startIdx; j < endIdx && j < timeData.length; j++) {
        sum += Math.abs(timeData[j]);
      }
      
      this.frequencyData[i] = sum / (endIdx - startIdx);
    }
  }
  
  /**
   * Reset all processors (useful when changing audio source)
   */
  reset(): void {
    this.vad.reset();
    this.spectralSubtraction.resetNoiseProfile();
    this.processedFrames = 0;
    this.voiceFrames = 0;
    
    console.log('Vocal isolation processor reset');
  }
  
  /**
   * Force noise profile re-learning
   */
  resetNoiseProfile(): void {
    this.spectralSubtraction.resetNoiseProfile();
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VocalIsolationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.vad) {
      this.vad.updateConfig(newConfig.vad);
    }
    
    if (newConfig.spectralSubtraction) {
      this.spectralSubtraction.updateConfig(newConfig.spectralSubtraction);
    }
  }
  
  /**
   * Enable/disable vocal isolation
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    if (!enabled) {
      console.log('Vocal isolation disabled');
    } else {
      console.log('Vocal isolation enabled');
    }
  }
  
  /**
   * Check if vocal isolation is ready (noise profile established)
   */
  isReady(): boolean {
    return this.spectralSubtraction.isReady();
  }
  
  /**
   * Get performance statistics
   */
  getStats(): {
    processedFrames: number;
    voiceFrames: number;
    voiceActivity: number;
    noiseProfileReady: boolean;
  } {
    return {
      processedFrames: this.processedFrames,
      voiceFrames: this.voiceFrames,
      voiceActivity: this.processedFrames > 0 ? this.voiceFrames / this.processedFrames : 0,
      noiseProfileReady: this.spectralSubtraction.isReady()
    };
  }
  
  /**
   * Get current VAD thresholds (for debugging)
   */
  getVADThresholds(): { energy: number; spectral: number } {
    return this.vad.getThresholds();
  }
  
  /**
   * Get current noise profile (for analysis)
   */
  getNoiseProfile(): Float32Array {
    return this.spectralSubtraction.getNoiseProfile();
  }
}