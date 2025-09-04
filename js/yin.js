/**
 * YIN Algorithm for fundamental frequency estimation
 * Based on: "YIN, a fundamental frequency estimator for speech and music" 
 * by Alain de Cheveigné and Hideki Kawahara (2002)
 */
class YINDetector {
    constructor(sampleRate, bufferSize = 2048) {
        this.sampleRate = sampleRate;
        this.bufferSize = bufferSize;
        this.threshold = 0.1; // YIN threshold for periodicity detection
        
        // Frequency range constraints (human vocal range + instruments)
        this.minFreq = 60;   // ~B1
        this.maxFreq = 2000; // ~B6
        
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
     * @param {Float32Array} audioBuffer - Time domain audio data
     * @returns {Object} - {frequency, confidence, period} or null if no pitch detected
     */
    detectPitch(audioBuffer) {
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
            frequency: frequency,
            confidence: confidence,
            period: betterTau
        };
    }
    
    /**
     * Step 1: Calculate the squared difference function
     * d_t(tau) = sum((x_j - x_{j+tau})^2)
     */
    calculateDifferenceFunction(audioBuffer) {
        let delta;
        
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
    calculateCMNDF() {
        this.yinBuffer[0] = 1.0; // Special case for tau = 0
        
        let runningSum = 0;
        for (let tau = 1; tau < this.maxPeriod; tau++) {
            runningSum += this.yinBuffer[tau];
            
            if (runningSum === 0) {
                this.yinBuffer[tau] = 1.0;
            } else {
                this.yinBuffer[tau] *= tau / runningSum;
            }
        }
    }
    
    /**
     * Step 3: Absolute threshold - find first tau where d'(tau) < threshold
     * @returns {number} - The estimated period tau, or -1 if none found
     */
    absoluteThreshold() {
        let tau;
        
        // Search from minimum period to avoid subharmonics
        for (tau = this.minPeriod; tau < this.maxPeriod; tau++) {
            if (this.yinBuffer[tau] < this.threshold) {
                // Find local minimum
                while (tau + 1 < this.maxPeriod && this.yinBuffer[tau + 1] < this.yinBuffer[tau]) {
                    tau++;
                }
                return tau;
            }
        }
        
        // If no value below threshold, return the global minimum
        let minTau = this.minPeriod;
        let minVal = this.yinBuffer[this.minPeriod];
        
        for (tau = this.minPeriod + 1; tau < this.maxPeriod; tau++) {
            if (this.yinBuffer[tau] < minVal) {
                minVal = this.yinBuffer[tau];
                minTau = tau;
            }
        }
        
        // Only return if minimum is reasonably periodic
        return minVal < (this.threshold * 2) ? minTau : -1;
    }
    
    /**
     * Step 4: Parabolic interpolation for sub-sample accuracy
     * @param {number} tauEst - The estimated integer period
     * @returns {number} - The refined period with fractional precision
     */
    parabolicInterpolation(tauEst) {
        if (tauEst === 0 || tauEst >= this.maxPeriod - 1) {
            return tauEst;
        }
        
        const s0 = this.yinBuffer[tauEst - 1];
        const s1 = this.yinBuffer[tauEst];
        const s2 = this.yinBuffer[tauEst + 1];
        
        // Parabolic interpolation formula
        const a = (s0 - 2 * s1 + s2) / 2;
        const b = (s2 - s0) / 2;
        
        if (a !== 0) {
            const x0 = -b / (2 * a);
            return tauEst + x0;
        } else {
            return tauEst;
        }
    }
    
    /**
     * Set the threshold for periodicity detection
     * Lower values = more strict (fewer false positives)
     * Higher values = more permissive (more detections)
     */
    setThreshold(threshold) {
        this.threshold = Math.max(0.01, Math.min(1.0, threshold));
    }
    
    /**
     * Set frequency range constraints
     */
    setFrequencyRange(minFreq, maxFreq) {
        this.minFreq = minFreq;
        this.maxFreq = maxFreq;
        this.maxPeriod = Math.floor(this.sampleRate / this.minFreq);
        this.minPeriod = Math.floor(this.sampleRate / this.maxFreq);
        
        // Reallocate buffers if needed
        if (this.yinBuffer.length < this.maxPeriod) {
            this.yinBuffer = new Float32Array(this.maxPeriod);
            this.probabilityBuffer = new Float32Array(this.maxPeriod);
        }
    }
}