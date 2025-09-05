/**
 * Forensic Audio Analysis Engine
 * Complete sound analysis with MIDI-level detail capture
 * Builds on existing YIN algorithm with advanced spectral and dynamic analysis
 */

class ForensicAudioAnalyzer {
    constructor(audioContext, config = {}) {
        this.audioContext = audioContext;
        this.sampleRate = audioContext.sampleRate;
        
        // Configuration with defaults
        this.config = {
            windowSize: config.windowSize || 4096,
            hopSize: config.hopSize || 1024,
            minFreq: config.minFreq || 60, // Hz - extended for bass vocals
            maxFreq: config.maxFreq || 2200, // Hz - extended for coloratura soprano
            harmonicCount: config.harmonicCount || 15,
            centPrecision: config.centPrecision || 0.1, // Sub-cent accuracy
            vibratoMinRate: config.vibratoMinRate || 3.0, // Hz
            vibratoMaxRate: config.vibratoMaxRate || 12.0, // Hz
            ...config
        };
        
        // Initialize analysis components
        this.yinDetector = null; // Will be passed in from existing system
        this.spectralAnalyzer = new SpectralAnalyzer(this.audioContext, this.config);
        this.dynamicsAnalyzer = new DynamicsAnalyzer(this.config);
        this.articulationClassifier = new ArticulationClassifier(this.config);
        this.midiMapper = new MidiMapper(this.config);
        
        // Analysis state
        this.analysisHistory = [];
        this.currentNote = null;
        this.analysisQueue = [];
        
        console.log('Forensic Audio Analyzer initialized with config:', this.config);
    }
    
    /**
     * Main analysis entry point
     * Performs comprehensive sound analysis on audio buffer
     */
    analyzeSound(audioBuffer, timestamp = null) {
        const startTime = performance.now();
        
        try {
            // 1. Enhanced pitch analysis
            const pitchAnalysis = this.analyzePitch(audioBuffer);
            
            // 2. Dynamic response analysis
            const dynamicsAnalysis = this.dynamicsAnalyzer.analyze(audioBuffer, pitchAnalysis);
            
            // 3. Spectral fingerprinting and timbre
            const spectralAnalysis = this.spectralAnalyzer.analyze(audioBuffer);
            
            // 4. Articulation classification
            const articulationAnalysis = this.articulationClassifier.classify(
                audioBuffer, 
                pitchAnalysis, 
                dynamicsAnalysis,
                spectralAnalysis,
                this.analysisHistory
            );
            
            // 5. Generate MIDI mapping suggestions
            const midiData = this.midiMapper.generateMidiData(
                pitchAnalysis,
                dynamicsAnalysis,
                spectralAnalysis,
                articulationAnalysis
            );
            
            // 6. Calculate confidence and quality metrics
            const analysisMetrics = this.calculateAnalysisMetrics(
                audioBuffer,
                pitchAnalysis,
                spectralAnalysis,
                startTime
            );
            
            const result = {
                timestamp: timestamp || Date.now(),
                pitch: pitchAnalysis,
                dynamics: dynamicsAnalysis,
                timbre: spectralAnalysis,
                articulation: articulationAnalysis,
                midiData: midiData,
                analysis: analysisMetrics
            };
            
            // Update analysis history for context-aware processing
            this.updateAnalysisHistory(result);
            
            return result;
            
        } catch (error) {
            console.error('Forensic analysis failed:', error);
            return null;
        }
    }
    
    /**
     * Enhanced pitch analysis with sub-cent precision and trajectory mapping
     */
    analyzePitch(audioBuffer) {
        // Use existing YIN detector as base (will be injected)
        const basicPitch = this.yinDetector ? this.yinDetector.detectPitch(audioBuffer) : null;
        
        if (!basicPitch || basicPitch.frequency < this.config.minFreq) {
            return {
                fundamental: null,
                confidence: 0,
                trajectory: [],
                vibrato: { present: false },
                portamento: { present: false }
            };
        }
        
        // Enhanced frequency precision using parabolic interpolation
        const preciseFreq = this.refinePitchPrecision(audioBuffer, basicPitch.frequency);
        
        // Pitch trajectory mapping for continuous frequency curves
        const trajectory = this.extractPitchTrajectory(audioBuffer, preciseFreq);
        
        // Vibrato analysis
        const vibratoAnalysis = this.analyzeVibrato(trajectory);
        
        // Portamento detection
        const portamentoAnalysis = this.analyzePortamento(trajectory, this.analysisHistory);
        
        return {
            fundamental: preciseFreq,
            confidence: basicPitch.confidence,
            trajectory: trajectory,
            vibrato: vibratoAnalysis,
            portamento: portamentoAnalysis,
            cents: this.frequencyToCents(preciseFreq),
            midiNote: this.frequencyToMidi(preciseFreq)
        };
    }
    
