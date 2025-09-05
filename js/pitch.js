class PitchDetector {
    constructor(audioHandler) {
        this.audioHandler = audioHandler;
        this.analyser = audioHandler.getAnalyser();
        this.sampleRate = audioHandler.getSampleRate();
        
        // Initialize YIN detector
        this.yinDetector = new YINDetector(this.sampleRate, 2048);
        
        // Initialize harmonic-aware processing
        this.harmonicFilter = audioHandler.getHarmonicFilter();
        this.useHarmonicFiltering = true;
        
        // Initialize onset detector
        this.onsetDetector = new OnsetDetector(this.analyser, this.sampleRate);
        
        // Initialize tempo tracker (disabled during live recording)
        this.tempoTracker = new TempoTracker();
        this.recordingMode = true; // True = cadenza/free time, False = quantized playback
        
        // Initialize intelligent articulation detection
        this.articulationDetector = new ArticulationDetector(this.sampleRate);
        
        // Initialize enharmonic spelling detector
        this.enharmonicDetector = new EnharmonicDetector('C'); // Default key
        
        // Initialize key detector for automatic key signature detection
        this.keyDetector = new KeyDetector();
        
        // Frequency domain analysis (for backup/debugging)
        this.bufferLength = this.analyser.frequencyBinCount;
        this.frequencyData = new Float32Array(this.bufferLength);
        
        // Note frequencies (A4 = 440 Hz)
        this.noteFreqs = this.generateNoteFrequencies();
        
        // YIN detection parameters
        this.yinThreshold = 0.15; // YIN periodicity threshold
        this.confidenceThreshold = 0.7; // Minimum confidence for detection
        
        // Note tracking parameters
        this.currentNote = null;
        this.noteStartTime = 0;
        this.minNoteDuration = 80; // Minimum note duration in ms (reduced with onset detection)
        this.stabilityThreshold = 25; // cents tolerance for note stability
        
        // Combined onset + pitch detection
        this.lastOnsetTime = 0;
        this.onsetGracePeriod = 150; // ms to look for pitch after onset
        
        // Performance optimization
        this.pitchHistory = new Array(5).fill(null); // Pitch stability tracking
        this.historyIndex = 0;
        this.lastDetectionTime = 0;
        this.detectionInterval = 30; // YIN can run faster than FFT peak detection
        
        // Set YIN parameters
        this.yinDetector.setThreshold(this.yinThreshold);
        
        console.log(`PitchDetector initialized with YIN (${this.sampleRate}Hz)`);
    }
    
    generateNoteFrequencies() {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const frequencies = {};
        
        // Generate frequencies for multiple octaves
        for (let octave = 2; octave <= 7; octave++) {
            for (let i = 0; i < notes.length; i++) {
                const noteName = notes[i] + octave;
                // A4 = 440 Hz, calculate other notes relative to this
                const semitoneFromA4 = (octave - 4) * 12 + (i - 9);
                const frequency = 440 * Math.pow(2, semitoneFromA4 / 12);
                frequencies[noteName] = frequency;
            }
        }
        
        return frequencies;
    }
    
    detectPitch() {
        // Primary method: YIN with harmonic-filtered data
        const audioData = this.audioHandler.getTimeDataArray();
        const yinResult = this.yinDetector.detectPitch(audioData);
        
        // Secondary method: Harmonic analysis for validation/enhancement
        let harmonicResult = null;
        if (this.useHarmonicFiltering && this.harmonicFilter) {
            harmonicResult = this.harmonicFilter.findFundamentalFrequency(audioData);
        }
        
        // Combine results for best accuracy
        return this.combineDetectionResults(yinResult, harmonicResult);
    }
    
    combineDetectionResults(yinResult, harmonicResult) {
        // If YIN failed, try harmonic analysis
        if (!yinResult || yinResult.confidence < this.confidenceThreshold) {
            if (harmonicResult && harmonicResult.confidence > 0.7) {
                return {
                    frequency: harmonicResult.frequency,
                    confidence: harmonicResult.confidence * 0.9, // Slight penalty for fallback method
                    period: this.sampleRate / harmonicResult.frequency,
                    method: 'harmonic'
                };
            }
            return null; // No reliable detection
        }
        
        // YIN succeeded - optionally validate with harmonic analysis
        if (harmonicResult && harmonicResult.confidence > 0.5) {
            const freqDiff = Math.abs(yinResult.frequency - harmonicResult.frequency);
            const tolerance = yinResult.frequency * 0.05; // 5% tolerance
            
            if (freqDiff <= tolerance) {
                // Results agree - boost confidence
                return {
                    frequency: (yinResult.frequency + harmonicResult.frequency) / 2, // Average
                    confidence: Math.min(1.0, yinResult.confidence * 1.1), // Slight boost
                    period: yinResult.period,
                    method: 'yin+harmonic'
                };
            }
        }
        
        // Use YIN result as-is
        return {
            frequency: yinResult.frequency,
            confidence: yinResult.confidence,
            period: yinResult.period,
            method: 'yin'
        };
    }
    
    updatePitchHistory(pitchResult) {
        this.pitchHistory[this.historyIndex] = pitchResult;
        this.historyIndex = (this.historyIndex + 1) % this.pitchHistory.length;
    }
    
    getPitchStability() {
        const validPitches = this.pitchHistory.filter(p => p !== null);
        if (validPitches.length < 3) return 0;
        
        const frequencies = validPitches.map(p => p.frequency);
        const mean = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
        const variance = frequencies.reduce((a, b) => a + (b - mean) ** 2, 0) / frequencies.length;
        const stdDev = Math.sqrt(variance);
        
        // Return stability as inverse of coefficient of variation
        return mean > 0 ? 1 / (1 + stdDev / mean) : 0;
    }
    
    frequencyToNote(frequency) {
        if (frequency <= 0) return { note: '--', octave: 0, cents: 0 };
        
        // Use enhanced enharmonic detector for better note spelling
        const previousNote = this.currentNote;
        const analysis = this.enharmonicDetector.analyzeFrequency(frequency, { previousNote });
        
        // Return in the format expected by the rest of the system
        return {
            note: analysis.note + analysis.octave,
            octave: analysis.octave,
            cents: analysis.cents,
            frequency: frequency,
            targetFreq: analysis.targetFreq,
            confidence: analysis.confidence,
            harmonicInfo: analysis.harmonicInfo,
            enharmonicAlternatives: analysis.enharmonicAlternatives
        };
    }
    
    setSampleRate(sampleRate) {
        this.sampleRate = sampleRate;
    }
    
    setKeySignature(keySignature) {
        if (this.enharmonicDetector) {
            this.enharmonicDetector.setKeySignature(keySignature);
        }
        if (this.keyDetector) {
            this.keyDetector.setKey(keySignature);
        }
    }
    
    // Enable/disable automatic key detection
    setAutoKeyDetection(enabled) {
        if (this.keyDetector) {
            this.keyDetector.setAutoDetection(enabled);
        }
    }
    
    // Get current key analysis
    getKeyAnalysis() {
        if (this.keyDetector) {
            return this.keyDetector.getKeySuggestions();
        }
        return { currentKey: 'C', suggestions: [], confidence: 0 };
    }
    
    // Enhanced pitch detection that considers harmonic content
    detectPitchWithHarmonics() {
        const pitchResult = this.detectPitch();
        if (!pitchResult || pitchResult.confidence < this.confidenceThreshold) {
            return null;
        }
        
        const noteInfo = this.frequencyToNote(pitchResult.frequency);
        
        // Additional validation using harmonic analysis
        if (noteInfo.harmonicInfo && noteInfo.harmonicInfo.isLikelyHarmonic) {
            // If this seems to be a harmonic, we might want to consider the fundamental
            const fundamentalCandidates = noteInfo.harmonicInfo.harmonicCandidates;
            
            // For now, we'll use the detected pitch but provide harmonic context
            noteInfo.harmonicContext = {
                isHarmonic: true,
                possibleFundamentals: fundamentalCandidates.map(candidate => ({
                    note: candidate.fundamentalNote,
                    harmonic: candidate.harmonic,
                    confidence: candidate.accuracy / this.harmonicTolerance
                }))
            };
        }
        
        return {
            ...pitchResult,
            noteInfo: noteInfo
        };
    }
    
    detectNoteOnset() {
        const currentTime = Date.now();
        
        // Throttle detection for performance
        if (currentTime - this.lastDetectionTime < this.detectionInterval) {
            return null;
        }
        this.lastDetectionTime = currentTime;
        
        // Get current pitch and amplitude
        const pitchResult = this.detectPitch();
        const currentAmplitude = this.getCurrentAmplitude();
        
        if (!pitchResult) {
            // Handle silence/no pitch for articulation detector
            const articulationResult = this.articulationDetector.analyzeArticulation(null, currentAmplitude);
            
            if (articulationResult.noteEvent === 'note_end') {
                return {
                    isNewNote: false,
                    noteEnded: true,
                    endedNote: articulationResult.note,
                    timestamp: currentTime,
                    reason: articulationResult.reason
                };
            }
            
            this.updatePitchHistory(null);
            return null;
        }
        
        // Update pitch history for stability analysis
        this.updatePitchHistory(pitchResult);
        
        // Use intelligent articulation detection
        const articulationResult = this.articulationDetector.analyzeArticulation(pitchResult, currentAmplitude);
        
        const noteInfo = this.frequencyToNote(pitchResult.frequency);
        const stability = this.getPitchStability();
        
        // Enhanced note info with all detection data
        const enhancedNoteInfo = {
            ...noteInfo,
            confidence: pitchResult.confidence,
            stability: stability,
            yinPeriod: pitchResult.period,
            method: pitchResult.method,
            amplitude: currentAmplitude,
            articulationType: articulationResult.articulationType || 'unknown'
        };
        
        // Handle different articulation events
        switch (articulationResult.noteEvent) {
            case 'note_start':
            case 'note_change':
                return this.handleNewNote(enhancedNoteInfo, articulationResult, currentTime);
                
            case 'note_continue':
                return this.handleContinuingNote(enhancedNoteInfo, articulationResult, currentTime);
                
            case 'note_end':
                return this.handleNoteEnd(articulationResult, currentTime);
                
            default:
                return null;
        }
    }
    
    handleNewNote(noteInfo, articulationResult, currentTime) {
        // Handle tempo tracking for new notes
        let tempoInfo = { tempo: null, confidence: 0, beatPhase: 0, intervalCount: 0 };
        
        if (!this.recordingMode) {
            tempoInfo = this.tempoTracker.addOnset(currentTime, noteInfo);
        }
        
        // Add note to key detector for automatic key analysis
        if (this.keyDetector && noteInfo.confidence > 0.7) {
            this.keyDetector.addNote(noteInfo);
            
            // Check if key has changed automatically
            const keyAnalysis = this.keyDetector.analyzeKey();
            if (keyAnalysis.changed) {
                // Update enharmonic detector with new key
                this.enharmonicDetector.setKeySignature(keyAnalysis.key);
                
                // Notify about key change
                console.log(`Automatic key detection: ${keyAnalysis.key} (${(keyAnalysis.confidence * 100).toFixed(0)}% confident)`);
            }
        }
        
        return {
            ...noteInfo,
            isNewNote: true,
            timestamp: currentTime,
            duration: 0,
            articulationReason: articulationResult.reason,
            recordingMode: this.recordingMode,
            tempo: tempoInfo
        };
    }
    
    handleContinuingNote(noteInfo, articulationResult, currentTime) {
        const currentNote = articulationResult.note;
        
        return {
            ...noteInfo,
            isNewNote: false,
            timestamp: currentNote.startTime || currentTime,
            duration: currentNote.duration || 0,
            articulationReason: articulationResult.reason,
            recordingMode: this.recordingMode,
            tempo: this.recordingMode ? { tempo: null, confidence: 0, beatPhase: 0, intervalCount: 0 } : this.tempoTracker.getCurrentTempoInfo()
        };
    }
    
    handleNoteEnd(articulationResult, currentTime) {
        return {
            isNewNote: false,
            noteEnded: true,
            endedNote: articulationResult.note,
            timestamp: currentTime,
            reason: articulationResult.reason
        };
    }
    
    getCurrentAmplitude() {
        // Get current RMS amplitude from analyser
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatFrequencyData(dataArray);
        
        // Find peak amplitude (convert from dB)
        let maxAmplitude = -Infinity;
        for (let i = 0; i < bufferLength; i++) {
            maxAmplitude = Math.max(maxAmplitude, dataArray[i]);
        }
        
        return maxAmplitude;
    }
}