/**
 * HarmonicContextAnalyzer - Advanced harmonic and musical context analysis
 * Phase 8: Harmonic Context Analysis System
 * 
 * Features:
 * - Chord progression detection from vocal melody
 * - Key modulation tracking throughout performance
 * - Modal analysis and scale system detection
 * - Voice leading and melodic movement analysis
 * - Harmonic rhythm analysis
 * - Tonal center detection and stability
 */

class HarmonicContextAnalyzer {
    constructor(pitchDetector, vocalTranscriptionEngine) {
        this.pitchDetector = pitchDetector;
        this.vocalEngine = vocalTranscriptionEngine;
        
        // Musical knowledge base
        this.scales = this.initializeScales();
        this.chords = this.initializeChords();
        this.modes = this.initializeModes();
        this.keySignatures = this.initializeKeySignatures();
        
        // Analysis state
        this.currentKey = 'C';
        this.currentScale = 'major';
        this.currentMode = 'ionian';
        this.harmonicRhythm = [];
        this.chordProgression = [];
        this.keyModulations = [];
        this.modalInterchange = [];
        
        // Analysis parameters
        this.analysisWindow = 2000; // 2 seconds for harmonic analysis
        this.keyConfidenceThreshold = 0.7;
        this.chordConfidenceThreshold = 0.6;
        this.modulationSensitivity = 0.8;
        
        // Harmonic analysis engines
        this.keyDetector = new KeyDetectionEngine();
        this.chordDetector = new ChordProgressionDetector();
        this.modalAnalyzer = new ModalAnalysisEngine();
        this.voiceLeadingAnalyzer = new VoiceLeadingAnalyzer();
        this.tonalCenterDetector = new TonalCenterDetector();
        
        console.log('🎼 Harmonic Context Analyzer initialized');
    }

    /**
     * Initialize musical scales database
     */
    initializeScales() {
        return {
            'major': {
                intervals: [0, 2, 4, 5, 7, 9, 11],
                formula: 'W-W-H-W-W-W-H',
                characteristics: ['bright', 'stable', 'consonant'],
                chordProgression: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
            },
            'natural_minor': {
                intervals: [0, 2, 3, 5, 7, 8, 10],
                formula: 'W-H-W-W-H-W-W',
                characteristics: ['dark', 'melancholic', 'emotional'],
                chordProgression: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']
            },
            'harmonic_minor': {
                intervals: [0, 2, 3, 5, 7, 8, 11],
                formula: 'W-H-W-W-H-W+H-H',
                characteristics: ['exotic', 'dramatic', 'classical'],
                chordProgression: ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°']
            },
            'melodic_minor': {
                intervals: [0, 2, 3, 5, 7, 9, 11],
                formula: 'W-H-W-W-W-W-H',
                characteristics: ['ascending', 'jazz', 'sophisticated'],
                chordProgression: ['i', 'ii', 'III+', 'IV', 'V', 'vi°', 'vii°']
            },
            'dorian': {
                intervals: [0, 2, 3, 5, 7, 9, 10],
                formula: 'W-H-W-W-W-H-W',
                characteristics: ['modal', 'folk', 'medieval'],
                chordProgression: ['i', 'ii', 'III', 'IV', 'v°', 'vi', 'VII']
            },
            'pentatonic_major': {
                intervals: [0, 2, 4, 7, 9],
                formula: 'W-W-W+H-W-W+H',
                characteristics: ['asian', 'folk', 'simple'],
                chordProgression: ['I', 'ii', 'iii', 'V', 'vi']
            },
            'pentatonic_minor': {
                intervals: [0, 3, 5, 7, 10],
                formula: 'W+H-W-W-W+H-W',
                characteristics: ['blues', 'rock', 'emotional'],
                chordProgression: ['i', 'III', 'IV', 'v', 'VII']
            },
            'blues': {
                intervals: [0, 3, 5, 6, 7, 10],
                formula: 'W+H-W-H-H-W+H-W',
                characteristics: ['blues', 'jazzy', 'soulful'],
                chordProgression: ['I7', 'IV7', 'V7']
            }
        };
    }