    /**
     * Refine pitch detection to sub-cent accuracy using parabolic interpolation
     */
    refinePitchPrecision(audioBuffer, estimatedFreq) {
        const windowSize = 2048;
        const fftData = this.computeFFT(audioBuffer.slice(0, windowSize));
        
        // Find the peak bin corresponding to estimated frequency
        const binSize = this.sampleRate / windowSize;
        const targetBin = Math.round(estimatedFreq / binSize);
        
        // Parabolic interpolation around the peak
        if (targetBin > 0 && targetBin < fftData.length - 1) {
            const y1 = fftData[targetBin - 1];
            const y2 = fftData[targetBin];
            const y3 = fftData[targetBin + 1];
            
            const a = (y1 - 2 * y2 + y3) / 2;
            const b = (y3 - y1) / 2;
            
            if (Math.abs(a) > 1e-6) {
                const peakOffset = -b / (2 * a);
                const refinedBin = targetBin + peakOffset;
                return refinedBin * binSize;
            }
        }
        
        return estimatedFreq;
    }
    
    /**
     * Extract continuous pitch trajectory for the analysis window
     */
    extractPitchTrajectory(audioBuffer, baseFreq) {
        const trajectory = [];
        const frameSize = 256;
        const frameCount = Math.floor(audioBuffer.length / frameSize);
        
        for (let i = 0; i < frameCount; i++) {
            const frameStart = i * frameSize;
            const frame = audioBuffer.slice(frameStart, frameStart + frameSize);
            
            // Quick pitch estimation for this frame
            const frameFreq = this.estimateFramePitch(frame, baseFreq);
            
            trajectory.push({
                time: (frameStart / this.sampleRate) * 1000, // ms
                frequency: frameFreq,
                confidence: this.calculateFrameConfidence(frame, frameFreq)
            });
        }
        
        return trajectory;
    }
    
    /**
     * Analyze vibrato characteristics from pitch trajectory
     */
    analyzeVibrato(trajectory) {
        if (trajectory.length < 10) {
            return { present: false };
        }
        
        // Extract frequency values
        const frequencies = trajectory.map(point => point.frequency).filter(f => f > 0);
        if (frequencies.length < 5) {
            return { present: false };
        }
        
        // Detrend the frequency data
        const detrended = this.detrend(frequencies);
        
        // Find periodic oscillations using autocorrelation
        const autocorr = this.autocorrelation(detrended);
        
        // Find the dominant period
        const sampleRate = trajectory.length / ((trajectory[trajectory.length - 1].time - trajectory[0].time) / 1000);
        const vibratoInfo = this.findVibratoPeriod(autocorr, sampleRate);
        
        if (!vibratoInfo.present) {
            return { present: false };
        }
        
        // Calculate vibrato characteristics
        const depth = this.calculateVibratoDepth(detrended);
        const irregularity = this.calculateVibratoIrregularity(detrended, vibratoInfo.period);
        
        return {
            present: true,
            rate: vibratoInfo.rate,
            depth: depth, // in cents
            irregularity: irregularity,
            phase: this.calculateVibratoPhase(detrended, vibratoInfo.period),
            onsetDelay: this.findVibratoOnset(frequencies)
        };
    }
    
