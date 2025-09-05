class EssentialAIUtilities {
    constructor() {
        this.patternCache = new Map();
        this.errorPatterns = new Map();
        this.sessionCounter = 0;
    }

    // Simple pitch error vs intentional embellishment detection
    classifyPitchDeviation(pitchData, expectedPitch, context = {}) {
        const deviation = Math.abs(pitchData.frequency - expectedPitch);
        const deviationCents = 1200 * Math.log2(pitchData.frequency / expectedPitch);
        
        // Rule-based classification - no ML overhead
        if (deviation < 10) return { type: 'accurate', confidence: 0.95 };
        
        if (Math.abs(deviationCents) > 50) {
            // Check for vibrato pattern
            if (context.hasVibrato && pitchData.stability < 0.3) {
                return { type: 'vibrato', confidence: 0.8 };
            }
            // Check for slide/portamento
            if (pitchData.attack && pitchData.attack.duration > 100) {
                return { type: 'portamento', confidence: 0.75 };
            }
            return { type: 'error', confidence: 0.7, correction: expectedPitch };
        }
        
        return { type: 'minor_deviation', confidence: 0.6 };
    }

    // Simple rhythm error detection
    detectRhythmIssues(timingData, expectedBeat) {
        const deviation = Math.abs(timingData.actual - expectedBeat);
        const tolerance = expectedBeat * 0.1; // 10% tolerance
        
        if (deviation > tolerance) {
            return {
                issue: 'timing',
                severity: deviation > tolerance * 2 ? 'major' : 'minor',
                suggestion: deviation < 0 ? 'slightly late' : 'slightly early'
            };
        }
        
        return { issue: 'none' };
    }

    // Basic chord suggestion from melody
    suggestBasicChords(pitchSequence) {
        if (!pitchSequence || pitchSequence.length < 2) return [];
        
        const notes = pitchSequence.map(p => this.frequencyToNote(p.frequency));
        const uniqueNotes = [...new Set(notes)];
        
        // Simple chord suggestions based on note patterns
        const suggestions = [];
        
        if (uniqueNotes.includes('C') && uniqueNotes.includes('E')) {
            suggestions.push({ chord: 'C Major', confidence: 0.8 });
        }
        if (uniqueNotes.includes('A') && uniqueNotes.includes('C')) {
            suggestions.push({ chord: 'A Minor', confidence: 0.75 });
        }
        if (uniqueNotes.includes('G') && uniqueNotes.includes('B')) {
            suggestions.push({ chord: 'G Major', confidence: 0.7 });
        }
        
        return suggestions.slice(0, 3); // Max 3 suggestions
    }

    // Lightweight pattern tracking for user improvement
    trackUserProgress(sessionData) {
        this.sessionCounter++;
        
        const accuracy = this.calculateSimpleAccuracy(sessionData);
        const improvement = this.measureImprovement(accuracy);
        
        return {
            session: this.sessionCounter,
            accuracy: accuracy,
            improvement: improvement,
            suggestions: this.generateSimpleSuggestions(sessionData)
        };
    }

    calculateSimpleAccuracy(sessionData) {
        if (!sessionData.attempts) return 0;
        
        const correct = sessionData.attempts.filter(a => a.accurate).length;
        return (correct / sessionData.attempts.length) * 100;
    }

    measureImprovement(currentAccuracy) {
        const recentSessions = Array.from(this.patternCache.values()).slice(-5);
        if (recentSessions.length < 2) return null;
        
        const previousAvg = recentSessions.reduce((a, b) => a + b, 0) / recentSessions.length;
        return currentAccuracy - previousAvg;
    }

    generateSimpleSuggestions(sessionData) {
        const suggestions = [];
        
        if (sessionData.pitchAccuracy < 70) {
            suggestions.push("Focus on pitch accuracy - try slower tempo practice");
        }
        
        if (sessionData.rhythmAccuracy < 70) {
            suggestions.push("Work on timing - use metronome practice");
        }
        
        if (sessionData.breathingIssues > 3) {
            suggestions.push("Breathing technique needs attention - try breath control exercises");
        }
        
        return suggestions;
    }

    // Helper method for pitch-to-note conversion
    frequencyToNote(frequency) {
        const A4 = 440;
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        const noteNumber = Math.round(12 * Math.log2(frequency / A4)) + 69;
        const noteName = noteNames[noteNumber % 12];
        
        return noteName;
    }

    // Quick style recognition using simple heuristics
    detectBasicStyle(pitchData, rhythmData, articulationData) {
        const style = {
            name: 'Unknown',
            confidence: 0,
            characteristics: []
        };

        // Simple pattern matching
        if (articulationData && articulationData.vibrato > 0.7) {
            style.characteristics.push('Expressive vibrato');
        }
        
        if (rhythmData && rhythmData.flexibility > 0.6) {
            style.characteristics.push('Flexible timing');
            style.name = 'Expressive/Romantic';
            style.confidence = 0.6;
        }
        
        if (pitchData && pitchData.range > 2) {
            style.characteristics.push('Wide vocal range');
        }

        return style;
    }

    // Memory-efficient cleanup
    cleanup() {
        if (this.patternCache.size > 100) {
            const entries = Array.from(this.patternCache.entries());
            this.patternCache.clear();
            // Keep only the most recent 50 entries
            entries.slice(-50).forEach(([key, value]) => {
                this.patternCache.set(key, value);
            });
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EssentialAIUtilities;
} else {
    window.EssentialAIUtilities = EssentialAIUtilities;
}