    /**
     * Initialize chord types database
     */
    initializeChords() {
        return {
            'major': { intervals: [0, 4, 7], quality: 'major', tension: 0 },
            'minor': { intervals: [0, 3, 7], quality: 'minor', tension: 0.2 },
            'diminished': { intervals: [0, 3, 6], quality: 'diminished', tension: 0.8 },
            'augmented': { intervals: [0, 4, 8], quality: 'augmented', tension: 0.9 },
            'major7': { intervals: [0, 4, 7, 11], quality: 'major', tension: 0.1 },
            'minor7': { intervals: [0, 3, 7, 10], quality: 'minor', tension: 0.3 },
            'dominant7': { intervals: [0, 4, 7, 10], quality: 'dominant', tension: 0.5 },
            'diminished7': { intervals: [0, 3, 6, 9], quality: 'diminished', tension: 1.0 },
            'half_diminished7': { intervals: [0, 3, 6, 10], quality: 'half_diminished', tension: 0.7 },
            'major_add9': { intervals: [0, 2, 4, 7], quality: 'major', tension: 0.2 },
            'suspended2': { intervals: [0, 2, 7], quality: 'suspended', tension: 0.4 },
            'suspended4': { intervals: [0, 5, 7], quality: 'suspended', tension: 0.4 }
        };
    }

    /**
     * Initialize modal scales
     */
    initializeModes() {
        return {
            'ionian': { intervals: [0, 2, 4, 5, 7, 9, 11], brightness: 0.8, character: 'major' },
            'dorian': { intervals: [0, 2, 3, 5, 7, 9, 10], brightness: 0.4, character: 'minor_modal' },
            'phrygian': { intervals: [0, 1, 3, 5, 7, 8, 10], brightness: 0.1, character: 'dark_modal' },
            'lydian': { intervals: [0, 2, 4, 6, 7, 9, 11], brightness: 0.9, character: 'bright_modal' },
            'mixolydian': { intervals: [0, 2, 4, 5, 7, 9, 10], brightness: 0.7, character: 'dominant' },
            'aeolian': { intervals: [0, 2, 3, 5, 7, 8, 10], brightness: 0.2, character: 'natural_minor' },
            'locrian': { intervals: [0, 1, 3, 5, 6, 8, 10], brightness: 0.0, character: 'diminished' }
        };
    }

