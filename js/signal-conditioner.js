class SignalConditioner {
    constructor(sampleRate, bufferSize = 2048) {
        this.sampleRate = sampleRate;
        this.bufferSize = bufferSize;
        
        // Noise gate parameters
        this.noiseGate = {
            threshold: -40, // dB
            ratio: 10,      // reduction ratio
            attack: 5,      // ms
            release: 50,    // ms
            hysteresis: 6,  // dB difference between open/close
            isOpen: false,
            envelope: 0,
            attackCoeff: 0,
            releaseCoeff: 0
        };
        
        // Dynamic range compression
        this.compressor = {
            threshold: -20,  // dB
            ratio: 4,        // compression ratio
            attack: 10,      // ms
            release: 100,    // ms
            makeup: 0,       // dB
            envelope: 0,
            attackCoeff: 0,
            releaseCoeff: 0
        };
        
        // Adaptive filtering
        this.adaptiveFilter = {
            enabled: true,
            alpha: 0.95,           // smoothing factor
            spectralSubtraction: 0.2, // noise subtraction factor
            noiseProfile: new Float32Array(bufferSize / 2),
            signalProfile: new Float32Array(bufferSize / 2),
            adaptationRate: 0.001,
            learningPeriod: 100,   // frames to learn noise profile
            frameCount: 0
        };
        
        // High-pass filter for removing DC offset and low-frequency noise
        this.highPassFilter = {
            enabled: true,
            cutoff: 80,      // Hz
            x1: 0, x2: 0,    // input history
            y1: 0, y2: 0,    // output history
            a0: 0, a1: 0, a2: 0, // filter coefficients
            b1: 0, b2: 0
        };
        
        // Pre-emphasis filter for vocal clarity
        this.preEmphasis = {
            enabled: true,
            coefficient: 0.97,
            prevSample: 0
        };
        
        // RMS calculation for level detection
        this.rmsWindow = new Float32Array(Math.floor(sampleRate * 0.05)); // 50ms window
        this.rmsIndex = 0;
        this.rmsSum = 0;
        
        this.initializeFilters();
        console.log('SignalConditioner initialized');
    }
    
    initializeFilters() {
        // Initialize noise gate coefficients
        this.noiseGate.attackCoeff = Math.exp(-1 / (this.sampleRate * this.noiseGate.attack / 1000));
        this.noiseGate.releaseCoeff = Math.exp(-1 / (this.sampleRate * this.noiseGate.release / 1000));
        
        // Initialize compressor coefficients
        this.compressor.attackCoeff = Math.exp(-1 / (this.sampleRate * this.compressor.attack / 1000));
        this.compressor.releaseCoeff = Math.exp(-1 / (this.sampleRate * this.compressor.release / 1000));
        
        // Initialize high-pass filter (Butterworth 2nd order)
        const omega = 2 * Math.PI * this.highPassFilter.cutoff / this.sampleRate;
        const sin = Math.sin(omega);
        const cos = Math.cos(omega);
        const alpha = sin / (2 * 0.707); // Q = 0.707 for Butterworth
        
        const a0 = 1 + alpha;
        this.highPassFilter.a0 = (1 + cos) / (2 * a0);
        this.highPassFilter.a1 = -(1 + cos) / a0;
        this.highPassFilter.a2 = (1 + cos) / (2 * a0);
        this.highPassFilter.b1 = (-2 * cos) / a0;
        this.highPassFilter.b2 = (1 - alpha) / a0;
    }
    
    processSignal(inputBuffer) {
        let processedBuffer = new Float32Array(inputBuffer);
        
        // Step 1: High-pass filtering (remove DC offset and low-frequency noise)
        if (this.highPassFilter.enabled) {
            processedBuffer = this.applyHighPassFilter(processedBuffer);
        }
        
        // Step 2: Pre-emphasis for vocal clarity
        if (this.preEmphasis.enabled) {
            processedBuffer = this.applyPreEmphasis(processedBuffer);
        }
        
        // Step 3: Adaptive noise gate
        processedBuffer = this.applyNoiseGate(processedBuffer);
        
        // Step 4: Dynamic range compression
        processedBuffer = this.applyCompression(processedBuffer);
        
        // Step 5: Adaptive spectral filtering (if enabled)
        if (this.adaptiveFilter.enabled) {
            processedBuffer = this.applyAdaptiveFiltering(processedBuffer);
        }
        
        return processedBuffer;
    }
    
    applyHighPassFilter(buffer) {
        const output = new Float32Array(buffer.length);
        
        for (let i = 0; i < buffer.length; i++) {
            const input = buffer[i];
            
            // Biquad filter calculation
            const output_sample = this.highPassFilter.a0 * input + 
                                this.highPassFilter.a1 * this.highPassFilter.x1 + 
                                this.highPassFilter.a2 * this.highPassFilter.x2 - 
                                this.highPassFilter.b1 * this.highPassFilter.y1 - 
                                this.highPassFilter.b2 * this.highPassFilter.y2;
            
            // Update delay line
            this.highPassFilter.x2 = this.highPassFilter.x1;
            this.highPassFilter.x1 = input;
            this.highPassFilter.y2 = this.highPassFilter.y1;
            this.highPassFilter.y1 = output_sample;
            
            output[i] = output_sample;
        }
        
        return output;
    }
    
    applyPreEmphasis(buffer) {
        const output = new Float32Array(buffer.length);
        
        for (let i = 0; i < buffer.length; i++) {
            output[i] = buffer[i] - this.preEmphasis.coefficient * this.preEmphasis.prevSample;
            this.preEmphasis.prevSample = buffer[i];
        }
        
        return output;
    }
    
    applyNoiseGate(buffer) {
        const output = new Float32Array(buffer.length);
        
        for (let i = 0; i < buffer.length; i++) {
            const sample = buffer[i];
            
            // Calculate RMS level
            const rms = this.updateRMS(sample);
            const level_dB = 20 * Math.log10(Math.max(rms, 1e-10));
            
            // Determine gate state with hysteresis
            let targetGain = 0;
            
            if (!this.noiseGate.isOpen && level_dB > this.noiseGate.threshold) {
                this.noiseGate.isOpen = true;
                targetGain = 1;
            } else if (this.noiseGate.isOpen && level_dB < (this.noiseGate.threshold - this.noiseGate.hysteresis)) {
                this.noiseGate.isOpen = false;
                targetGain = 1 / this.noiseGate.ratio;
            } else if (this.noiseGate.isOpen) {
                targetGain = 1;
            } else {
                targetGain = 1 / this.noiseGate.ratio;
            }
            
            // Smooth gain changes
            const coeff = targetGain > this.noiseGate.envelope ? 
                         this.noiseGate.attackCoeff : this.noiseGate.releaseCoeff;
            
            this.noiseGate.envelope = targetGain + (this.noiseGate.envelope - targetGain) * coeff;
            
            output[i] = sample * this.noiseGate.envelope;
        }
        
        return output;
    }
    
    applyCompression(buffer) {
        const output = new Float32Array(buffer.length);
        
        for (let i = 0; i < buffer.length; i++) {
            const sample = buffer[i];
            const level = Math.abs(sample);
            const level_dB = 20 * Math.log10(Math.max(level, 1e-10));
            
            let gain = 1;
            if (level_dB > this.compressor.threshold) {
                const overThreshold = level_dB - this.compressor.threshold;
                const compressedOverThreshold = overThreshold / this.compressor.ratio;
                const targetLevel_dB = this.compressor.threshold + compressedOverThreshold + this.compressor.makeup;
                gain = Math.pow(10, (targetLevel_dB - level_dB) / 20);
            }
            
            // Smooth gain changes
            const coeff = gain < this.compressor.envelope ? 
                         this.compressor.attackCoeff : this.compressor.releaseCoeff;
            
            this.compressor.envelope = gain + (this.compressor.envelope - gain) * coeff;
            
            output[i] = sample * this.compressor.envelope;
        }
        
        return output;
    }
    
    applyAdaptiveFiltering(buffer) {
        // This is a simplified adaptive filter - in practice, more sophisticated
        // algorithms like Wiener filtering or Kalman filtering could be used
        
        // Learn noise profile during initial frames
        if (this.adaptiveFilter.frameCount < this.adaptiveFilter.learningPeriod) {
            this.learnNoiseProfile(buffer);
            this.adaptiveFilter.frameCount++;
            return buffer; // Don't filter during learning period
        }
        
        // Apply spectral subtraction in frequency domain
        // For simplicity, we'll do a basic time-domain adaptive filter
        const output = new Float32Array(buffer.length);
        const alpha = this.adaptiveFilter.alpha;
        
        for (let i = 0; i < buffer.length; i++) {
            // Simple adaptive smoothing filter
            this.adaptiveFilter.signalProfile[i % this.adaptiveFilter.signalProfile.length] = 
                alpha * this.adaptiveFilter.signalProfile[i % this.adaptiveFilter.signalProfile.length] + 
                (1 - alpha) * Math.abs(buffer[i]);
            
            // Apply noise reduction based on learned profile
            const noiseLevel = this.adaptiveFilter.noiseProfile[i % this.adaptiveFilter.noiseProfile.length];
            const signalLevel = this.adaptiveFilter.signalProfile[i % this.adaptiveFilter.signalProfile.length];
            
            let reductionFactor = 1;
            if (signalLevel > 0) {
                const snr = signalLevel / (noiseLevel + 1e-10);
                if (snr < 2) { // SNR threshold for noise reduction
                    reductionFactor = Math.max(0.1, snr / 2);
                }
            }
            
            output[i] = buffer[i] * reductionFactor;
        }
        
        return output;
    }
    
    learnNoiseProfile(buffer) {
        // During the learning period, assume the signal contains mostly noise
        // This is a simplification - in practice, voice activity detection would be used
        const alpha = this.adaptiveFilter.adaptationRate;
        
        for (let i = 0; i < buffer.length; i++) {
            const idx = i % this.adaptiveFilter.noiseProfile.length;
            this.adaptiveFilter.noiseProfile[idx] = 
                alpha * Math.abs(buffer[i]) + 
                (1 - alpha) * this.adaptiveFilter.noiseProfile[idx];
        }
    }
    
    updateRMS(sample) {
        // Update sliding window RMS calculation
        const oldSample = this.rmsWindow[this.rmsIndex];
        this.rmsWindow[this.rmsIndex] = sample * sample;
        
        this.rmsSum += (sample * sample) - (oldSample || 0);
        this.rmsIndex = (this.rmsIndex + 1) % this.rmsWindow.length;
        
        return Math.sqrt(Math.max(0, this.rmsSum) / this.rmsWindow.length);
    }
    
    // Configuration methods
    setNoiseGateThreshold(threshold_dB) {
        this.noiseGate.threshold = threshold_dB;
    }
    
    setCompressorSettings(threshold, ratio, makeup = 0) {
        this.compressor.threshold = threshold;
        this.compressor.ratio = ratio;
        this.compressor.makeup = makeup;
    }
    
    setVocalMode(isVocal) {
        if (isVocal) {
            // Optimize for vocal processing
            this.noiseGate.threshold = -45;
            this.compressor.threshold = -18;
            this.compressor.ratio = 3;
            this.preEmphasis.coefficient = 0.95;
            this.highPassFilter.cutoff = 70;
        } else {
            // Optimize for instrumental processing
            this.noiseGate.threshold = -35;
            this.compressor.threshold = -22;
            this.compressor.ratio = 2.5;
            this.preEmphasis.coefficient = 0.97;
            this.highPassFilter.cutoff = 90;
        }
        
        this.initializeFilters();
    }
    
    // Diagnostic methods
    getGateStatus() {
        return {
            isOpen: this.noiseGate.isOpen,
            envelope: this.noiseGate.envelope,
            threshold: this.noiseGate.threshold
        };
    }
    
    getCompressionLevel() {
        return {
            envelope: this.compressor.envelope,
            reduction_dB: -20 * Math.log10(Math.max(this.compressor.envelope, 1e-10))
        };
    }
}