class KeyDetector {
    constructor() {
        // Key signature templates with characteristic intervals
        this.keyProfiles = {
            'C': {
                majorScale: [0, 2, 4, 5, 7, 9, 11], // C major scale semitones
                preferredNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
                accidentals: [],
                weight: 1.0
            },
            'G': {
                majorScale: [7, 9, 11, 0, 2, 4, 6], // G major scale
                preferredNotes: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
                accidentals: ['F#'],
                weight: 1.0
            },
            'D': {
                majorScale: [2, 4, 6, 7, 9, 11, 1], // D major scale
                preferredNotes: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
                accidentals: ['F#', 'C#'],
                weight: 1.0
            },
            'A': {
                majorScale: [9, 11, 1, 2, 4, 6, 8], // A major scale
                preferredNotes: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
                accidentals: ['F#', 'C#', 'G#'],
                weight: 1.0
            },
            'E': {
                majorScale: [4, 6, 8, 9, 11, 1, 3], // E major scale
                preferredNotes: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
                accidentals: ['F#', 'C#', 'G#', 'D#'],
                weight: 1.0
            },
            'B': {
                majorScale: [11, 1, 3, 4, 6, 8, 10], // B major scale
                preferredNotes: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
                accidentals: ['F#', 'C#', 'G#', 'D#', 'A#'],
                weight: 1.0
            },
            'F#': {
                majorScale: [6, 8, 10, 11, 1, 3, 5], // F# major scale
                preferredNotes: ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
                accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
                weight: 0.8 // Less common, lower weight
            },
            'F': {
                majorScale: [5, 7, 9, 10, 0, 2, 4], // F major scale
                preferredNotes: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
                accidentals: ['Bb'],
                weight: 1.0
            },
            'Bb': {
                majorScale: [10, 0, 2, 3, 5, 7, 9], // Bb major scale
                preferredNotes: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
                accidentals: ['Bb', 'Eb'],
                weight: 1.0
            },
            'Eb': {
                majorScale: [3, 5, 7, 8, 10, 0, 2], // Eb major scale
                preferredNotes: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
                accidentals: ['Bb', 'Eb', 'Ab'],
                weight: 1.0
            },
            'Ab': {
                majorScale: [8, 10, 0, 1, 3, 5, 7], // Ab major scale
                preferredNotes: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
                accidentals: ['Bb', 'Eb', 'Ab', 'Db'],
                weight: 1.0
            },
            'Db': {
                majorScale: [1, 3, 5, 6, 8, 10, 0], // Db major scale
                preferredNotes: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
                accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
                weight: 0.9
            },
            'Gb': {
                majorScale: [6, 8, 10, 11, 1, 3, 5], // Gb major scale
                preferredNotes: ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
                accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
                weight: 0.8 // Less common
            }
        };
        
        // Note collection for analysis
        this.noteHistory = [];
        this.maxHistoryLength = 50; // Analyze last 50 notes
        this.analysisInterval = 10; // Analyze every 10 notes
        this.noteCount = 0;
        
        // Key detection parameters
        this.keyConfidenceThreshold = 0.6;
        this.minimumNotesForAnalysis = 8;
        
        // Current key state
        this.currentKey = 'C';
        this.keyConfidence = 1.0;
        this.lastKeyChange = 0;
        this.keyChangeInterval = 5000; // Don't change key more than once per 5 seconds
        
        console.log('KeyDetector initialized for automatic key signature detection');
    }
    
    // Add a note to the analysis history
    addNote(noteInfo) {
        if (!noteInfo || !noteInfo.note) return;
        
        // Extract just the note name without octave
        const noteName = noteInfo.note.replace(/\d+/, '');
        
        // Add to history with timestamp
        this.noteHistory.push({
            note: noteName,
            frequency: noteInfo.frequency,
            confidence: noteInfo.confidence || 1.0,
            timestamp: Date.now()
        });
        
        // Limit history length
        if (this.noteHistory.length > this.maxHistoryLength) {
            this.noteHistory.shift();
        }
        
        this.noteCount++;
        
        // Periodically analyze for key changes
        if (this.noteCount % this.analysisInterval === 0) {
            this.analyzeKey();
        }
    }
    
