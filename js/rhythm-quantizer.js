class RhythmQuantizer {
    constructor() {
        this.tempo = 120;           // Default BPM
        this.timeSignature = [4, 4]; // Default 4/4 time
        this.quantizationLevel = 16;  // Quantize to 16th notes
        
        // Musical divisions (in beats)
        this.musicalDivisions = {
            whole: 4.0,
            half: 2.0,
            quarter: 1.0,
            eighth: 0.5,
            sixteenth: 0.25,
            thirtysecond: 0.125,
            // Dotted notes
            dottedHalf: 3.0,
            dottedQuarter: 1.5,
            dottedEighth: 0.75,
            dottedSixteenth: 0.375,
            // Triplets
            halfTriplet: 4.0/3.0,
            quarterTriplet: 1.0/3.0,
            eighthTriplet: 0.5/3.0
        };
        
        // Swing/groove parameters
        this.swingRatio = 0;        // 0 = straight, 1 = full swing
        this.humanization = 0.1;    // Amount of timing variation
        
        // Adaptive learning
        this.performanceHistory = [];
        this.adaptiveQuantization = true;
        this.learningRate = 0.1;
        
        console.log('RhythmQuantizer initialized');
    }
    
    setTempo(bpm) {
        this.tempo = Math.max(60, Math.min(200, bpm));
        console.log('Tempo set to:', this.tempo, 'BPM');
    }
    
    setTimeSignature(numerator, denominator) {
        this.timeSignature = [numerator, denominator];
        console.log('Time signature set to:', `${numerator}/${denominator}`);
    }
    
    setQuantizationLevel(level) {
        // Level: 4=quarter, 8=eighth, 16=sixteenth, 32=thirty-second
        this.quantizationLevel = level;
        console.log('Quantization level set to:', level, 'notes');
    }
    
    quantizeDuration(actualDuration) {
        const beatDuration = 60 / this.tempo; // Duration of one beat in seconds
        const actualBeats = actualDuration / beatDuration;
        
        // Find closest musical division
        let bestMatch = this.findClosestDivision(actualBeats);
        
        // Apply adaptive learning if enabled
        if (this.adaptiveQuantization) {
            bestMatch = this.adaptiveQuantize(actualBeats, bestMatch);
        }
        
        // Apply swing if enabled
        if (this.swingRatio > 0) {
            bestMatch = this.applySwing(bestMatch);
        }
        
        // Apply humanization
        if (this.humanization > 0) {
            bestMatch = this.applyHumanization(bestMatch);
        }
        
        // Convert back to seconds
        const quantizedDuration = bestMatch.duration * beatDuration;
        
        // Record performance for adaptive learning
        this.recordPerformance(actualBeats, bestMatch.duration);
        
        return {
            duration: quantizedDuration,
            musicalDuration: bestMatch.duration,
            notationType: bestMatch.type,
            confidence: bestMatch.confidence
        };
    }
    
    findClosestDivision(actualBeats) {
        let bestMatch = null;
        let minDistance = Infinity;
        
        // Check all musical divisions
        for (const [type, duration] of Object.entries(this.musicalDivisions)) {
            // Skip divisions that are too long for the quantization level
            if (this.quantizationLevel === 16 && duration > 4) continue;
            if (this.quantizationLevel === 8 && duration > 2) continue;
            if (this.quantizationLevel === 4 && duration > 1) continue;
            
            // Calculate distance with different weighting for different ranges
            let distance = Math.abs(actualBeats - duration);
            
            // Weight very short notes more heavily to avoid over-quantizing
            if (actualBeats < 0.5 && duration < 0.5) {
                distance *= 0.5;
            }
            
            // Prefer simpler divisions (quarter, eighth) over complex ones
            if (type.includes('triplet') || type.includes('dotted')) {
                distance *= 1.2;
            }
            
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = {
                    type: type,
                    duration: duration,
                    confidence: this.calculateConfidence(actualBeats, duration, distance)
                };
            }
        }
        
        return bestMatch || {
            type: 'quarter',
            duration: 1.0,
            confidence: 0.5
        };
    }
    
    calculateConfidence(actualBeats, targetBeats, distance) {
        // Confidence decreases with distance from target
        const maxDistance = 0.5; // Beyond this, confidence is very low
        const normalizedDistance = Math.min(distance / maxDistance, 1.0);
        
        // Exponential decay for confidence
        const baseConfidence = Math.exp(-normalizedDistance * 3);
        
        // Boost confidence for very close matches
        if (distance < 0.1) {
            return Math.min(baseConfidence * 1.5, 1.0);
        }
        
        return Math.max(baseConfidence, 0.1);
    }
    
    adaptiveQuantize(actualBeats, initialMatch) {
        if (this.performanceHistory.length < 10) {
            return initialMatch; // Need more data for adaptation
        }
        
        // Analyze recent performance patterns
        const recentHistory = this.performanceHistory.slice(-20);
        const patternAnalysis = this.analyzePatterns(recentHistory);
        
        // Look for consistent deviations that might indicate intentional timing
        const consistentDeviation = this.findConsistentDeviation(actualBeats, patternAnalysis);
        
        if (consistentDeviation) {
            // Adjust quantization based on learned patterns
            const adjustedDuration = initialMatch.duration + consistentDeviation;
            
            // Find closest musical division to the adjusted duration
            const adjustedMatch = this.findClosestDivision(adjustedDuration);
            
            // Only use adjusted match if it's reasonably close
            if (Math.abs(adjustedDuration - adjustedMatch.duration) < 0.3) {
                return {
                    ...adjustedMatch,
                    confidence: Math.min(initialMatch.confidence * 1.2, 1.0)
                };
            }
        }
        
        return initialMatch;
    }
    
    analyzePatterns(history) {
        const patterns = {
            averageDeviation: 0,
            commonRatios: {},
            rhythmicPatterns: []
        };
        
        // Calculate average deviation from quantized values
        let totalDeviation = 0;
        for (const record of history) {
            totalDeviation += Math.abs(record.actual - record.quantized);
        }
        patterns.averageDeviation = totalDeviation / history.length;
        
        // Find common timing ratios
        for (const record of history) {
            const ratio = record.actual / record.quantized;
            const roundedRatio = Math.round(ratio * 10) / 10;
            patterns.commonRatios[roundedRatio] = (patterns.commonRatios[roundedRatio] || 0) + 1;
        }
        
        return patterns;
    }
    
    findConsistentDeviation(actualBeats, patterns) {
        // Look for consistent timing patterns that deviate from strict quantization
        const threshold = 3; // Need at least 3 occurrences to consider it intentional
        
        for (const [ratio, count] of Object.entries(patterns.commonRatios)) {
            if (count >= threshold && Math.abs(parseFloat(ratio) - 1.0) > 0.1) {
                const deviation = actualBeats * (parseFloat(ratio) - 1.0);
                if (Math.abs(deviation) > 0.05) {
                    return deviation * this.learningRate;
                }
            }
        }
        
        return null;
    }
    
    applySwing(match) {
        // Apply swing feel to eighth notes and shorter
        if (match.duration <= 0.5 && match.duration >= 0.25) {
            // Swing affects the subdivision of beats
            const swingAmount = this.swingRatio * 0.1; // Max 10% timing shift
            
            // On-beat notes get slightly delayed, off-beat notes get rushed
            const isOffBeat = (match.duration === 0.5 || match.duration === 0.25);
            const adjustment = isOffBeat ? -swingAmount : swingAmount;
            
            return {
                ...match,
                duration: match.duration + adjustment
            };
        }
        
        return match;
    }
    
    applyHumanization(match) {
        // Add slight random variation to prevent robotic timing
        const variation = (Math.random() - 0.5) * 2 * this.humanization;
        const maxVariation = match.duration * 0.05; // Max 5% variation
        
        const humanizedVariation = Math.max(-maxVariation, Math.min(maxVariation, variation * match.duration));
        
        return {
            ...match,
            duration: match.duration + humanizedVariation
        };
    }
    
    recordPerformance(actualBeats, quantizedBeats) {
        this.performanceHistory.push({
            actual: actualBeats,
            quantized: quantizedBeats,
            timestamp: Date.now()
        });
        
        // Keep only recent history
        if (this.performanceHistory.length > 100) {
            this.performanceHistory = this.performanceHistory.slice(-50);
        }
    }
    
    quantizeOnset(actualOnset, previousOnset = null, beatPhase = null) {
        if (!previousOnset) return actualOnset;
        
        const beatDuration = 60 / this.tempo;
        const timeSinceLastOnset = actualOnset - previousOnset;
        
        // Quantize the inter-onset interval
        const quantizedInterval = this.quantizeDuration(timeSinceLastOnset);
        
        // Calculate quantized onset time
        let quantizedOnset = previousOnset + quantizedInterval.duration;
        
        // If we have beat phase information, align to the grid
        if (beatPhase !== null) {
            const gridAlignment = this.alignToGrid(quantizedOnset, beatPhase, beatDuration);
            quantizedOnset = gridAlignment.onset;
        }
        
        return {
            onset: quantizedOnset,
            confidence: quantizedInterval.confidence,
            musicalDuration: quantizedInterval.musicalDuration,
            notationType: quantizedInterval.notationType
        };
    }
    
    alignToGrid(onset, beatPhase, beatDuration) {
        // Find the nearest grid point based on quantization level
        const gridSize = beatDuration / (this.quantizationLevel / 4); // Grid resolution
        const gridPosition = Math.round(onset / gridSize) * gridSize;
        
        // Calculate beat-relative position
        const beatOffset = onset % beatDuration;
        const quantizedBeatOffset = Math.round(beatOffset / gridSize) * gridSize;
        
        const alignedOnset = onset - beatOffset + quantizedBeatOffset;
        
        return {
            onset: alignedOnset,
            gridPosition: gridPosition,
            beatOffset: quantizedBeatOffset
        };
    }
    
    // Advanced rhythm analysis methods
    detectPolyrhythm(onsetTimes) {
        // Detect if the performance contains polyrhythmic patterns
        const intervals = [];
        for (let i = 1; i < onsetTimes.length; i++) {
            intervals.push(onsetTimes[i] - onsetTimes[i-1]);
        }
        
        // Look for multiple periodic patterns
        const periodicities = this.findPeriodicities(intervals);
        
        if (periodicities.length > 1) {
            return {
                detected: true,
                patterns: periodicities,
                suggestion: 'Consider using compound meter or cross-rhythm notation'
            };
        }
        
        return { detected: false };
    }
    
    findPeriodicities(intervals) {
        const tolerance = 0.1;
        const periods = [];
        
        // Group similar intervals
        const groups = {};
        for (const interval of intervals) {
            let foundGroup = false;
            for (const period of Object.keys(groups)) {
                if (Math.abs(interval - parseFloat(period)) < tolerance) {
                    groups[period].push(interval);
                    foundGroup = true;
                    break;
                }
            }
            if (!foundGroup) {
                groups[interval.toFixed(3)] = [interval];
            }
        }
        
        // Filter groups with sufficient occurrences
        for (const [period, occurrences] of Object.entries(groups)) {
            if (occurrences.length >= 3) {
                periods.push({
                    period: parseFloat(period),
                    occurrences: occurrences.length,
                    confidence: occurrences.length / intervals.length
                });
            }
        }
        
        return periods.sort((a, b) => b.confidence - a.confidence);
    }
    
    // Configuration methods
    setSwing(ratio) {
        this.swingRatio = Math.max(0, Math.min(1, ratio));
    }
    
    setHumanization(amount) {
        this.humanization = Math.max(0, Math.min(0.5, amount));
    }
    
    enableAdaptiveQuantization(enabled) {
        this.adaptiveQuantization = enabled;
        if (!enabled) {
            this.performanceHistory = [];
        }
    }
    
    // Diagnostic methods
    getQuantizationStats() {
        return {
            tempo: this.tempo,
            timeSignature: this.timeSignature,
            quantizationLevel: this.quantizationLevel,
            swingRatio: this.swingRatio,
            humanization: this.humanization,
            performanceHistorySize: this.performanceHistory.length,
            adaptiveQuantization: this.adaptiveQuantization
        };
    }
}