    /**
     * Initialize key signatures
     */
    initializeKeySignatures() {
        return {
            'C': { sharps: 0, flats: 0, accidentals: [] },
            'G': { sharps: 1, flats: 0, accidentals: ['F#'] },
            'D': { sharps: 2, flats: 0, accidentals: ['F#', 'C#'] },
            'A': { sharps: 3, flats: 0, accidentals: ['F#', 'C#', 'G#'] },
            'E': { sharps: 4, flats: 0, accidentals: ['F#', 'C#', 'G#', 'D#'] },
            'B': { sharps: 5, flats: 0, accidentals: ['F#', 'C#', 'G#', 'D#', 'A#'] },
            'F#': { sharps: 6, flats: 0, accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'] },
            'C#': { sharps: 7, flats: 0, accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'] },
            'F': { sharps: 0, flats: 1, accidentals: ['Bb'] },
            'Bb': { sharps: 0, flats: 2, accidentals: ['Bb', 'Eb'] },
            'Eb': { sharps: 0, flats: 3, accidentals: ['Bb', 'Eb', 'Ab'] },
            'Ab': { sharps: 0, flats: 4, accidentals: ['Bb', 'Eb', 'Ab', 'Db'] },
            'Db': { sharps: 0, flats: 5, accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'] },
            'Gb': { sharps: 0, flats: 6, accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'] },
            'Cb': { sharps: 0, flats: 7, accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'] }
        };
    }

    /**
     * Analyze harmonic context from vocal melody
     * @param {Array} pitchData - Array of pitch detection data
     * @param {Object} rhythmData - Rhythm and timing analysis
     */
    async analyzeHarmonicContext(pitchData, rhythmData) {
        if (!pitchData || pitchData.length === 0) return null;
        
        try {
            // Step 1: Detect current key and scale
            const keyAnalysis = await this.analyzeKey(pitchData);
            
            // Step 2: Detect chord progressions
            const chordAnalysis = await this.analyzeChordProgression(pitchData, rhythmData);
            
            // Step 3: Track key modulations
            const modulationAnalysis = await this.trackModulations(pitchData, keyAnalysis);
            
            // Step 4: Analyze modal characteristics
            const modalAnalysis = await this.analyzeModalContext(pitchData, keyAnalysis);
            
            // Step 5: Analyze voice leading patterns
            const voiceLeadingAnalysis = await this.analyzeVoiceLeading(pitchData);
            
            // Step 6: Detect tonal centers and stability
            const tonalAnalysis = await this.analyzeTonalStability(pitchData, keyAnalysis);
            
            return {
                timestamp: Date.now(),
                key: keyAnalysis,
                chords: chordAnalysis,
                modulations: modulationAnalysis,
                modal: modalAnalysis,
                voiceLeading: voiceLeadingAnalysis,
                tonal: tonalAnalysis,
                confidence: this.calculateHarmonicConfidence(keyAnalysis, chordAnalysis, modalAnalysis)
            };
            
        } catch (error) {
            console.error('Harmonic context analysis failed:', error);
            return null;
        }
    }

    /**
     * Analyze key and scale from pitch data
     * @param {Array} pitchData - Pitch detection data
     */
    async analyzeKey(pitchData) {
        const pitchClasses = this.extractPitchClasses(pitchData);
        const keyScores = {};
        
        // Test each key signature
        for (const [keyName, keyInfo] of Object.entries(this.keySignatures)) {
            for (const [scaleName, scaleInfo] of Object.entries(this.scales)) {
                const score = this.calculateKeyScaleScore(pitchClasses, keyName, scaleInfo);
                const keyScaleName = `${keyName}_${scaleName}`;
                keyScores[keyScaleName] = {
                    key: keyName,
                    scale: scaleName,
                    score: score,
                    confidence: Math.min(1.0, score / pitchClasses.length)
                };
            }
        }
        
        // Find best key/scale combination
        const bestMatch = Object.values(keyScores).reduce((best, current) => 
            current.score > best.score ? current : best
        );
        
        // Update current key if confidence is high enough
        if (bestMatch.confidence > this.keyConfidenceThreshold) {
            const previousKey = this.currentKey;
            this.currentKey = bestMatch.key;
            this.currentScale = bestMatch.scale;
            
            if (previousKey !== bestMatch.key) {
                console.log(`🎼 Key change detected: ${previousKey} → ${bestMatch.key} ${bestMatch.scale}`);
            }
        }
        
        return {
            key: bestMatch.key,
            scale: bestMatch.scale,
            confidence: bestMatch.confidence,
            alternatives: Object.values(keyScores)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5),
            stability: this.calculateKeyStability(pitchClasses, bestMatch)
        };
    }

    /**
     * Analyze chord progression from melody
     * @param {Array} pitchData - Pitch detection data
     * @param {Object} rhythmData - Rhythm analysis data
     */
    async analyzeChordProgression(pitchData, rhythmData) {
        const chordProgression = [];
        const harmonicRhythm = rhythmData ? this.extractHarmonicRhythm(rhythmData) : null;
        
        // Segment melody into harmonic units
        const harmonicSegments = this.segmentIntoHarmonicUnits(pitchData, harmonicRhythm);
        
        for (const segment of harmonicSegments) {
            const chordAnalysis = await this.chordDetector.analyzeSegment(
                segment,
                this.currentKey,
                this.currentScale
            );
            
            if (chordAnalysis && chordAnalysis.confidence > this.chordConfidenceThreshold) {
                chordProgression.push({
                    startTime: segment.startTime,
                    endTime: segment.endTime,
                    chord: chordAnalysis.chord,
                    function: chordAnalysis.function,
                    quality: chordAnalysis.quality,
                    inversion: chordAnalysis.inversion,
                    confidence: chordAnalysis.confidence,
                    tension: chordAnalysis.tension
                });
            }
        }
        
        return {
            progression: chordProgression,
            harmonicRhythm: harmonicRhythm,
            cadences: this.detectCadences(chordProgression),
            functionality: this.analyzeFunctionalHarmony(chordProgression),
            complexity: this.calculateHarmonicComplexity(chordProgression)
        };
    }

    /**
     * Track key modulations throughout the performance
     * @param {Array} pitchData - Pitch detection data
     * @param {Object} keyAnalysis - Current key analysis
     */
    async trackModulations(pitchData, keyAnalysis) {
        const modulations = [];
        const keyHistory = this.getKeyHistory();
        
        // Detect modulations based on key changes over time
        if (keyHistory.length > 1) {
            const recentKeys = keyHistory.slice(-5); // Look at last 5 key analyses
            
            for (let i = 1; i < recentKeys.length; i++) {
                const prevKey = recentKeys[i-1];
                const currentKey = recentKeys[i];
                
                if (prevKey.key !== currentKey.key) {
                    const modulationType = this.classifyModulation(prevKey.key, currentKey.key);
                    const modulationStrength = this.calculateModulationStrength(prevKey, currentKey);
                    
                    if (modulationStrength > this.modulationSensitivity) {
                        modulations.push({
                            fromKey: prevKey.key,
                            toKey: currentKey.key,
                            fromScale: prevKey.scale,
                            toScale: currentKey.scale,
                            type: modulationType,
                            strength: modulationStrength,
                            timestamp: currentKey.timestamp,
                            confidence: Math.min(prevKey.confidence, currentKey.confidence)
                        });
                    }
                }
            }
        }
        
        return {
            modulations: modulations,
            modulationPattern: this.analyzeModulationPattern(modulations),
            tonalStability: this.calculateTonalStability(keyHistory),
            currentTonalCenter: keyAnalysis.key
        };
    }

    /**
     * Analyze modal characteristics and context
     * @param {Array} pitchData - Pitch detection data
     * @param {Object} keyAnalysis - Key analysis results
     */
    async analyzeModalContext(pitchData, keyAnalysis) {
        const pitchClasses = this.extractPitchClasses(pitchData);
        const modalScores = {};
        
        // Test each mode against the pitch data
        for (const [modeName, modeInfo] of Object.entries(this.modes)) {
            const score = this.calculateModalScore(pitchClasses, keyAnalysis.key, modeInfo);
            modalScores[modeName] = {
                mode: modeName,
                score: score,
                confidence: Math.min(1.0, score / pitchClasses.length),
                brightness: modeInfo.brightness,
                character: modeInfo.character
            };
        }
        
        // Find best modal match
        const bestMode = Object.values(modalScores).reduce((best, current) => 
            current.score > best.score ? current : best
        );
        
        return {
            primaryMode: bestMode.mode,
            confidence: bestMode.confidence,
            brightness: bestMode.brightness,
            character: bestMode.character,
            modalMixture: this.detectModalMixture(modalScores),
            alternatives: Object.values(modalScores)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
        };
    }

    /**
     * Analyze voice leading patterns in the melody
     * @param {Array} pitchData - Pitch detection data
     */
    async analyzeVoiceLeading(pitchData) {
        const intervals = this.calculateMelodicIntervals(pitchData);
        const patterns = this.voiceLeadingAnalyzer.analyzePatterns(intervals);
        
        return {
            stepwiseMotion: patterns.stepwise,
            leaps: patterns.leaps,
            direction: patterns.direction,
            contour: patterns.contour,
            sequences: patterns.sequences,
            smoothness: this.calculateMelodicSmoothness(intervals),
            complexity: this.calculateMelodicComplexity(intervals)
        };
    }

    /**
     * Analyze tonal stability and center
     * @param {Array} pitchData - Pitch detection data
     * @param {Object} keyAnalysis - Key analysis results
     */
    async analyzeTonalStability(pitchData, keyAnalysis) {
        const tonalCenters = await this.tonalCenterDetector.analyze(pitchData);
        
        return {
            primaryTonalCenter: tonalCenters.primary,
            stability: tonalCenters.stability,
            ambiguity: tonalCenters.ambiguity,
            attraction: tonalCenters.attraction,
            hierarchy: tonalCenters.hierarchy,
            confidence: tonalCenters.confidence
        };
    }

    /**
     * Get current harmonic analysis state
     */
    getHarmonicState() {
        return {
            currentKey: this.currentKey,
            currentScale: this.currentScale,
            currentMode: this.currentMode,
            recentChords: this.chordProgression.slice(-8),
            recentModulations: this.keyModulations.slice(-3),
            tonalStability: this.calculateCurrentTonalStability(),
            harmonicComplexity: this.calculateCurrentHarmonicComplexity()
        };
    }

    /**
     * Update harmonic context with new analysis
     * @param {Object} harmonicAnalysis - New harmonic analysis results
     */
    updateHarmonicContext(harmonicAnalysis) {
        if (!harmonicAnalysis) return;
        
        // Update chord progression
        if (harmonicAnalysis.chords && harmonicAnalysis.chords.progression) {
            this.chordProgression.push(...harmonicAnalysis.chords.progression);
            // Keep only recent history
            if (this.chordProgression.length > 50) {
                this.chordProgression = this.chordProgression.slice(-50);
            }
        }
        
        // Update modulations
        if (harmonicAnalysis.modulations && harmonicAnalysis.modulations.modulations) {
            this.keyModulations.push(...harmonicAnalysis.modulations.modulations);
            if (this.keyModulations.length > 10) {
                this.keyModulations = this.keyModulations.slice(-10);
            }
        }
        
        // Update current mode
        if (harmonicAnalysis.modal && harmonicAnalysis.modal.confidence > 0.7) {
            this.currentMode = harmonicAnalysis.modal.primaryMode;
        }
    }

    // Utility methods for harmonic analysis
    
    extractPitchClasses(pitchData) {
        return pitchData
            .filter(p => p.midiNote && p.confidence > 0.5)
            .map(p => p.midiNote % 12)
            .filter((pc, index, arr) => arr.indexOf(pc) === index); // Remove duplicates
    }
    
    calculateKeyScaleScore(pitchClasses, key, scaleInfo) {
        const keyRoot = this.noteToMidiClass(key);
        let score = 0;
        
        for (const pitchClass of pitchClasses) {
            const normalizedPC = (pitchClass - keyRoot + 12) % 12;
            if (scaleInfo.intervals.includes(normalizedPC)) {
                score += 1;
            }
        }
        
        return score;
    }
    
    calculateModalScore(pitchClasses, key, modeInfo) {
        const keyRoot = this.noteToMidiClass(key);
        let score = 0;
        
        for (const pitchClass of pitchClasses) {
            const normalizedPC = (pitchClass - keyRoot + 12) % 12;
            if (modeInfo.intervals.includes(normalizedPC)) {
                score += 1;
            }
        }
        
        return score;
    }
    
    noteToMidiClass(noteName) {
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
            'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
            'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11
        };
        return noteMap[noteName] || 0;
    }
    
    classifyModulation(fromKey, toKey) {
        const fromRoot = this.noteToMidiClass(fromKey);
        const toRoot = this.noteToMidiClass(toKey);
        const interval = (toRoot - fromRoot + 12) % 12;
        
        const modulationTypes = {
            0: 'enharmonic',
            1: 'chromatic_up',
            2: 'whole_tone_up',
            5: 'fourth_up',
            7: 'fifth_up',
            11: 'chromatic_down'
        };
        
        return modulationTypes[interval] || 'other';
    }
    
    calculateHarmonicConfidence(keyAnalysis, chordAnalysis, modalAnalysis) {
        const weights = [0.4, 0.3, 0.3];
        const confidences = [
            keyAnalysis?.confidence || 0,
            chordAnalysis?.complexity ? (1 - chordAnalysis.complexity * 0.5) : 0.5,
            modalAnalysis?.confidence || 0
        ];
        
        return weights.reduce((sum, weight, i) => sum + (weight * confidences[i]), 0);
    }
    
    getKeyHistory() {
        // This would store key analysis history
        return this.keyHistory || [];
    }
    
    calculateKeyStability(pitchClasses, keyMatch) {
        // Measure how well the pitch classes fit the detected key
        return keyMatch.confidence;
    }
    
    extractHarmonicRhythm(rhythmData) {
        // Extract harmonic rhythm from rhythm analysis
        return rhythmData.beatPositions || [];
    }
    
    segmentIntoHarmonicUnits(pitchData, harmonicRhythm) {
        // Segment melody based on harmonic rhythm or regular intervals
        const segments = [];
        const segmentLength = 2000; // 2 seconds
        
        for (let i = 0; i < pitchData.length; i += 10) {
            const segment = pitchData.slice(i, i + 10);
            if (segment.length > 0) {
                segments.push({
                    startTime: segment[0].timestamp,
                    endTime: segment[segment.length - 1].timestamp,
                    pitches: segment
                });
            }
        }
        
        return segments;
    }
    
    detectCadences(chordProgression) {
        // Detect common cadential patterns
        const cadences = [];
        // Implementation would analyze chord progressions for V-I, IV-I, etc.
        return cadences;
    }
    
    analyzeFunctionalHarmony(chordProgression) {
        // Analyze tonic, subdominant, dominant functions
        return {
            tonic: [],
            subdominant: [],
            dominant: [],
            predominant: []
        };
    }
    
    calculateHarmonicComplexity(chordProgression) {
        // Calculate complexity based on chord types and progressions
        return chordProgression.length > 0 ? 0.5 : 0;
    }
    
    calculateMelodicIntervals(pitchData) {
        const intervals = [];
        for (let i = 1; i < pitchData.length; i++) {
            const interval = pitchData[i].midiNote - pitchData[i-1].midiNote;
            intervals.push(interval);
        }
        return intervals;
    }
    
    calculateMelodicSmoothness(intervals) {
        const stepwise = intervals.filter(i => Math.abs(i) <= 2).length;
        return stepwise / intervals.length;
    }
    
    calculateMelodicComplexity(intervals) {
        const largeLeaps = intervals.filter(i => Math.abs(i) > 7).length;
        return largeLeaps / intervals.length;
    }
    
    calculateCurrentTonalStability() {
        return 0.8; // Placeholder
    }
    
    calculateCurrentHarmonicComplexity() {
        return 0.6; // Placeholder
    }
    
    detectModalMixture(modalScores) {
        // Detect mixture between modes
        return [];
    }
    
    analyzeModulationPattern(modulations) {
        // Analyze patterns in key changes
        return 'static'; // Placeholder
    }
    
    calculateTonalStability(keyHistory) {
        return 0.7; // Placeholder
    }
    
    calculateModulationStrength(prevKey, currentKey) {
        return Math.abs(prevKey.confidence - currentKey.confidence);
    }
}

// Supporting classes for harmonic analysis

class KeyDetectionEngine {
    // Advanced key detection algorithms would be implemented here
}

class ChordProgressionDetector {
    async analyzeSegment(segment, currentKey, currentScale) {
        // Analyze melodic segment for implied harmony
        return {
            chord: 'C',
            function: 'tonic',
            quality: 'major',
            inversion: 'root',
            confidence: 0.8,
            tension: 0.2
        };
    }
}

class ModalAnalysisEngine {
    // Modal analysis algorithms would be implemented here
}

class VoiceLeadingAnalyzer {
    analyzePatterns(intervals) {
        return {
            stepwise: 0.7,
            leaps: 0.3,
            direction: 'ascending',
            contour: 'arch',
            sequences: []
        };
    }
}

class TonalCenterDetector {
    async analyze(pitchData) {
        return {
            primary: 'C',
            stability: 0.8,
            ambiguity: 0.2,
            attraction: 0.9,
            hierarchy: ['C', 'G', 'F'],
            confidence: 0.8
        };
    }
}