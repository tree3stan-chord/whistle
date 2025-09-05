/**
 * Dynamics Analyzer - Attack, sustain, release, and velocity analysis
 * Part of the Forensic Audio Analysis Engine
 */

class DynamicsAnalyzer {
    constructor(config = {}) {
        this.config = config;
        
        // Analysis parameters
        this.attackThreshold = config.attackThreshold || 0.1; // 10% of peak for attack detection
        this.releaseThreshold = config.releaseThreshold || 0.1; // 10% of peak for release detection
        this.smoothingWindow = config.smoothingWindow || 64; // Samples for envelope smoothing
        
        console.log('Dynamics Analyzer initialized');
    }
    
    /**
     * Analyze dynamic characteristics of audio buffer
     */
    analyze(audioBuffer, pitchAnalysis = null) {
        try {
            // Calculate RMS envelope for dynamics analysis
            const envelope = this.calculateRMSEnvelope(audioBuffer);
            
            // Detect attack, sustain, and release phases
            const phases = this.detectPhases(envelope);
            
            // Analyze attack characteristics
            const attackAnalysis = this.analyzeAttack(envelope, phases.attackEnd);
            
            // Analyze sustain characteristics
            const sustainAnalysis = this.analyzeSustain(envelope, phases.sustainStart, phases.sustainEnd);
            
            // Analyze release characteristics
            const releaseAnalysis = this.analyzeRelease(envelope, phases.releaseStart);
            
            // Detect micro-variations in dynamics
            const microVariations = this.detectMicroVariations(envelope, phases);
            
            return {
                envelope: envelope,
                phases: phases,
                attack: attackAnalysis,
                sustain: sustainAnalysis,
                release: releaseAnalysis,
                microVariations: microVariations,
                overallDynamics: this.calculateOverallDynamics(envelope)
            };
            
        } catch (error) {
            console.error('Dynamics analysis failed:', error);
            return {
                attack: { time: 0, peakVelocity: 64, character: 'unknown' },
                sustain: { level: 64, stability: 0.5, decay: { rate: 0, curve: 'linear' } },
                release: { time: 100, character: 'clean', tailLevel: 0 },
                microVariations: [],
                overallDynamics: { averageLevel: 64, dynamicRange: 0 }
            };
        }
    }
    
    /**
     * Calculate RMS envelope of the audio signal
     */
    calculateRMSEnvelope(audioBuffer) {
        const windowSize = this.smoothingWindow;
        const envelope = new Array(audioBuffer.length);
        
        for (let i = 0; i < audioBuffer.length; i++) {
            const windowStart = Math.max(0, i - windowSize / 2);
            const windowEnd = Math.min(audioBuffer.length, i + windowSize / 2);
            
            let rmsSum = 0;
            let count = 0;
            
            for (let j = windowStart; j < windowEnd; j++) {
                rmsSum += audioBuffer[j] * audioBuffer[j];
                count++;
            }
            
            envelope[i] = count > 0 ? Math.sqrt(rmsSum / count) : 0;
        }
        
        return envelope;
    }
    
    /**
     * Detect attack, sustain, and release phases in the envelope
     */
    detectPhases(envelope) {
        if (envelope.length === 0) {
            return {
                attackEnd: 0,
                sustainStart: 0,
                sustainEnd: envelope.length,
                releaseStart: envelope.length
            };
        }
        
        // Find overall peak
        const peakValue = Math.max(...envelope);
        const peakIndex = envelope.indexOf(peakValue);
        
        // Find attack end (when signal reaches attack threshold from peak)
        const attackThresholdValue = peakValue * this.attackThreshold;
        let attackEnd = 0;
        
        for (let i = 0; i <= peakIndex; i++) {
            if (envelope[i] >= attackThresholdValue) {
                attackEnd = i;
                break;
            }
        }
        
        // Find release start (when signal starts dropping significantly after peak)
        const releaseThresholdValue = peakValue * (1 - this.releaseThreshold);
        let releaseStart = envelope.length - 1;
        
        for (let i = peakIndex; i < envelope.length; i++) {
            if (envelope[i] <= releaseThresholdValue) {
                releaseStart = i;
                break;
            }
        }
        
        // Sustain is between attack end and release start
        const sustainStart = Math.max(attackEnd, peakIndex);
        const sustainEnd = Math.min(releaseStart, envelope.length - 1);
        
        return {
            attackEnd: attackEnd,
            sustainStart: sustainStart,
            sustainEnd: sustainEnd,
            releaseStart: releaseStart,
            peakIndex: peakIndex,
            peakValue: peakValue
        };
    }
    
