/**
 * Spectral Analyzer - Advanced timbre and harmonic analysis
 * Part of the Forensic Audio Analysis Engine
 */

class SpectralAnalyzer {
    constructor(audioContext, config = {}) {
        this.audioContext = audioContext;
        this.sampleRate = audioContext.sampleRate;
        this.config = config;
        
        // Initialize analysis buffers and windows
        this.windowSize = config.windowSize || 4096;
        this.hannWindow = this.createHannWindow(this.windowSize);
        
        console.log('Spectral Analyzer initialized');
    }
    
    /**
     * Perform comprehensive spectral analysis
     */
    analyze(audioBuffer) {
        try {
            // Apply window function to reduce spectral leakage
            const windowedBuffer = this.applyWindow(audioBuffer, this.hannWindow);
            
            // Compute FFT
            const fftData = this.computeFFT(windowedBuffer);
            const magnitudes = this.computeMagnitudes(fftData);
            
            // Calculate spectral centroid (brightness measure)
            const spectralCentroid = this.calculateSpectralCentroid(magnitudes);
            
            // Extract harmonic profile (fundamental + harmonics)
            const harmonicProfile = this.extractHarmonicProfile(magnitudes, 440); // TODO: Use actual fundamental
            
            // Extract formants (vocal tract resonances)
            const formants = this.extractFormants(magnitudes);
            
            // Calculate spectral flux (rate of spectral change)
            const spectralFlux = this.calculateSpectralFlux(magnitudes);
            
            // Calculate harmonic vs inharmonic content ratio
            const harmonicRatio = this.calculateHarmonicRatio(magnitudes, harmonicProfile);
            
            // Calculate noise ratio
            const noiseRatio = this.calculateNoiseRatio(magnitudes, harmonicProfile);
            
            // Calculate confidence based on spectral clarity
            const confidence = this.calculateSpectralConfidence(magnitudes, harmonicRatio, noiseRatio);
            
            return {
                spectralCentroid: spectralCentroid,
                harmonicProfile: harmonicProfile,
                formants: formants,
                spectralFlux: spectralFlux,
                harmonicRatio: harmonicRatio,
                noiseRatio: noiseRatio,
                confidence: confidence,
                magnitudeSpectrum: magnitudes.slice(0, magnitudes.length / 2) // Only positive frequencies
            };
            
        } catch (error) {
            console.error('Spectral analysis failed:', error);
            return {
                spectralCentroid: 0,
                harmonicProfile: [],
                formants: [],
                spectralFlux: 0,
                harmonicRatio: 0,
                noiseRatio: 1,
                confidence: 0
            };
        }
    }
    
