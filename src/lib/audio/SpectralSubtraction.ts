/**
 * Spectral Subtraction for noise reduction in vocal isolation
 * Removes stationary background noise by subtracting estimated noise spectrum
 */

export interface SpectralSubtractionConfig {
  alpha: number;              // Over-subtraction factor (1.0-3.0)
  beta: number;               // Spectral floor factor (0.01-0.1) 
  noiseUpdateRate: number;    // How quickly to adapt noise estimate (0.01-0.1)
  noiseGateThreshold: number; // Energy threshold for noise estimation
  smoothingFactor: number;    // Temporal smoothing (0.1-0.9)
}

export class SpectralSubtraction {
  private config: SpectralSubtractionConfig;
  private fftSize: number;
  private binCount: number;
  
  // Noise estimation
  private noiseSpectrum: Float32Array;
  private isNoiseEstimated: boolean = false;
  private noiseFrameCount: number = 0;
  private readonly minNoiseFrames = 20; // Minimum frames to establish noise profile
  
  // Processing buffers
  private inputSpectrum: Float32Array;
  private outputSpectrum: Float32Array;
  private previousOutput: Float32Array;
  
  // Working buffers for FFT
  private realPart: Float32Array;
  private imagPart: Float32Array;
  private magnitude: Float32Array;
  private phase: Float32Array;
  
  constructor(
    fftSize: number,
    config: Partial<SpectralSubtractionConfig> = {}
  ) {
    this.fftSize = fftSize;
    this.binCount = fftSize / 2;
    
    this.config = {
      alpha: 2.0,              // Moderate over-subtraction
      beta: 0.05,              // 5% spectral floor
      noiseUpdateRate: 0.05,   // Slow noise adaptation
      noiseGateThreshold: 0.01, // Low energy threshold
      smoothingFactor: 0.7,    // Strong temporal smoothing
      ...config
    };
    
    // Initialize buffers
    this.noiseSpectrum = new Float32Array(this.binCount);
    this.inputSpectrum = new Float32Array(this.binCount);
    this.outputSpectrum = new Float32Array(this.binCount);
    this.previousOutput = new Float32Array(this.binCount);
    
    this.realPart = new Float32Array(this.binCount);
    this.imagPart = new Float32Array(this.binCount);
    this.magnitude = new Float32Array(this.binCount);
    this.phase = new Float32Array(this.binCount);
  }
  
  /**
   * Process audio frame for noise reduction
   * @param timeData Input time domain audio data
   * @param isVoiceActive Whether voice is currently detected (from VAD)
   * @returns Processed time domain audio data
   */
  process(timeData: Float32Array, isVoiceActive: boolean): Float32Array {
    // Forward FFT to frequency domain
    this.forwardFFT(timeData);
    
    // Calculate magnitude spectrum
    for (let i = 0; i < this.binCount; i++) {
      this.magnitude[i] = Math.sqrt(
        this.realPart[i] * this.realPart[i] + 
        this.imagPart[i] * this.imagPart[i]
      );
      this.phase[i] = Math.atan2(this.imagPart[i], this.realPart[i]);
      this.inputSpectrum[i] = this.magnitude[i];
    }
    
    // Update noise estimate during non-voice periods
    if (!isVoiceActive) {
      this.updateNoiseEstimate();
    }
    
    // Apply spectral subtraction if noise profile is ready
    if (this.isNoiseEstimated) {
      this.applySpectralSubtraction();
    } else {
      // Pass through unmodified if no noise profile yet
      this.outputSpectrum.set(this.inputSpectrum);
    }
    
    // Apply temporal smoothing
    this.applyTemporalSmoothing();
    
    // Convert back to time domain
    const output = this.inverseFFT();
    
    return output;
  }
  
  /**
   * Update noise spectrum estimate during quiet periods
   */
  private updateNoiseEstimate(): void {
    // Calculate current frame energy
    const frameEnergy = this.calculateFrameEnergy();
    
    // Only update if energy is low enough (indicates background noise)
    if (frameEnergy < this.config.noiseGateThreshold) {
      if (this.noiseFrameCount < this.minNoiseFrames) {
        // Initial noise learning phase - average incoming spectra
        const weight = 1.0 / (this.noiseFrameCount + 1);
        for (let i = 0; i < this.binCount; i++) {
          this.noiseSpectrum[i] = 
            (1 - weight) * this.noiseSpectrum[i] + 
            weight * this.inputSpectrum[i];
        }
        this.noiseFrameCount++;
        
        if (this.noiseFrameCount >= this.minNoiseFrames) {
          this.isNoiseEstimated = true;
          console.log('Noise profile established after', this.noiseFrameCount, 'frames');
        }
      } else {
        // Continuous adaptation during quiet periods
        for (let i = 0; i < this.binCount; i++) {
          this.noiseSpectrum[i] = 
            (1 - this.config.noiseUpdateRate) * this.noiseSpectrum[i] + 
            this.config.noiseUpdateRate * this.inputSpectrum[i];
        }
      }
    }
  }
  