    /**
     * Analyze attack characteristics
     */
    analyzeAttack(envelope, attackEndIndex) {
        if (attackEndIndex <= 0) {
            return {
                time: 0,
                peakVelocity: this.amplitudeToMidiVelocity(envelope[0] || 0),
                overshoot: 0,
                character: 'soft'
            };
        }
        
        // Calculate attack time in milliseconds (assuming 44.1kHz sample rate)
        const sampleRate = 44100;
        const attackTime = (attackEndIndex / sampleRate) * 1000;
        
        // Find peak velocity during attack
        const attackSegment = envelope.slice(0, attackEndIndex + 1);
        const peakAmplitude = Math.max(...attackSegment);
        const peakVelocity = this.amplitudeToMidiVelocity(peakAmplitude);
        
        // Calculate overshoot (how much peak exceeds sustain level)
        const sustainLevel = envelope[Math.min(envelope.length - 1, attackEndIndex + 100)];
        const overshoot = sustainLevel > 0 ? (peakAmplitude - sustainLevel) / sustainLevel : 0;
        
        // Classify attack character
        const character = this.classifyAttackCharacter(attackTime, overshoot, attackSegment);
        
        return {
            time: Math.round(attackTime),
            peakVelocity: peakVelocity,
            overshoot: Math.round(overshoot * 100) / 100,
            character: character
        };
    }
    
    /**
     * Analyze sustain characteristics
     */
    analyzeSustain(envelope, sustainStart, sustainEnd) {
        if (sustainStart >= sustainEnd) {
            return {
                level: 64,
                stability: 0,
                decay: { rate: 0, curve: 'linear' },
                microVariations: []
            };
        }
        
        const sustainSegment = envelope.slice(sustainStart, sustainEnd + 1);
        
        if (sustainSegment.length === 0) {
            return {
                level: 64,
                stability: 0,
                decay: { rate: 0, curve: 'linear' },
                microVariations: []
            };
        }
        
        // Calculate average sustain level
        const averageLevel = sustainSegment.reduce((sum, val) => sum + val, 0) / sustainSegment.length;
        const sustainVelocity = this.amplitudeToMidiVelocity(averageLevel);
        
        // Calculate stability (inverse of coefficient of variation)
        const variance = sustainSegment.reduce((sum, val) => sum + Math.pow(val - averageLevel, 2), 0) / sustainSegment.length;
        const standardDeviation = Math.sqrt(variance);
        const stability = averageLevel > 0 ? Math.max(0, 1 - (standardDeviation / averageLevel)) : 0;
        
        // Analyze decay characteristics
        const decayAnalysis = this.analyzeDecay(sustainSegment);
        
        return {
            level: sustainVelocity,
            stability: Math.round(stability * 100) / 100,
            decay: decayAnalysis,
            microVariations: this.findSustainMicroVariations(sustainSegment)
        };
    }
    
    /**
     * Analyze release characteristics
     */
    analyzeRelease(envelope, releaseStartIndex) {
        if (releaseStartIndex >= envelope.length - 1) {
            return {
                time: 0,
                character: 'abrupt',
                tailLevel: 0
            };
        }
        
        const releaseSegment = envelope.slice(releaseStartIndex);
        
        if (releaseSegment.length === 0) {
            return {
                time: 0,
                character: 'abrupt', 
                tailLevel: 0
            };
        }
        
        // Calculate release time (time to drop to 10% of starting level)
        const releaseStartLevel = releaseSegment[0];
        const targetLevel = releaseStartLevel * 0.1;
        
        let releaseEndIndex = releaseSegment.length - 1;
        for (let i = 0; i < releaseSegment.length; i++) {
            if (releaseSegment[i] <= targetLevel) {
                releaseEndIndex = i;
                break;
            }
        }
        
        const sampleRate = 44100;
        const releaseTime = (releaseEndIndex / sampleRate) * 1000;
        
        // Classify release character
        const character = this.classifyReleaseCharacter(releaseSegment, releaseTime);
        
        // Calculate tail level
        const tailAmplitude = releaseSegment[releaseSegment.length - 1];
        const tailLevel = this.amplitudeToMidiVelocity(tailAmplitude);
        
        return {
            time: Math.round(releaseTime),
            character: character,
            tailLevel: tailLevel
        };
    }
    
    /**
     * Detect micro-variations in dynamics (sub-note level changes)
     */
    detectMicroVariations(envelope, phases) {
        const variations = [];
        const windowSize = 256; // Small window for micro-analysis
        const stepSize = 128;   // 50% overlap
        
        for (let i = phases.sustainStart; i < phases.sustainEnd - windowSize; i += stepSize) {
            const window = envelope.slice(i, i + windowSize);
            
            if (window.length === windowSize) {
                const variation = this.analyzeWindow(window, i);
                if (variation.magnitude > 0.05) { // Only significant variations
                    variations.push(variation);
                }
            }
        }
        
        return variations;
    }
    
