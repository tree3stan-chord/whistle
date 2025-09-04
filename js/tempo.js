/**
 * Real-time Tempo Tracking and Beat Detection
 * Analyzes inter-onset intervals to detect tempo and musical timing
 */
class TempoTracker {
    constructor() {
        // Onset timing history
        this.onsetHistory = [];
        this.maxHistoryLength = 16; // Track last 16 onsets
        
        // Tempo detection parameters
        this.minTempo = 60;   // BPM
        this.maxTempo = 200;  // BPM  
        this.currentTempo = null;
        this.tempoConfidence = 0;
        
        // Inter-onset interval analysis
        this.intervals = [];
        this.maxIntervals = 8; // Analyze last 8 intervals
        
        // Beat tracking
        this.beatPhase = 0; // Current position in beat cycle (0-1)
        this.lastBeatTime = 0;
        this.beatPredictionWindow = 50; // ms tolerance for beat prediction
        
        // Tempo stability
        this.tempoHistory = new Array(5).fill(null);
        this.tempoHistoryIndex = 0;
        
        console.log('TempoTracker initialized');
    }
    
    /**
     * Add a new note onset for tempo analysis
     * @param {number} timestamp - Onset time in milliseconds
     * @param {Object} noteInfo - Note information (optional)
     */
    addOnset(timestamp, noteInfo = null) {
        // Add to onset history
        this.onsetHistory.push({
            time: timestamp,
            note: noteInfo
        });
        
        // Limit history size
        if (this.onsetHistory.length > this.maxHistoryLength) {
            this.onsetHistory.shift();
        }
        
        // Calculate inter-onset intervals
        this.updateIntervals();
        
        // Analyze tempo
        this.analyzeTempo();
        
        // Update beat phase
        this.updateBeatPhase(timestamp);
        
        return this.getCurrentTempoInfo();
    }
    
    updateIntervals() {
        if (this.onsetHistory.length < 2) return;
        
        this.intervals = [];
        
        // Calculate intervals between consecutive onsets
        for (let i = 1; i < this.onsetHistory.length; i++) {
            const interval = this.onsetHistory[i].time - this.onsetHistory[i-1].time;
            
            // Filter out unrealistic intervals (too fast or too slow)
            if (interval > 200 && interval < 2000) {
                this.intervals.push(interval);
            }
        }
        
        // Keep only recent intervals
        if (this.intervals.length > this.maxIntervals) {
            this.intervals = this.intervals.slice(-this.maxIntervals);
        }
    }
    
    analyzeTempo() {
        if (this.intervals.length < 3) {
            this.currentTempo = null;
            this.tempoConfidence = 0;
            return;
        }
        
        // Try different tempo hypotheses
        const tempoHypotheses = this.generateTempoHypotheses();
        let bestTempo = null;
        let bestScore = 0;
        
        for (const hypothesis of tempoHypotheses) {
            const score = this.scoreTempoHypothesis(hypothesis);
            
            if (score > bestScore) {
                bestScore = score;
                bestTempo = hypothesis;
            }
        }
        
        // Update tempo if we have a good match
        if (bestScore > 0.6 && bestTempo) {
            this.currentTempo = bestTempo;
            this.tempoConfidence = bestScore;
            this.updateTempoHistory(bestTempo);
        } else {
            this.tempoConfidence = Math.max(0, this.tempoConfidence - 0.1);
        }
    }
    
    generateTempoHypotheses() {
        const hypotheses = [];
        
        // Use intervals to generate tempo candidates
        for (const interval of this.intervals) {
            const bpm = 60000 / interval; // Convert ms to BPM
            
            if (bpm >= this.minTempo && bpm <= this.maxTempo) {
                hypotheses.push(bpm);
                
                // Also consider half-time and double-time
                if (bpm * 2 <= this.maxTempo) {
                    hypotheses.push(bpm * 2);
                }
                if (bpm / 2 >= this.minTempo) {
                    hypotheses.push(bpm / 2);
                }
            }
        }
        
        // Remove duplicates and sort
        return [...new Set(hypotheses.map(t => Math.round(t)))].sort((a, b) => a - b);
    }
    
