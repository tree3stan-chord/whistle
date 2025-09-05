/**
 * Harmonic Filtering and Vocal Processing
 * Enhances pitch detection for singing by filtering overtones and emphasizing fundamentals
 */
class HarmonicFilter {
    constructor(audioContext, sampleRate) {
        this.audioContext = audioContext;
        this.sampleRate = sampleRate;
        
        // Harmonic analysis buffers (must be set before creating filter chain)
        this.bufferSize = 2048;
        this.analysisBuffer = new Float32Array(this.bufferSize);
        this.spectrumBuffer = new Float32Array(this.bufferSize / 2);
        
        // Harmonic detection parameters
        this.harmonicThreshold = 0.3; // Ratio for harmonic detection
        this.fundamentalBias = 1.5;   // Bias toward fundamental frequency
        
        // Create filter chain for vocal enhancement (after bufferSize is set)
        this.createFilterChain();
        
        console.log('HarmonicFilter initialized for vocal processing');
    }
    
    createFilterChain() {
        // Pre-emphasis filter (already exists, enhance it)
        this.preEmphasis = this.audioContext.createBiquadFilter();
        this.preEmphasis.type = 'highpass';
        this.preEmphasis.frequency.setValueAtTime(60, this.audioContext.currentTime); // Remove sub-vocal frequencies
        this.preEmphasis.Q.setValueAtTime(0.7, this.audioContext.currentTime);
        
        // Vocal formant emphasis (around 800-3000 Hz)
        this.formantFilter = this.audioContext.createBiquadFilter();
        this.formantFilter.type = 'peaking';
        this.formantFilter.frequency.setValueAtTime(1200, this.audioContext.currentTime); // First formant region
        this.formantFilter.gain.setValueAtTime(6, this.audioContext.currentTime); // 6dB boost
        this.formantFilter.Q.setValueAtTime(2, this.audioContext.currentTime);
        
        // Anti-aliasing/smoothing filter
        this.smoothingFilter = this.audioContext.createBiquadFilter();
        this.smoothingFilter.type = 'lowpass';
        this.smoothingFilter.frequency.setValueAtTime(4000, this.audioContext.currentTime); // Remove high harmonics
        this.smoothingFilter.Q.setValueAtTime(0.7, this.audioContext.currentTime);
        
        // Dynamic range compressor for consistent levels
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime); // dB
        this.compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
        this.compressor.ratio.setValueAtTime(3, this.audioContext.currentTime); // 3:1 compression
        this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime); // 3ms attack
        this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime); // 250ms release
        
        // Connect the chain
        this.preEmphasis.connect(this.formantFilter);
        this.formantFilter.connect(this.smoothingFilter);
        this.smoothingFilter.connect(this.compressor);
        
        // Create analyser for processed signal
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.bufferSize * 2;
        this.analyser.smoothingTimeConstant = 0.1; // Slight smoothing for harmonics
        
        this.compressor.connect(this.analyser);
    }
    
    /**
     * Connect input source to the harmonic filter chain
     */
    connectInput(sourceNode) {
        sourceNode.connect(this.preEmphasis);
        return this.analyser; // Return the output analyser
    }
    
    /**
     * Enhanced time-domain data with harmonic filtering applied
     */
    getFilteredTimeData() {
        const dataArray = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(dataArray);
        return dataArray;
    }
    
    /**
     * Get frequency spectrum for harmonic analysis
     */
    getSpectrumData() {
        this.analyser.getFloatFrequencyData(this.spectrumBuffer);
        return this.spectrumBuffer;
    }
    
    /**
     * Detect and suppress harmonics to emphasize fundamental
     */
    findFundamentalFrequency(timeData) {
        // Get frequency spectrum
        const spectrum = this.getSpectrumData();
        
        // Find peaks in spectrum
        const peaks = this.findSpectralPeaks(spectrum);
        
        if (peaks.length === 0) return null;
        
        // Analyze harmonic relationships
        const fundamental = this.identifyFundamental(peaks);
        
        return fundamental;
    }
    
    findSpectralPeaks(spectrum) {
        const peaks = [];
        const minPeakHeight = -60; // dB threshold
        const minPeakDistance = 5; // bins apart
        
        for (let i = minPeakDistance; i < spectrum.length - minPeakDistance; i++) {
            const amplitude = spectrum[i];
            
            if (amplitude > minPeakHeight) {
                // Check if it's a local maximum
                let isPeak = true;
                for (let j = -minPeakDistance; j <= minPeakDistance; j++) {
                    if (j !== 0 && spectrum[i + j] > amplitude) {
                        isPeak = false;
                        break;
                    }
                }
                
                if (isPeak) {
                    const frequency = (i / spectrum.length) * (this.sampleRate / 2);
                    peaks.push({
                        frequency: frequency,
                        amplitude: amplitude,
                        bin: i
                    });
                }
            }
        }
        
        // Sort by amplitude (strongest first)
        return peaks.sort((a, b) => b.amplitude - a.amplitude);
    }
    
    identifyFundamental(peaks) {
        if (peaks.length === 0) return null;
        
        // Score each peak as potential fundamental
        const candidates = peaks.map(peak => ({
            ...peak,
            score: this.scoreFundamentalCandidate(peak, peaks)
        }));
        
        // Return best candidate
        const best = candidates.reduce((a, b) => a.score > b.score ? a : b);
        
        return {
            frequency: best.frequency,
            amplitude: best.amplitude,
            confidence: Math.min(1.0, best.score / 10) // Normalize score to confidence
        };
    }
    
    scoreFundamentalCandidate(candidate, allPeaks) {
        let score = 0;
        const fundFreq = candidate.frequency;
        
        // Base score from amplitude (louder = more likely fundamental)
        score += Math.pow(10, candidate.amplitude / 20) * this.fundamentalBias;
        
        // Bonus for frequencies in typical vocal range
        if (fundFreq >= 80 && fundFreq <= 800) {
            score += 3; // Strong bonus for vocal fundamental range
        } else if (fundFreq <= 80) {
            score -= 2; // Penalty for sub-vocal frequencies
        }
        
        // Look for harmonic series support
        let harmonicSupport = 0;
        for (let harmonic = 2; harmonic <= 6; harmonic++) {
            const expectedFreq = fundFreq * harmonic;
            const tolerance = fundFreq * 0.05; // 5% tolerance
            
            const nearbyPeak = allPeaks.find(peak => 
                Math.abs(peak.frequency - expectedFreq) < tolerance
            );
            
            if (nearbyPeak) {
                // Stronger harmonics add more support
                const harmonicStrength = Math.pow(10, nearbyPeak.amplitude / 20);
                harmonicSupport += harmonicStrength / harmonic; // Higher harmonics worth less
            }
        }
        
        score += harmonicSupport;
        
        return score;
    }
    
    /**
     * Apply vocal-specific processing parameters
     */
    setVocalMode(enabled = true) {
        const currentTime = this.audioContext.currentTime;
        
        if (enabled) {
            // Optimize for singing voice
            this.preEmphasis.frequency.setValueAtTime(60, currentTime);
            this.formantFilter.frequency.setValueAtTime(1200, currentTime);
            this.formantFilter.gain.setValueAtTime(6, currentTime);
            this.smoothingFilter.frequency.setValueAtTime(4000, currentTime);
        } else {
            // Optimize for instruments/whistling
            this.preEmphasis.frequency.setValueAtTime(80, currentTime);
            this.formantFilter.gain.setValueAtTime(0, currentTime); // No formant boost
            this.smoothingFilter.frequency.setValueAtTime(6000, currentTime);
        }
    }
    
    /**
     * Adjust filter sensitivity for different input types
     */
    setSensitivity(level) {
        // level: 0.5 = less sensitive (noisy environment)
        //        1.0 = normal
        //        1.5 = more sensitive (quiet/clean environment)
        
        const currentTime = this.audioContext.currentTime;
        
        this.compressor.threshold.setValueAtTime(-24 / level, currentTime);
        this.harmonicThreshold = 0.3 / level;
        this.fundamentalBias = 1.5 * level;
    }
    
    /**
     * Get current filter settings for debugging
     */
    getFilterStatus() {
        return {
            preEmphasisFreq: this.preEmphasis.frequency.value,
            formantBoost: this.formantFilter.gain.value,
            smoothingFreq: this.smoothingFilter.frequency.value,
            compressorThreshold: this.compressor.threshold.value,
            harmonicThreshold: this.harmonicThreshold,
            fundamentalBias: this.fundamentalBias
        };
    }
}