    /**
     * Calculate overall dynamic characteristics
     */
    calculateOverallDynamics(envelope) {
        if (envelope.length === 0) {
            return {
                averageLevel: 64,
                dynamicRange: 0,
                peakLevel: 64,
                minimumLevel: 64
            };
        }
        
        const averageAmplitude = envelope.reduce((sum, val) => sum + val, 0) / envelope.length;
        const peakAmplitude = Math.max(...envelope);
        const minAmplitude = Math.min(...envelope.filter(val => val > 0));
        
        return {
            averageLevel: this.amplitudeToMidiVelocity(averageAmplitude),
            dynamicRange: this.amplitudeToMidiVelocity(peakAmplitude) - this.amplitudeToMidiVelocity(minAmplitude),
            peakLevel: this.amplitudeToMidiVelocity(peakAmplitude),
            minimumLevel: this.amplitudeToMidiVelocity(minAmplitude)
        };
    }
    
    /**
     * Utility methods
     */
    
    amplitudeToMidiVelocity(amplitude) {
        // Convert linear amplitude (0-1) to MIDI velocity (0-127)
        // Using square root for more musical velocity response
        return Math.round(Math.sqrt(Math.max(0, Math.min(1, amplitude))) * 127);
    }
    
    classifyAttackCharacter(attackTime, overshoot, attackSegment) {
        // Classification based on attack time and shape
        if (attackTime < 10) {
            return overshoot > 0.2 ? 'percussive' : 'hard';
        } else if (attackTime < 50) {
            return overshoot > 0.1 ? 'hard' : 'soft';
        } else if (attackTime < 200) {
            return 'soft';
        } else {
            // Analyze for breath sounds or other characteristics
            const hasBreathNoise = this.detectBreathNoise(attackSegment);
            return hasBreathNoise ? 'breathy' : 'soft';
        }
    }
    
    classifyReleaseCharacter(releaseSegment, releaseTime) {
        if (releaseTime < 50) {
            return 'abrupt';
        } else if (releaseTime < 200) {
            return 'clean';
        } else {
            // Check for breath or mechanical noise in release
            const hasBreathNoise = this.detectBreathNoise(releaseSegment);
            return hasBreathNoise ? 'breath' : 'clean';
        }
    }
    
    detectBreathNoise(segment) {
        // Simple heuristic: look for high-frequency content in low-amplitude signal
        // This is a placeholder - real breath detection would be more sophisticated
        const lowAmplitudeThreshold = Math.max(...segment) * 0.3;
        let breathIndicators = 0;
        
        for (let i = 1; i < segment.length - 1; i++) {
            if (segment[i] < lowAmplitudeThreshold) {
                // Look for rapid changes that might indicate breath turbulence
                const variation = Math.abs(segment[i] - segment[i-1]) + Math.abs(segment[i+1] - segment[i]);
                if (variation > segment[i] * 0.5) {
                    breathIndicators++;
                }
            }
        }
        
        return (breathIndicators / segment.length) > 0.1; // 10% threshold
    }
    
    analyzeDecay(sustainSegment) {
        if (sustainSegment.length < 10) {
            return { rate: 0, curve: 'linear' };
        }
        
        // Linear regression to find decay rate
        const x = sustainSegment.map((_, i) => i);
        const y = sustainSegment.map(val => Math.log(Math.max(0.001, val))); // Log for exponential fitting
        
        const n = x.length;
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        // Convert slope to dB/second (assuming 44.1kHz sample rate)
        const sampleRate = 44100;
        const decayRate = slope * sampleRate * 20 / Math.LN10; // Convert to dB/s
        
        return {
            rate: Math.abs(Math.round(decayRate * 1000) / 1000), // Round to 3 decimal places
            curve: Math.abs(decayRate) > 0.01 ? 'exponential' : 'linear'
        };
    }
    
    findSustainMicroVariations(sustainSegment) {
        const variations = [];
        const smoothed = this.smoothArray(sustainSegment, 8);
        
        for (let i = 1; i < smoothed.length - 1; i++) {
            const prev = smoothed[i - 1];
            const curr = smoothed[i];
            const next = smoothed[i + 1];
            
            // Look for local peaks and valleys
            if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
                const magnitude = Math.abs(curr - (prev + next) / 2);
                if (magnitude > 0.02) { // Threshold for significant variation
                    variations.push({
                        position: i / sustainSegment.length, // Relative position (0-1)
                        magnitude: magnitude,
                        type: curr > (prev + next) / 2 ? 'peak' : 'valley'
                    });
                }
            }
        }
        
        return variations;
    }
    
    analyzeWindow(window, startIndex) {
        const average = window.reduce((sum, val) => sum + val, 0) / window.length;
        const variance = window.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / window.length;
        
        return {
            position: startIndex,
            average: average,
            magnitude: Math.sqrt(variance),
            type: 'variation'
        };
    }
    
    smoothArray(array, windowSize) {
        const smoothed = new Array(array.length);
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let i = 0; i < array.length; i++) {
            const start = Math.max(0, i - halfWindow);
            const end = Math.min(array.length, i + halfWindow + 1);
            
            let sum = 0;
            let count = 0;
            
            for (let j = start; j < end; j++) {
                sum += array[j];
                count++;
            }
            
            smoothed[i] = count > 0 ? sum / count : array[i];
        }
        
        return smoothed;
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DynamicsAnalyzer;
}