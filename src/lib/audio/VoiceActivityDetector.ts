/**
 * Voice Activity Detection (VAD) for distinguishing speech/vocals from background noise
 * Uses energy-based detection with spectral features
 */

export interface VADConfig {
  energyThreshold: number;      // Energy threshold for voice detection (0-1)
  spectralThreshold: number;    // Spectral centroid threshold
  minVoiceDuration: number;     // Minimum ms for voice segment
  hangoverTime: number;         // ms to keep voice active after detection ends
  noiseFloor: number;          // Minimum energy level to consider
}

export interface VADResult {
  isVoice: boolean;
  energy: number;
  spectralCentroid: number;
  confidence: number;
}

export class VoiceActivityDetector {
  private config: VADConfig;
  private sampleRate: number;
  private fftSize: number;
  
  // State tracking
  private voiceStartTime: number = 0;
  private lastVoiceTime: number = 0;
  private isCurrentlyVoice: boolean = false;
  
  // Noise profiling
  private noiseEnergyHistory: number[] = [];
  private noiseSpectralHistory: number[] = [];
  private adaptiveEnergyThreshold: number;
  private adaptiveSpectralThreshold: number;
  
  // Analysis buffers
  private frequencyData: Float32Array;
  
  constructor(
    sampleRate: number,
    fftSize: number,
    config: Partial<VADConfig> = {}
  ) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    
    this.config = {
      energyThreshold: 0.02,
      spectralThreshold: 2000,
      minVoiceDuration: 100,
      hangoverTime: 200,
      noiseFloor: 0.001,
      ...config
    };
    
    this.adaptiveEnergyThreshold = this.config.energyThreshold;
    this.adaptiveSpectralThreshold = this.config.spectralThreshold;
    
    this.frequencyData = new Float32Array(fftSize / 2);
  }
  
  /**
   * Analyze audio frame for voice activity
   */
  analyze(
    timeData: Float32Array,
    frequencyData: Float32Array
  ): VADResult {
    const currentTime = Date.now();
    
    // Calculate energy features
    const energy = this.calculateEnergy(timeData);
    const spectralCentroid = this.calculateSpectralCentroid(frequencyData);
    
    // Basic thresholding
    const energyAboveThreshold = energy > this.adaptiveEnergyThreshold;
    const spectralInVoiceRange = spectralCentroid > 200 && spectralCentroid < 8000;
    
    // Combine features for initial detection
    let isVoiceCandidate = energyAboveThreshold && 
                          spectralInVoiceRange && 
                          energy > this.config.noiseFloor;
    
    // Apply temporal constraints
    if (isVoiceCandidate) {
      if (!this.isCurrentlyVoice) {
        // Starting new voice segment
        this.voiceStartTime = currentTime;
        this.isCurrentlyVoice = false; // Will be true only after min duration
      }
      this.lastVoiceTime = currentTime;
    }
    
    // Check if we've sustained voice long enough
    const voiceDuration = currentTime - this.voiceStartTime;
    const timeSinceLastVoice = currentTime - this.lastVoiceTime;
    
    let finalIsVoice = false;
    
    if (isVoiceCandidate && voiceDuration >= this.config.minVoiceDuration) {
      finalIsVoice = true;
      this.isCurrentlyVoice = true;
    } else if (this.isCurrentlyVoice && timeSinceLastVoice <= this.config.hangoverTime) {
      // Hangover period - keep voice active briefly after detection ends
      finalIsVoice = true;
    } else if (timeSinceLastVoice > this.config.hangoverTime) {
      this.isCurrentlyVoice = false;
    }
    
    // Update noise profile during non-voice periods
    if (!finalIsVoice && energy > this.config.noiseFloor) {
      this.updateNoiseProfile(energy, spectralCentroid);
    }
    
    // Calculate confidence based on feature strength
    const confidence = this.calculateConfidence(
      energy, 
      spectralCentroid, 
      energyAboveThreshold,
      spectralInVoiceRange
    );
    
    return {
      isVoice: finalIsVoice,
      energy,
      spectralCentroid,
      confidence
    };
  }
  
  /**
   * Calculate RMS energy of time domain signal
   */
  private calculateEnergy(timeData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      sum += timeData[i] * timeData[i];
    }
    return Math.sqrt(sum / timeData.length);
  }
  
  /**
   * Calculate spectral centroid (brightness measure)
   */
  private calculateSpectralCentroid(frequencyData: Float32Array): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    const frequencyResolution = this.sampleRate / (2 * frequencyData.length);
    
    for (let i = 1; i < frequencyData.length; i++) {
      const frequency = i * frequencyResolution;
      const magnitude = Math.abs(frequencyData[i]);
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }
  
  /**
   * Update adaptive thresholds based on background noise
   */
  private updateNoiseProfile(energy: number, spectralCentroid: number): void {
    // Keep rolling history of noise characteristics
    this.noiseEnergyHistory.push(energy);
    this.noiseSpectralHistory.push(spectralCentroid);
    
    // Limit history size
    const maxHistory = 100;
    if (this.noiseEnergyHistory.length > maxHistory) {
      this.noiseEnergyHistory.shift();
      this.noiseSpectralHistory.shift();
    }
    
    // Update adaptive thresholds
    if (this.noiseEnergyHistory.length > 10) {
      const avgNoiseEnergy = this.noiseEnergyHistory.reduce((a, b) => a + b, 0) / this.noiseEnergyHistory.length;
      const avgNoiseSpectral = this.noiseSpectralHistory.reduce((a, b) => a + b, 0) / this.noiseSpectralHistory.length;
      
      // Set threshold above noise floor
      this.adaptiveEnergyThreshold = Math.max(
        avgNoiseEnergy * 3, // 3x above noise floor
        this.config.energyThreshold
      );
      
      this.adaptiveSpectralThreshold = Math.max(
        avgNoiseSpectral * 1.5,
        this.config.spectralThreshold
      );
    }
  }
  
  /**
   * Calculate confidence score for voice detection
   */
  private calculateConfidence(
    energy: number,
    spectralCentroid: number,
    energyAboveThreshold: boolean,
    spectralInVoiceRange: boolean
  ): number {
    let confidence = 0;
    
    // Energy confidence (0-0.4)
    if (energyAboveThreshold) {
      const energyRatio = Math.min(energy / this.adaptiveEnergyThreshold, 10);
      confidence += Math.min(energyRatio * 0.04, 0.4);
    }
    
    // Spectral confidence (0-0.4)
    if (spectralInVoiceRange) {
      // Prefer spectral centroids in typical voice range (500-2000 Hz)
      const optimalRange = spectralCentroid >= 500 && spectralCentroid <= 2000;
      confidence += optimalRange ? 0.4 : 0.2;
    }
    
    // Temporal stability bonus (0-0.2)
    if (this.isCurrentlyVoice) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Reset VAD state (useful when switching audio sources)
   */
  reset(): void {
    this.voiceStartTime = 0;
    this.lastVoiceTime = 0;
    this.isCurrentlyVoice = false;
    this.noiseEnergyHistory = [];
    this.noiseSpectralHistory = [];
    this.adaptiveEnergyThreshold = this.config.energyThreshold;
    this.adaptiveSpectralThreshold = this.config.spectralThreshold;
  }
  
  /**
   * Update VAD configuration
   */
  updateConfig(newConfig: Partial<VADConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current adaptive thresholds (for debugging)
   */
  getThresholds(): { energy: number; spectral: number } {
    return {
      energy: this.adaptiveEnergyThreshold,
      spectral: this.adaptiveSpectralThreshold
    };
  }
}