    /**
     * Detect and analyze portamento between notes
     */
    analyzePortamento(trajectory, history) {
        if (!history.length || trajectory.length < 5) {
            return { present: false };
        }
        
        const previousAnalysis = history[history.length - 1];
        if (!previousAnalysis || !previousAnalysis.pitch.fundamental) {
            return { present: false };
        }
        
        const startFreq = previousAnalysis.pitch.fundamental;
        const endFreq = trajectory[trajectory.length - 1].frequency;
        
        // Check if there's significant pitch change
        const semitoneChange = Math.abs(this.frequencyToMidi(endFreq) - this.frequencyToMidi(startFreq));
        
        if (semitoneChange < 0.5) { // Less than half semitone
            return { present: false };
        }
        
        // Analyze the curve shape
        const frequencies = trajectory.map(p => p.frequency).filter(f => f > 0);
        const curveShape = this.analyzeCurveShape(frequencies, startFreq, endFreq);
        
        return {
            present: true,
            startFreq: startFreq,
            endFreq: endFreq,
            duration: trajectory[trajectory.length - 1].time - trajectory[0].time,
            curve: curveShape.type, // 'linear', 'exponential', 'sigmoid'
            smoothness: curveShape.smoothness
        };
    }
    
    /**
     * Update analysis history for context-aware processing
     */
    updateAnalysisHistory(result) {
        this.analysisHistory.push(result);
        
        // Keep only recent history (last 10 seconds worth)
        const maxHistoryTime = 10000; // ms
        const cutoffTime = result.timestamp - maxHistoryTime;
        
        this.analysisHistory = this.analysisHistory.filter(
            analysis => analysis.timestamp > cutoffTime
        );
    }
    
    /**
     * Calculate overall analysis confidence and quality metrics
     */
    calculateAnalysisMetrics(audioBuffer, pitchAnalysis, spectralAnalysis, startTime) {
        const analysisLatency = performance.now() - startTime;
        
        // Detect clipping
        const maxSample = Math.max(...audioBuffer.map(Math.abs));
        const isClipping = maxSample > 0.95;
        
        // Calculate noise level
        const noiseLevel = spectralAnalysis.noiseRatio || 0;
        
        // Overall confidence is weighted average of component confidences
        const overallConfidence = (
            pitchAnalysis.confidence * 0.4 +
            spectralAnalysis.confidence * 0.3 +
            (1 - noiseLevel) * 0.2 +
            (isClipping ? 0 : 0.1)
        );
        
        return {
            overallConfidence: Math.max(0, Math.min(1, overallConfidence)),
            pitchConfidence: pitchAnalysis.confidence,
            timbreConfidence: spectralAnalysis.confidence || 0.5,
            articulationConfidence: 0.8, // Placeholder - will be calculated by articulation classifier
            noiseLevel: noiseLevel,
            clipping: isClipping,
            sampleRate: this.sampleRate,
            analysisLatency: Math.round(analysisLatency)
        };
    }
    
    /**
     * Utility methods
     */
    
    computeFFT(signal) {
        // Placeholder - would use actual FFT implementation
        // For now, return mock data
        return new Array(signal.length / 2).fill(0).map(() => Math.random());
    }
    
    detrend(data) {
        const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
        return data.map(val => val - mean);
    }
    
    autocorrelation(signal) {
        const result = new Array(signal.length).fill(0);
        for (let lag = 0; lag < signal.length; lag++) {
            for (let i = 0; i < signal.length - lag; i++) {
                result[lag] += signal[i] * signal[i + lag];
            }
            result[lag] /= signal.length - lag;
        }
        return result;
    }
    
    frequencyToCents(freq) {
        return Math.round(1200 * Math.log2(freq / 440) * 10) / 10; // 0.1 cent precision
    }
    
    frequencyToMidi(freq) {
        return Math.round((69 + 12 * Math.log2(freq / 440)) * 100) / 100; // 0.01 semitone precision
    }
    
    estimateFramePitch(frame, referenceFreq) {
        // Quick and dirty pitch estimation - would be replaced with optimized algorithm
        return referenceFreq + (Math.random() - 0.5) * 10; // Mock with small variation
    }
    
    calculateFrameConfidence(frame, freq) {
        // Mock confidence calculation
        return Math.random() * 0.3 + 0.7;
    }
    
    findVibratoPeriod(autocorr, sampleRate) {
        // Find peaks in autocorrelation that correspond to vibrato rates
        const minPeriod = Math.floor(sampleRate / this.config.vibratoMaxRate);
        const maxPeriod = Math.floor(sampleRate / this.config.vibratoMinRate);
        
        let maxCorr = 0;
        let bestPeriod = 0;
        
        for (let period = minPeriod; period <= maxPeriod && period < autocorr.length; period++) {
            if (autocorr[period] > maxCorr) {
                maxCorr = autocorr[period];
                bestPeriod = period;
            }
        }
        
        if (maxCorr > 0.3) { // Threshold for vibrato detection
            return {
                present: true,
                period: bestPeriod,
                rate: sampleRate / bestPeriod
            };
        }
        
        return { present: false };
    }
    
