/**
 * Spectral Flux Onset Detection
 * Detects note onsets by analyzing changes in frequency spectrum
 * More reliable than simple amplitude detection for musical signals
 */
class OnsetDetector {
    constructor(analyser, sampleRate) {
        this.analyser = analyser;
        this.sampleRate = sampleRate;
        this.bufferSize = analyser.frequencyBinCount;
        
        // Spectral analysis buffers
        this.currentSpectrum = new Float32Array(this.bufferSize);
        this.previousSpectrum = new Float32Array(this.bufferSize);
        this.spectralFlux = 0;
        
        // Onset detection parameters
        this.fluxThreshold = 0.02; // Minimum spectral flux for onset
        this.adaptiveThreshold = 0.05; // Dynamic threshold
        this.peakPickingThreshold = 0.6; // Peak picking factor
        
        // Adaptive thresholding
        this.fluxHistory = new Array(10).fill(0); // Rolling history for adaptive threshold
        this.historyIndex = 0;
        
        // Peak picking (to avoid multiple detections for same onset)
        this.lastOnsetTime = 0;
        this.minimumInterOnsetInterval = 100; // ms between onsets
        
        // Frequency weighting (emphasize mid frequencies for vocals)
        this.frequencyWeights = this.calculateFrequencyWeights();
        
        console.log('OnsetDetector initialized for spectral flux analysis');
    }
    
    calculateFrequencyWeights() {
        const weights = new Float32Array(this.bufferSize);
        const nyquist = this.sampleRate / 2;
        
        for (let i = 0; i < this.bufferSize; i++) {
            const freq = (i / this.bufferSize) * nyquist;
            
            // Weight curve: emphasize 200-2000Hz (vocal range)
            if (freq < 200) {
                weights[i] = freq / 200; // Linear rise
            } else if (freq < 2000) {
                weights[i] = 1.0; // Full weight
            } else if (freq < 4000) {
                weights[i] = 1.0 - ((freq - 2000) / 2000); // Linear fall
            } else {
                weights[i] = 0.1; // Minimal weight for high frequencies
            }
        }
        
        return weights;
    }
    
    /**
     * Detect onset in current audio frame
     * @returns {Object|null} - {timestamp, flux, confidence} or null if no onset
     */
    detectOnset() {
        const currentTime = Date.now();
        
        // Get current frequency spectrum
        this.analyser.getFloatFrequencyData(this.currentSpectrum);
        
        // Calculate spectral flux (sum of positive spectral differences)
        this.spectralFlux = this.calculateSpectralFlux();
        
        // Update adaptive threshold
        this.updateAdaptiveThreshold();
        
        // Check for onset using peak picking
        const isOnset = this.isOnsetPeak(currentTime);
        
        // Store current spectrum for next frame
        this.previousSpectrum.set(this.currentSpectrum);
        
        if (isOnset) {
            const confidence = Math.min(1.0, this.spectralFlux / (this.adaptiveThreshold * 2));
            
            return {
                timestamp: currentTime,
                flux: this.spectralFlux,
                confidence: confidence,
                threshold: this.adaptiveThreshold
            };
        }
        
        return null;
    }
    
    calculateSpectralFlux() {
        let flux = 0;
        
        for (let i = 1; i < this.bufferSize; i++) { // Skip DC component
            const currentMag = Math.max(-100, this.currentSpectrum[i]); // dB to linear-ish
            const previousMag = Math.max(-100, this.previousSpectrum[i]);
            
            // Convert from dB to linear scale for proper difference calculation
            const currentLin = Math.pow(10, currentMag / 20);
            const previousLin = Math.pow(10, previousMag / 20);
            
            // Only count positive changes (spectral energy increase)
            const diff = Math.max(0, currentLin - previousLin);
            
            // Apply frequency weighting
            flux += diff * this.frequencyWeights[i];
        }
        
        return flux;
    }
    
    updateAdaptiveThreshold() {
        // Add current flux to history
        this.fluxHistory[this.historyIndex] = this.spectralFlux;
        this.historyIndex = (this.historyIndex + 1) % this.fluxHistory.length;
        
        // Calculate adaptive threshold as median of recent flux values
        const sortedHistory = [...this.fluxHistory].sort((a, b) => a - b);
        const median = sortedHistory[Math.floor(sortedHistory.length / 2)];
        
        // Adaptive threshold is median plus offset
        this.adaptiveThreshold = Math.max(this.fluxThreshold, median * 1.5);
    }
    
    isOnsetPeak(currentTime) {
        // Check minimum time between onsets
        if (currentTime - this.lastOnsetTime < this.minimumInterOnsetInterval) {
            return false;
        }
        
        // Check if current flux exceeds adaptive threshold
        if (this.spectralFlux < this.adaptiveThreshold) {
            return false;
        }
        
        // Simple peak picking: current value should be higher than threshold factor
        const peakThreshold = this.adaptiveThreshold * this.peakPickingThreshold;
        
        if (this.spectralFlux > peakThreshold) {
            this.lastOnsetTime = currentTime;
            return true;
        }
        
        return false;
    }
    
    /**
     * Get current spectral flux value (for debugging)
     */
    getCurrentFlux() {
        return this.spectralFlux;
    }
    
    /**
     * Get adaptive threshold (for debugging)
     */
    getAdaptiveThreshold() {
        return this.adaptiveThreshold;
    }
    
    /**
     * Adjust onset sensitivity
     * @param {number} sensitivity - 0.1 (very sensitive) to 2.0 (less sensitive)
     */
    setSensitivity(sensitivity) {
        this.fluxThreshold = 0.02 * sensitivity;
        this.peakPickingThreshold = 0.6 / sensitivity;
        console.log(`Onset sensitivity set to ${sensitivity} (threshold: ${this.fluxThreshold})`);
    }
    
    /**
     * Set minimum time between onset detections
     */
    setMinInterOnsetInterval(intervalMs) {
        this.minimumInterOnsetInterval = Math.max(50, intervalMs);
    }
}