  /**
   * Apply spectral subtraction algorithm
   */
  private applySpectralSubtraction(): void {
    for (let i = 0; i < this.binCount; i++) {
      const signalMag = this.inputSpectrum[i];
      const noiseMag = this.noiseSpectrum[i];
      
      // Basic spectral subtraction
      let enhancedMag = signalMag - this.config.alpha * noiseMag;
      
      // Apply spectral floor to prevent over-subtraction artifacts
      const spectralFloor = this.config.beta * signalMag;
      enhancedMag = Math.max(enhancedMag, spectralFloor);
      
      // Additional safety: never go below noise floor
      enhancedMag = Math.max(enhancedMag, noiseMag * 0.1);
      
      this.outputSpectrum[i] = enhancedMag;
    }
  }
  
  /**
   * Apply temporal smoothing to reduce musical noise artifacts
   */
  private applyTemporalSmoothing(): void {
    const smoothing = this.config.smoothingFactor;
    
    for (let i = 0; i < this.binCount; i++) {
      this.outputSpectrum[i] = 
        smoothing * this.previousOutput[i] + 
        (1 - smoothing) * this.outputSpectrum[i];
    }
    
    // Store for next frame
    this.previousOutput.set(this.outputSpectrum);
  }
  
  /**
   * Calculate total energy of current frame
   */
  private calculateFrameEnergy(): number {
    let energy = 0;
    for (let i = 0; i < this.binCount; i++) {
      energy += this.inputSpectrum[i] * this.inputSpectrum[i];
    }
    return Math.sqrt(energy / this.binCount);
  }
  
  /**
   * Simple FFT implementation for frequency domain conversion
   */
  private forwardFFT(timeData: Float32Array): void {
    // For simplicity, using a basic DFT approach
    // In production, you'd use a proper FFT library like KissFFT or similar
    
    for (let k = 0; k < this.binCount; k++) {
      let realSum = 0;
      let imagSum = 0;
      
      for (let n = 0; n < timeData.length; n++) {
        const angle = -2 * Math.PI * k * n / timeData.length;
        realSum += timeData[n] * Math.cos(angle);
        imagSum += timeData[n] * Math.sin(angle);
      }
      
      this.realPart[k] = realSum;
      this.imagPart[k] = imagSum;
    }
  }
  
  /**
   * Inverse FFT to convert back to time domain
   */
  private inverseFFT(): Float32Array {
    const output = new Float32Array(this.fftSize);
    
    // Reconstruct complex spectrum with modified magnitudes
    const complexReal = new Float32Array(this.binCount);
    const complexImag = new Float32Array(this.binCount);
    
    for (let i = 0; i < this.binCount; i++) {
      const newMagnitude = this.outputSpectrum[i];
      const originalPhase = this.phase[i];
      
      complexReal[i] = newMagnitude * Math.cos(originalPhase);
      complexImag[i] = newMagnitude * Math.sin(originalPhase);
    }
    
    // Simple IDFT
    for (let n = 0; n < output.length; n++) {
      let realSum = 0;
      let imagSum = 0;
      
      for (let k = 0; k < this.binCount; k++) {
        const angle = 2 * Math.PI * k * n / output.length;
        realSum += complexReal[k] * Math.cos(angle) - complexImag[k] * Math.sin(angle);
        imagSum += complexReal[k] * Math.sin(angle) + complexImag[k] * Math.cos(angle);
      }
      
      output[n] = realSum / output.length;
    }
    
    return output;
  }
  
  /**
   * Force noise re-estimation (useful when environment changes)
   */
  resetNoiseProfile(): void {
    this.isNoiseEstimated = false;
    this.noiseFrameCount = 0;
    this.noiseSpectrum.fill(0);
    this.previousOutput.fill(0);
    console.log('Noise profile reset');
  }
  
  /**
   * Check if noise profile is established
   */
  isReady(): boolean {
    return this.isNoiseEstimated;
  }
  
  /**
   * Update configuration parameters
   */
  updateConfig(newConfig: Partial<SpectralSubtractionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current noise profile (for analysis/debugging)
   */
  getNoiseProfile(): Float32Array {
    return new Float32Array(this.noiseSpectrum);
  }
}