    // Main key analysis function
    analyzeKey() {
        if (this.noteHistory.length < this.minimumNotesForAnalysis) {
            return this.currentKey;
        }
        
        // Don't change key too frequently
        if (Date.now() - this.lastKeyChange < this.keyChangeInterval) {
            return this.currentKey;
        }
        
        // Get recent notes (weighted by recency and confidence)
        const recentNotes = this.getWeightedNoteDistribution();
        
        // Score each possible key
        const keyScores = this.scoreKeys(recentNotes);
        
        // Find the best key
        const bestKey = this.findBestKey(keyScores);
        
        // Only change if confidence is high enough and significantly better
        if (bestKey.key !== this.currentKey && 
            bestKey.confidence > this.keyConfidenceThreshold &&
            bestKey.confidence > this.keyConfidence + 0.15) { // Require significant improvement
            
            console.log(`Key change detected: ${this.currentKey} → ${bestKey.key} (confidence: ${bestKey.confidence.toFixed(2)})`);
            this.currentKey = bestKey.key;
            this.keyConfidence = bestKey.confidence;
            this.lastKeyChange = Date.now();
            
            return {
                key: bestKey.key,
                confidence: bestKey.confidence,
                changed: true,
                alternatives: keyScores
                    .filter(score => score.key !== bestKey.key)
                    .sort((a, b) => b.confidence - a.confidence)
                    .slice(0, 3)
            };
        }
        
        return {
            key: this.currentKey,
            confidence: this.keyConfidence,
            changed: false,
            alternatives: []
        };
    }
    
    // Get weighted note distribution from history
    getWeightedNoteDistribution() {
        const noteWeights = {};
        const currentTime = Date.now();
        
        // Initialize all chromatic notes
        const chromaticNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
                               'Db', 'Eb', 'Gb', 'Ab', 'Bb']; // Include flat equivalents
        chromaticNotes.forEach(note => noteWeights[note] = 0);
        
        this.noteHistory.forEach(noteEntry => {
            const ageWeight = this.calculateAgeWeight(currentTime - noteEntry.timestamp);
            const confidenceWeight = noteEntry.confidence || 1.0;
            const totalWeight = ageWeight * confidenceWeight;
            
            // Handle enharmonic equivalents
            const normalizedNote = this.normalizeNoteName(noteEntry.note);
            noteWeights[normalizedNote] = (noteWeights[normalizedNote] || 0) + totalWeight;
        });
        