    /**
     * Create Hann window for spectral analysis
     */
    createHannWindow(size) {
        const window = new Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
        }
        return window;
    }
    
    /**
     * Apply window function to audio buffer
     */
    applyWindow(audioBuffer, window) {
        const windowed = new Array(audioBuffer.length);
        for (let i = 0; i < audioBuffer.length; i++) {
            windowed[i] = audioBuffer[i] * (window[i] || 1);
        }
        return windowed;
    }
    
    /**
     * Compute FFT (Fast Fourier Transform)
     * Simplified implementation - in production would use optimized FFT library
     */
    computeFFT(signal) {
        const N = signal.length;
        const fftData = new Array(N);
        
        // Initialize with input signal (real parts)
        for (let i = 0; i < N; i++) {
            fftData[i] = { real: signal[i], imag: 0 };
        }
        
        // Simple DFT for demonstration (very inefficient, would use actual FFT)
        const result = new Array(N);
        for (let k = 0; k < N; k++) {
            result[k] = { real: 0, imag: 0 };
            for (let n = 0; n < N; n++) {
                const angle = -2 * Math.PI * k * n / N;
                result[k].real += fftData[n].real * Math.cos(angle) - fftData[n].imag * Math.sin(angle);
                result[k].imag += fftData[n].real * Math.sin(angle) + fftData[n].imag * Math.cos(angle);
            }
        }
        
        return result;
    }
    
    /**
     * Compute magnitude spectrum from FFT data
     */
    computeMagnitudes(fftData) {
        return fftData.map(bin => Math.sqrt(bin.real * bin.real + bin.imag * bin.imag));
    }
    
    /**
     * Calculate spectral centroid (measure of "brightness")
     */
    calculateSpectralCentroid(magnitudes) {
        const binSize = this.sampleRate / (2 * magnitudes.length);
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 1; i < magnitudes.length; i++) {
            const frequency = i * binSize;
            const magnitude = magnitudes[i];
            
            weightedSum += frequency * magnitude;
            magnitudeSum += magnitude;
        }
        
        return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }
    
    /**
     * Extract harmonic profile (fundamental + harmonics analysis)
     */
    extractHarmonicProfile(magnitudes, fundamentalFreq) {
        const binSize = this.sampleRate / (2 * magnitudes.length);
        const harmonics = [];
        
        // Extract up to 15 harmonics
        for (let harmonic = 1; harmonic <= 15; harmonic++) {
            const targetFreq = fundamentalFreq * harmonic;
            const targetBin = Math.round(targetFreq / binSize);
            
            if (targetBin < magnitudes.length) {
                // Use peak detection around target bin for more accuracy
                const amplitude = this.findLocalPeak(magnitudes, targetBin, 3);
                const phase = this.calculatePhase(targetBin); // Simplified
                
                harmonics.push({
                    harmonic: harmonic,
                    frequency: targetFreq,
                    amplitude: amplitude,
                    phase: phase
                });
            }
        }
        
        // Normalize amplitudes relative to fundamental
        if (harmonics.length > 0 && harmonics[0].amplitude > 0) {
            const fundamentalAmplitude = harmonics[0].amplitude;
            harmonics.forEach(h => {
                h.amplitude = h.amplitude / fundamentalAmplitude;
            });
        }
        
        return harmonics;
    }
    
    /**
     * Extract vocal formants (F1-F4)
     */
    extractFormants(magnitudes) {
        const binSize = this.sampleRate / (2 * magnitudes.length);
        const formants = [];
        
        // Typical formant frequency ranges for different vowels
        const formantRanges = [
            { min: 200, max: 1000, name: 'F1' },   // First formant
            { min: 800, max: 2500, name: 'F2' },   // Second formant  
            { min: 1500, max: 3500, name: 'F3' },  // Third formant
            { min: 2500, max: 4500, name: 'F4' }   // Fourth formant
        ];
        
        formantRanges.forEach(range => {
            const startBin = Math.max(1, Math.floor(range.min / binSize));
            const endBin = Math.min(magnitudes.length - 1, Math.ceil(range.max / binSize));
            
            // Find peak in this frequency range
            let maxMagnitude = 0;
            let peakBin = startBin;
            
            for (let bin = startBin; bin <= endBin; bin++) {
                if (magnitudes[bin] > maxMagnitude) {
                    maxMagnitude = magnitudes[bin];
                    peakBin = bin;
                }
            }
            
            // Calculate formant properties
            const frequency = peakBin * binSize;
            const bandwidth = this.calculateFormantBandwidth(magnitudes, peakBin);
            
            formants.push({
                name: range.name,
                frequency: Math.round(frequency),
                amplitude: maxMagnitude,
                bandwidth: Math.round(bandwidth)
            });
        });
        
        return formants;
    }
    
    /**
     * Calculate spectral flux (measure of spectral change rate)
     */
    calculateSpectralFlux(magnitudes) {
        // Compare with previous spectrum (stored in instance variable)
        if (!this.previousMagnitudes) {
            this.previousMagnitudes = magnitudes.slice();
            return 0;
        }
        
        let flux = 0;
        const minLength = Math.min(magnitudes.length, this.previousMagnitudes.length);
        
        for (let i = 0; i < minLength; i++) {
            const diff = magnitudes[i] - this.previousMagnitudes[i];
            flux += diff > 0 ? diff : 0; // Only consider increases
        }
        
        // Update previous spectrum
        this.previousMagnitudes = magnitudes.slice();
        
        // Normalize by spectrum length
        return flux / minLength;
    }
    
    /**
     * Calculate harmonic ratio (harmonic vs inharmonic content)
     */
    calculateHarmonicRatio(magnitudes, harmonicProfile) {
        if (harmonicProfile.length === 0) return 0;
        
        const binSize = this.sampleRate / (2 * magnitudes.length);
        
        // Sum energy in harmonic bins
        let harmonicEnergy = 0;
        harmonicProfile.forEach(harmonic => {
            const bin = Math.round(harmonic.frequency / binSize);
            if (bin < magnitudes.length) {
                harmonicEnergy += magnitudes[bin] * magnitudes[bin];
            }
        });
        
        // Sum total energy
        let totalEnergy = 0;
        for (let i = 1; i < magnitudes.length; i++) {
            totalEnergy += magnitudes[i] * magnitudes[i];
        }
        
        return totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
    }
    
    /**
     * Calculate noise ratio
     */
    calculateNoiseRatio(magnitudes, harmonicProfile) {
        const harmonicRatio = this.calculateHarmonicRatio(magnitudes, harmonicProfile);
        return Math.max(0, 1 - harmonicRatio);
    }
    
    /**
     * Calculate confidence based on spectral clarity
     */
    calculateSpectralConfidence(magnitudes, harmonicRatio, noiseRatio) {
        // High harmonic ratio and low noise ratio indicate high confidence
        const harmonicConfidence = harmonicRatio;
        const noiseConfidence = 1 - noiseRatio;
        
        // Check for spectral stability
        const spectralVariation = this.calculateSpectralVariation(magnitudes);
        const stabilityConfidence = Math.max(0, 1 - spectralVariation);
        
        // Combined confidence
        return (harmonicConfidence * 0.4 + noiseConfidence * 0.4 + stabilityConfidence * 0.2);
    }
    
    /**
     * Utility methods
     */
    
    findLocalPeak(magnitudes, centerBin, window) {
        const start = Math.max(0, centerBin - window);
        const end = Math.min(magnitudes.length - 1, centerBin + window);
        
        let maxValue = 0;
        for (let i = start; i <= end; i++) {
            if (magnitudes[i] > maxValue) {
                maxValue = magnitudes[i];
            }
        }
        
        return maxValue;
    }
    
    calculatePhase(bin) {
        // Simplified phase calculation - would need actual FFT complex data
        return Math.random() * 2 * Math.PI; // Placeholder
    }
    
    calculateFormantBandwidth(magnitudes, peakBin) {
        const peakMagnitude = magnitudes[peakBin];
        const halfPeak = peakMagnitude * 0.5;
        
        // Find bandwidth at -3dB (half amplitude)
        let leftBin = peakBin;
        let rightBin = peakBin;
        
        // Search left
        while (leftBin > 0 && magnitudes[leftBin] > halfPeak) {
            leftBin--;
        }
        
        // Search right  
        while (rightBin < magnitudes.length - 1 && magnitudes[rightBin] > halfPeak) {
            rightBin++;
        }
        
        const binSize = this.sampleRate / (2 * magnitudes.length);
        return (rightBin - leftBin) * binSize;
    }
    
    calculateSpectralVariation(magnitudes) {
        if (magnitudes.length < 2) return 0;
        
        let variation = 0;
        for (let i = 1; i < magnitudes.length; i++) {
            const diff = Math.abs(magnitudes[i] - magnitudes[i-1]);
            variation += diff;
        }
        
        const maxMagnitude = Math.max(...magnitudes);
        return maxMagnitude > 0 ? variation / (magnitudes.length * maxMagnitude) : 0;
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpectralAnalyzer;
}