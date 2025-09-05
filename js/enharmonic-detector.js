class EnharmonicDetector {
    constructor(keySignature = 'C') {
        this.keySignature = keySignature;
        
        // Define enharmonic equivalences with context-based preferences
        this.enharmonicEquivalents = {
            'C#': ['C#', 'Db'],
            'Db': ['Db', 'C#'],
            'D#': ['D#', 'Eb'],
            'Eb': ['Eb', 'D#'],
            'F#': ['F#', 'Gb'],
            'Gb': ['Gb', 'F#'],
            'G#': ['G#', 'Ab'],
            'Ab': ['Ab', 'G#'],
            'A#': ['A#', 'Bb'],
            'Bb': ['Bb', 'A#']
        };
        
        // Key signature to enharmonic preference mapping
        this.keyPreferences = {
            // Sharp keys prefer sharps
            'C': {}, // No preference
            'G': { sharps: ['F#'] },
            'D': { sharps: ['F#', 'C#'] },
            'A': { sharps: ['F#', 'C#', 'G#'] },
            'E': { sharps: ['F#', 'C#', 'G#', 'D#'] },
            'B': { sharps: ['F#', 'C#', 'G#', 'D#', 'A#'] },
            'F#': { sharps: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'] },
            'C#': { sharps: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'] },
            
            // Flat keys prefer flats
            'F': { flats: ['Bb'] },
            'Bb': { flats: ['Bb', 'Eb'] },
            'Eb': { flats: ['Bb', 'Eb', 'Ab'] },
            'Ab': { flats: ['Bb', 'Eb', 'Ab', 'Db'] },
            'Db': { flats: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'] },
            'Gb': { flats: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'] },
            'Cb': { flats: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'] }
        };
        
        // Harmonic series ratios for better pitch accuracy
        this.harmonicRatios = [
            1,      // Fundamental
            2,      // Octave
            3,      // Perfect 5th (octave + 5th)
            4,      // Double octave
            5,      // Major 3rd (double octave + major 3rd)
            6,      // Perfect 5th (double octave + 5th)
            7,      // Minor 7th (slightly flat)
            8,      // Triple octave
            9,      // Major 2nd (triple octave + major 2nd)
            10,     // Major 3rd (triple octave + major 3rd)
            11,     // Augmented 4th (slightly flat)
            12,     // Perfect 5th (triple octave + 5th)
            13,     // Minor 6th (slightly flat)
            14,     // Minor 7th (slightly flat)
            15,     // Major 7th (slightly flat)
            16      // Quadruple octave
        ];
        
        // Cents tolerance for harmonic matching
        this.harmonicTolerance = 15; // cents
        
        // Previous note context for better enharmonic decisions
        this.noteHistory = [];
        this.historyLength = 5;
        
        console.log('EnharmonicDetector initialized for precise pitch spelling');
    }
    
    // Enhanced frequency to note conversion with enharmonic intelligence
    frequencyToNote(frequency, previousNote = null) {
        if (frequency <= 0) return { note: '--', octave: 0, cents: 0 };
        
        // Calculate the MIDI note number with high precision
        const midiNote = this.frequencyToMIDI(frequency);
        const noteNumber = Math.round(midiNote);
        const centDeviation = Math.round((midiNote - noteNumber) * 100);
        
        // Get the base note name without considering enharmonics yet
        const baseNoteName = this.midiToNoteName(noteNumber);
        const octave = Math.floor(noteNumber / 12) - 1;
        
        // Determine the best enharmonic spelling
        const enharmonicSpelling = this.determineEnharmonicSpelling(
            baseNoteName, 
            octave, 
            previousNote,
            centDeviation
        );
        
        // Detect if this might be a harmonic of a fundamental
        const harmonicInfo = this.analyzeHarmonicContent(frequency);
        
        return {
            note: enharmonicSpelling,
            octave: octave,
            cents: centDeviation,
            frequency: frequency,
            targetFreq: this.midiToFrequency(noteNumber),
            midiNote: noteNumber,
            harmonicInfo: harmonicInfo,
            confidence: this.calculateNoteConfidence(centDeviation, harmonicInfo)
        };
    }
    
    frequencyToMIDI(frequency) {
        // A4 = 440 Hz = MIDI note 69
        return 69 + 12 * Math.log2(frequency / 440);
    }
    
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }
    
    midiToNoteName(midiNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return noteNames[midiNote % 12];
    }
    
    determineEnharmonicSpelling(baseNoteName, octave, previousNote, centDeviation) {
        // If it's a natural note, no enharmonic choice needed
        if (!baseNoteName.includes('#')) {
            return baseNoteName;
        }
        
        // Get enharmonic options
        const enharmonicOptions = this.enharmonicEquivalents[baseNoteName] || [baseNoteName];
        
        if (enharmonicOptions.length === 1) {
            return baseNoteName;
        }
        
        // Factor 1: Key signature preference
        const keyPreference = this.getKeySignaturePreference(enharmonicOptions);
        let score = { [enharmonicOptions[0]]: 0, [enharmonicOptions[1]]: 0 };
        
        if (keyPreference) {
            score[keyPreference] += 3;
        }
        
        // Factor 2: Harmonic context (previous note relationships)
        if (previousNote) {
            const harmonicScore = this.calculateHarmonicScore(enharmonicOptions, previousNote);
            score[enharmonicOptions[0]] += harmonicScore[0];
            score[enharmonicOptions[1]] += harmonicScore[1];
        }
        
        // Factor 3: Note history pattern analysis
        const historyScore = this.analyzeNoteHistoryPattern(enharmonicOptions);
        score[enharmonicOptions[0]] += historyScore[0];
        score[enharmonicOptions[1]] += historyScore[1];
        
        // Factor 4: Prefer simpler spellings for slightly off-pitch notes
        if (Math.abs(centDeviation) > 25) {
            // If significantly detuned, prefer the more common spelling
            const commonSpelling = this.getCommonSpelling(baseNoteName);
            if (commonSpelling) {
                score[commonSpelling] += 1;
            }
        }
        
        // Return the highest scoring option
        return score[enharmonicOptions[0]] >= score[enharmonicOptions[1]] 
            ? enharmonicOptions[0] 
            : enharmonicOptions[1];
    }
    
    getKeySignaturePreference(enharmonicOptions) {
        const keyInfo = this.keyPreferences[this.keySignature];
        if (!keyInfo) return null;
        
        for (const option of enharmonicOptions) {
            if (keyInfo.sharps && keyInfo.sharps.includes(option)) return option;
            if (keyInfo.flats && keyInfo.flats.includes(option)) return option;
        }
        
        return null;
    }
    
    calculateHarmonicScore(enharmonicOptions, previousNote) {
        // Analyze harmonic relationships between current options and previous note
        const scores = [0, 0];
        
        if (!previousNote || !previousNote.note) return scores;
        
        // Common harmonic intervals and their preferences
        const harmonicIntervals = {
            'perfect-5th': 2,
            'major-3rd': 1.5,
            'perfect-4th': 1.5,
            'minor-3rd': 1,
            'major-2nd': 0.5,
            'minor-2nd': -1, // Generally avoid unless in chromatic passages
            'tritone': -0.5
        };
        
        enharmonicOptions.forEach((option, index) => {
            const interval = this.calculateInterval(previousNote.note, option);
            if (harmonicIntervals[interval]) {
                scores[index] += harmonicIntervals[interval];
            }
        });
        
        return scores;
    }
    
    calculateInterval(note1, note2) {
        // Simplified interval calculation for harmonic scoring
        const semitones1 = this.noteToSemitones(note1);
        const semitones2 = this.noteToSemitones(note2);
        const interval = Math.abs(semitones2 - semitones1) % 12;
        
        switch (interval) {
            case 0: return 'unison';
            case 1: case 11: return 'minor-2nd';
            case 2: case 10: return 'major-2nd';
            case 3: case 9: return 'minor-3rd';
            case 4: case 8: return 'major-3rd';
            case 5: case 7: return 'perfect-4th';
            case 6: return 'tritone';
            default: return 'unknown';
        }
    }
    
    noteToSemitones(noteName) {
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        const baseNote = noteName.replace(/\d+/, '');
        return noteMap[baseNote] || 0;
    }
    
    analyzeNoteHistoryPattern(enharmonicOptions) {
        // Analyze recent note history to prefer consistent spellings
        const scores = [0, 0];
        
        if (this.noteHistory.length < 2) return scores;
        
        // Look for patterns: if recent notes favor sharps or flats
        let sharpCount = 0;
        let flatCount = 0;
        
        this.noteHistory.forEach(note => {
            if (note.includes('#')) sharpCount++;
            if (note.includes('b')) flatCount++;
        });
        
        // Prefer consistency with recent pattern
        if (sharpCount > flatCount) {
            const sharpIndex = enharmonicOptions.findIndex(opt => opt.includes('#'));
            if (sharpIndex >= 0) scores[sharpIndex] += 1;
        } else if (flatCount > sharpCount) {
            const flatIndex = enharmonicOptions.findIndex(opt => opt.includes('b'));
            if (flatIndex >= 0) scores[flatIndex] += 1;
        }
        
        return scores;
    }
    
    getCommonSpelling(baseNoteName) {
        // Return the more commonly used spelling
        const commonSpellings = {
            'C#': 'C#', 'Db': 'Db',
            'D#': 'Eb', 'Eb': 'Eb',
            'F#': 'F#', 'Gb': 'Gb',
            'G#': 'Ab', 'Ab': 'Ab',
            'A#': 'Bb', 'Bb': 'Bb'
        };
        
        return commonSpellings[baseNoteName];
    }
    
    analyzeHarmonicContent(frequency) {
        // Analyze if this frequency aligns with harmonic series
        const potentialFundamentals = [];
        
        for (let i = 1; i <= 16; i++) {
            const fundamental = frequency / this.harmonicRatios[i - 1];
            const midiNote = this.frequencyToMIDI(fundamental);
            const centDeviation = Math.abs((midiNote - Math.round(midiNote)) * 100);
            
            if (centDeviation < this.harmonicTolerance) {
                potentialFundamentals.push({
                    harmonic: i,
                    fundamental: fundamental,
                    fundamentalNote: this.midiToNoteName(Math.round(midiNote)),
                    accuracy: this.harmonicTolerance - centDeviation
                });
            }
        }
        
        // Sort by accuracy and return best matches
        potentialFundamentals.sort((a, b) => b.accuracy - a.accuracy);
        
        return {
            isLikelyHarmonic: potentialFundamentals.length > 0,
            harmonicCandidates: potentialFundamentals.slice(0, 3), // Top 3 candidates
            fundamentalFrequency: potentialFundamentals[0]?.fundamental || frequency
        };
    }
    
    calculateNoteConfidence(centDeviation, harmonicInfo) {
        let confidence = 1.0;
        
        // Reduce confidence based on tuning deviation
        const tuningFactor = Math.max(0, 1 - Math.abs(centDeviation) / 50); // Full confidence within 50 cents
        confidence *= tuningFactor;
        
        // Boost confidence if it's likely a harmonic
        if (harmonicInfo.isLikelyHarmonic && harmonicInfo.harmonicCandidates.length > 0) {
            const harmonicBoost = Math.min(0.2, harmonicInfo.harmonicCandidates[0].accuracy / 100);
            confidence = Math.min(1.0, confidence + harmonicBoost);
        }
        
        return confidence;
    }
    
    updateNoteHistory(note) {
        this.noteHistory.push(note);
        if (this.noteHistory.length > this.historyLength) {
            this.noteHistory.shift();
        }
    }
    
    setKeySignature(keySignature) {
        this.keySignature = keySignature;
        console.log(`EnharmonicDetector key signature set to: ${keySignature}`);
    }
    
    // Public API for getting detailed pitch analysis
    analyzeFrequency(frequency, context = {}) {
        const previousNote = context.previousNote || null;
        const result = this.frequencyToNote(frequency, previousNote);
        
        // Update history
        this.updateNoteHistory(result.note);
        
        return {
            ...result,
            enharmonicAlternatives: this.enharmonicEquivalents[result.note.replace(/\d+/, '')] || [],
            keyContext: this.keySignature,
            recommendedSpelling: result.note
        };
    }
    
    // Batch analysis for chord detection
    analyzeChord(frequencies) {
        const notes = frequencies.map((freq, index) => ({
            frequency: freq,
            analysis: this.analyzeFrequency(freq, {
                previousNote: index > 0 ? this.analyzeFrequency(frequencies[index - 1]) : null
            })
        }));
        
        return {
            notes: notes,
            chordRoot: this.determineChordRoot(notes),
            keyCenter: this.analyzeKeyCenter(notes)
        };
    }
    
    determineChordRoot(notes) {
        // Simple chord root detection based on lowest note and harmonic relationships
        if (notes.length === 0) return null;
        
        const sortedNotes = notes.sort((a, b) => a.frequency - b.frequency);
        return sortedNotes[0].analysis;
    }
    
    analyzeKeyCenter(notes) {
        // Analyze the collection of notes to suggest a key center
        const noteNames = notes.map(n => n.analysis.note.replace(/\d+/, ''));
        const uniqueNotes = [...new Set(noteNames)];
        
        // Simple key analysis - could be enhanced with more sophisticated algorithms
        return {
            likelyKey: this.keySignature, // Placeholder - real implementation would analyze note relationships
            confidence: 0.5,
            alternativeKeys: []
        };
    }
    
    // Reset detector state
    reset() {
        this.noteHistory = [];
        console.log('EnharmonicDetector reset');
    }
}