    scoreTempoHypothesis(tempoBPM) {
        const expectedInterval = 60000 / tempoBPM; // ms per beat
        let matchCount = 0;
        let totalError = 0;
        
        for (const interval of this.intervals) {
            // Check if interval matches expected beat length (or multiples)
            const ratios = [1, 2, 0.5, 3, 1/3, 4, 0.25]; // Common rhythmic relationships
            
            let bestError = Infinity;
            
            for (const ratio of ratios) {
                const expectedForRatio = expectedInterval * ratio;
                const error = Math.abs(interval - expectedForRatio) / expectedForRatio;
                
                if (error < bestError) {
                    bestError = error;
                }
            }
            
            // If error is small enough, count as match
            if (bestError < 0.15) { // 15% tolerance
                matchCount++;
                totalError += bestError;
            }
        }
        
        if (matchCount === 0) return 0;
        
        // Score combines match ratio and accuracy
        const matchRatio = matchCount / this.intervals.length;
        const accuracy = 1 - (totalError / matchCount);
        
        return matchRatio * accuracy;
    }
    
    updateTempoHistory(tempo) {
        this.tempoHistory[this.tempoHistoryIndex] = tempo;
        this.tempoHistoryIndex = (this.tempoHistoryIndex + 1) % this.tempoHistory.length;
    }
    
    getTempoStability() {
        const validTempos = this.tempoHistory.filter(t => t !== null);
        if (validTempos.length < 3) return 0;
        
        const mean = validTempos.reduce((a, b) => a + b, 0) / validTempos.length;
        const variance = validTempos.reduce((a, b) => a + (b - mean) ** 2, 0) / validTempos.length;
        const stdDev = Math.sqrt(variance);
        
        // Return stability as inverse of coefficient of variation
        return mean > 0 ? 1 / (1 + stdDev / mean) : 0;
    }
    
    updateBeatPhase(timestamp) {
        if (!this.currentTempo) return;
        
        const beatInterval = 60000 / this.currentTempo; // ms per beat
        
        if (this.lastBeatTime === 0) {
            this.lastBeatTime = timestamp;
            this.beatPhase = 0;
            return;
        }
        
        const timeSinceLastBeat = timestamp - this.lastBeatTime;
        this.beatPhase = (timeSinceLastBeat % beatInterval) / beatInterval;
    }
    
    /**
     * Predict the next beat time
     * @returns {number|null} - Predicted beat time in ms, or null if no tempo
     */
    predictNextBeat() {
        if (!this.currentTempo || this.lastBeatTime === 0) return null;
        
        const beatInterval = 60000 / this.currentTempo;
        const timeSinceLastBeat = Date.now() - this.lastBeatTime;
        const timeToNextBeat = beatInterval - (timeSinceLastBeat % beatInterval);
        
        return Date.now() + timeToNextBeat;
    }
    
    /**
     * Check if a timestamp is close to a predicted beat
     * @param {number} timestamp - Time to check
     * @returns {boolean} - True if timestamp is near a beat
     */
    isNearBeat(timestamp) {
        const nextBeat = this.predictNextBeat();
        if (!nextBeat) return false;
        
        return Math.abs(timestamp - nextBeat) < this.beatPredictionWindow;
    }
    
    getCurrentTempoInfo() {
        return {
            tempo: this.currentTempo,
            confidence: this.tempoConfidence,
            stability: this.getTempoStability(),
            beatPhase: this.beatPhase,
            nextBeat: this.predictNextBeat(),
            intervalCount: this.intervals.length,
            recentInterval: this.intervals.length > 0 ? this.intervals[this.intervals.length - 1] : null
        };
    }
    
    /**
     * Reset tempo tracking (e.g., when starting new performance)
     */
    reset() {
        this.onsetHistory = [];
        this.intervals = [];
        this.currentTempo = null;
        this.tempoConfidence = 0;
        this.beatPhase = 0;
        this.lastBeatTime = 0;
        this.tempoHistory.fill(null);
        this.tempoHistoryIndex = 0;
    }
    
    /**
     * Manually set tempo (for testing or user input)
     * @param {number} tempoBPM - Tempo in beats per minute
     */
    setTempo(tempoBPM) {
        if (tempoBPM >= this.minTempo && tempoBPM <= this.maxTempo) {
            this.currentTempo = tempoBPM;
            this.tempoConfidence = 1.0;
            this.lastBeatTime = Date.now();
            this.beatPhase = 0;
        }
    }
}