    calculateVibratoDepth(detrended) {
        const range = Math.max(...detrended) - Math.min(...detrended);
        return range * 50; // Convert to approximate cents (rough estimate)
    }
    
    calculateVibratoIrregularity(signal, period) {
        // Measure how regular the vibrato cycles are
        if (period <= 0 || signal.length < period * 2) return 0;
        
        const cycles = Math.floor(signal.length / period);
        let totalVariation = 0;
        
        for (let cycle = 0; cycle < cycles - 1; cycle++) {
            const cycle1Start = cycle * period;
            const cycle2Start = (cycle + 1) * period;
            
            let cycleDifference = 0;
            for (let i = 0; i < period; i++) {
                const diff = signal[cycle1Start + i] - signal[cycle2Start + i];
                cycleDifference += diff * diff;
            }
            
            totalVariation += Math.sqrt(cycleDifference / period);
        }
        
        return Math.min(1, totalVariation / (cycles - 1));
    }
    
    calculateVibratoPhase(signal, period) {
        // Calculate the current phase of vibrato cycle (0-1)
        if (period <= 0 || signal.length < period) return 0;
        
        const lastCycleStart = signal.length - period;
        const cycle = signal.slice(lastCycleStart);
        
        // Find peak position in the cycle
        let maxVal = -Infinity;
        let maxIndex = 0;
        
        for (let i = 0; i < cycle.length; i++) {
            if (cycle[i] > maxVal) {
                maxVal = cycle[i];
                maxIndex = i;
            }
        }
        
        return maxIndex / period;
    }
    
    findVibratoOnset(frequencies) {
        // Find when vibrato starts after note onset
        const windowSize = 10;
        const threshold = 2; // cents variation threshold
        
        for (let i = windowSize; i < frequencies.length - windowSize; i++) {
            const window = frequencies.slice(i - windowSize, i + windowSize);
            const variation = Math.max(...window) - Math.min(...window);
            
            if (this.frequencyToCents(variation) > threshold) {
                return (i / frequencies.length) * 100; // Return as percentage of note duration
            }
        }
        
        return 0;
    }
    
    analyzeCurveShape(frequencies, startFreq, endFreq) {
        if (frequencies.length < 3) {
            return { type: 'linear', smoothness: 0 };
        }
        
        // Normalize frequencies to 0-1 range
        const normalized = frequencies.map(f => (f - startFreq) / (endFreq - startFreq));
        
        // Test different curve fits
        const linearError = this.calculateLinearFitError(normalized);
        const expError = this.calculateExponentialFitError(normalized);
        const sigmoidError = this.calculateSigmoidFitError(normalized);
        
        let bestFit = 'linear';
        let minError = linearError;
        
        if (expError < minError) {
            bestFit = 'exponential';
            minError = expError;
        }
        
        if (sigmoidError < minError) {
            bestFit = 'sigmoid';
            minError = sigmoidError;
        }
        
        // Calculate smoothness (lower error = smoother curve)
        const smoothness = Math.max(0, 1 - minError * 10);
        
        return {
            type: bestFit,
            smoothness: smoothness
        };
    }
    
    calculateLinearFitError(data) {
        const step = 1 / (data.length - 1);
        let totalError = 0;
        
        for (let i = 0; i < data.length; i++) {
            const expected = i * step;
            const error = Math.abs(data[i] - expected);
            totalError += error;
        }
        
        return totalError / data.length;
    }
    
    calculateExponentialFitError(data) {
        // Mock exponential fit error calculation
        return Math.random() * 0.3;
    }
    
    calculateSigmoidFitError(data) {
        // Mock sigmoid fit error calculation  
        return Math.random() * 0.3;
    }
    
    /**
     * Set the YIN detector from existing system
     */
    setYinDetector(yinDetector) {
        this.yinDetector = yinDetector;
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ForensicAudioAnalyzer;
}