        return noteWeights;
    }
    
    // Calculate time-based weight (more recent notes are more important)
    calculateAgeWeight(ageMs) {
        const maxAge = 30000; // 30 seconds
        const normalizedAge = Math.min(ageMs / maxAge, 1);
        return Math.exp(-normalizedAge * 2); // Exponential decay
    }
    
    // Normalize note names for consistent analysis
    normalizeNoteName(noteName) {
        const enharmonicMap = {
            'C#': 'C#', 'Db': 'C#',
            'D#': 'D#', 'Eb': 'D#',
            'F#': 'F#', 'Gb': 'F#',
            'G#': 'G#', 'Ab': 'G#',
            'A#': 'A#', 'Bb': 'A#'
        };
        
        return enharmonicMap[noteName] || noteName;
    }
    
    // Score all possible keys against the note distribution
    scoreKeys(noteDistribution) {
        const scores = [];
        
        Object.entries(this.keyProfiles).forEach(([keyName, keyProfile]) => {
            let score = 0;
            let totalWeight = 0;
            
            // Score based on how well the notes fit this key
            Object.entries(noteDistribution).forEach(([note, weight]) => {
                if (weight > 0) {
                    totalWeight += weight;
                    
                    // Check if note is in the key's preferred notes
                    const isInKey = keyProfile.preferredNotes.includes(note) ||
                                   keyProfile.preferredNotes.includes(this.getEnharmonicEquivalent(note, keyName));
                    
                    if (isInKey) {
                        // Bonus for tonic, dominant, and subdominant
                        const degreeBonus = this.getScaleDegreeBonus(note, keyProfile);
                        score += weight * (1.0 + degreeBonus);
                    } else {
                        // Penalty for notes not in key (but not too harsh)
                        score += weight * 0.2;
                    }
                }
            });
            
            // Normalize score and apply key weight
            const normalizedScore = totalWeight > 0 ? (score / totalWeight) * keyProfile.weight : 0;
            
            scores.push({
                key: keyName,
                confidence: Math.min(1.0, normalizedScore)
            });
        });
        
        return scores.sort((a, b) => b.confidence - a.confidence);
    }
    
    // Get enharmonic equivalent appropriate for the key context
    getEnharmonicEquivalent(note, keyContext) {
        const keyProfile = this.keyProfiles[keyContext];
        if (!keyProfile) return note;
        
        // Check if this key prefers sharps or flats
        const hasFlats = keyProfile.accidentals.some(acc => acc.includes('b'));
        const hasSharps = keyProfile.accidentals.some(acc => acc.includes('#'));
        
        const enharmonicMap = {
            'C#': hasSharps ? 'C#' : 'Db',
            'D#': hasSharps ? 'D#' : 'Eb',
            'F#': hasSharps ? 'F#' : 'Gb',
            'G#': hasSharps ? 'G#' : 'Ab',
            'A#': hasSharps ? 'A#' : 'Bb'
        };
        
        return enharmonicMap[note] || note;
    }
    
    // Give bonus points for important scale degrees
    getScaleDegreeBonus(note, keyProfile) {
        if (!keyProfile.preferredNotes.includes(note)) return 0;
        
        const index = keyProfile.preferredNotes.indexOf(note);
        
        // Tonic, dominant, subdominant get higher scores
        switch (index) {
            case 0: return 0.5; // Tonic
            case 4: return 0.3; // Dominant
            case 3: return 0.2; // Subdominant
            case 6: return 0.2; // Leading tone
            default: return 0.1;
        }
    }
    
    // Find the best key from scores
    findBestKey(keyScores) {
        if (keyScores.length === 0) {
            return { key: 'C', confidence: 0.5 };
        }
        
        const bestScore = keyScores[0];
        
        // Apply additional heuristics
        let adjustedConfidence = bestScore.confidence;
        
        // Boost confidence if there's a clear winner
        if (keyScores.length > 1) {
            const secondBest = keyScores[1];
            const confidenceGap = bestScore.confidence - secondBest.confidence;
            if (confidenceGap > 0.2) {
                adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.1);
            }
        }
        
        // Prefer staying in current key if scores are close
        const currentKeyScore = keyScores.find(score => score.key === this.currentKey);
        if (currentKeyScore && bestScore.confidence - currentKeyScore.confidence < 0.1) {
            return { key: this.currentKey, confidence: currentKeyScore.confidence };
        }
        
        return {
            key: bestScore.key,
            confidence: adjustedConfidence
        };
    }
    
    // Manual key setting (from user configuration)
    setKey(keySignature) {
        this.currentKey = keySignature;
        this.keyConfidence = 1.0;
        this.lastKeyChange = Date.now();
        
        // Clear history to avoid confusion with new key
        this.noteHistory = [];
        
        console.log(`Key manually set to: ${keySignature}`);
    }
    
    // Get current key information
    getCurrentKey() {
        return {
            key: this.currentKey,
            confidence: this.keyConfidence,
            profile: this.keyProfiles[this.currentKey],
            noteCount: this.noteHistory.length
        };
    }
    
    // Get key suggestions based on current analysis
    getKeySuggestions() {
        if (this.noteHistory.length < this.minimumNotesForAnalysis) {
            return {
                currentKey: this.currentKey,
                suggestions: [],
                confidence: 'insufficient_data'
            };
        }
        
        const recentNotes = this.getWeightedNoteDistribution();
        const keyScores = this.scoreKeys(recentNotes);
        
        return {
            currentKey: this.currentKey,
            suggestions: keyScores.slice(0, 5), // Top 5 suggestions
            confidence: keyScores[0]?.confidence || 0,
            noteDistribution: recentNotes
        };
    }
    
    // Enable/disable automatic key detection
    setAutoDetection(enabled) {
        this.autoDetectionEnabled = enabled;
        if (!enabled) {
            console.log('Automatic key detection disabled');
        } else {
            console.log('Automatic key detection enabled');
        }
    }
    
    // Reset detector state
    reset() {
        this.noteHistory = [];
        this.noteCount = 0;
        this.currentKey = 'C';
        this.keyConfidence = 1.0;
        this.lastKeyChange = 0;
        console.log('KeyDetector reset');
    }
    
    // Get statistics for debugging
    getAnalysisStats() {
        const recentNotes = this.getWeightedNoteDistribution();
        const keyScores = this.scoreKeys(recentNotes);
        
        return {
            noteHistory: this.noteHistory.slice(-10), // Last 10 notes
            noteDistribution: recentNotes,
            keyScores: keyScores.slice(0, 5),
            currentKey: this.getCurrentKey(),
            analysisWindow: this.noteHistory.length
        };
    }
}