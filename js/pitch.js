class PitchDetector {
    constructor(audioHandler) {
        this.audioHandler = audioHandler;
        this.analyser = audioHandler.getAnalyser();
        this.sampleRate = audioHandler.getSampleRate();
        
        // Initialize YIN detector
        this.yinDetector = new YINDetector(this.sampleRate, 2048);
        
        // Frequency domain analysis (for backup/debugging)
        this.bufferLength = this.analyser.frequencyBinCount;
        this.frequencyData = new Float32Array(this.bufferLength);
        
        // Note frequencies (A4 = 440 Hz)
        this.noteFreqs = this.generateNoteFrequencies();
        
        // YIN detection parameters
        this.yinThreshold = 0.15; // YIN periodicity threshold
        this.confidenceThreshold = 0.7; // Minimum confidence for detection
        
        // Onset detection parameters
        this.currentNote = null;
        this.noteStartTime = 0;
        this.minNoteDuration = 100; // Minimum note duration in ms
        this.stabilityThreshold = 30; // cents tolerance for note stability
        
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
        // Get time-domain audio data for YIN analysis
        const audioData = this.audioHandler.getTimeDataArray();
        
        // Run YIN algorithm
        const yinResult = this.yinDetector.detectPitch(audioData);
        
        if (!yinResult || yinResult.confidence < this.confidenceThreshold) {
            return null; // No reliable pitch detected
        }
        
        return {
            frequency: yinResult.frequency,
            confidence: yinResult.confidence,
            period: yinResult.period
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
        
        let closestNote = 'A4';
        let minDifference = Infinity;
        
        // Find closest note
        for (const [note, freq] of Object.entries(this.noteFreqs)) {
            const difference = Math.abs(frequency - freq);
            if (difference < minDifference) {
                minDifference = difference;
                closestNote = note;
            }
        }
        
        // Calculate cents deviation
        const targetFreq = this.noteFreqs[closestNote];
        const cents = Math.round(1200 * Math.log2(frequency / targetFreq));
        
        // Extract octave properly (handles C#4, Bb3, etc.)
        const octaveMatch = closestNote.match(/(\d+)$/);
        const octave = octaveMatch ? parseInt(octaveMatch[1]) : 4;
        
        return {
            note: closestNote,
            octave: octave,
            cents: cents,
            frequency: frequency,
            targetFreq: targetFreq
        };
    }
    
    setSampleRate(sampleRate) {
        this.sampleRate = sampleRate;
    }
    
    detectNoteOnset() {
        const currentTime = Date.now();
        
        // Throttle detection for performance
        if (currentTime - this.lastDetectionTime < this.detectionInterval) {
            return null;
        }
        this.lastDetectionTime = currentTime;
        
        const pitchResult = this.detectPitch();
        
        if (!pitchResult) {
            this.updatePitchHistory(null);
            return null; // No reliable signal
        }
        
        // Update pitch history for stability analysis
        this.updatePitchHistory(pitchResult);
        
        const noteInfo = this.frequencyToNote(pitchResult.frequency);
        const stability = this.getPitchStability();
        
        // Enhanced note info with YIN confidence and stability
        const enhancedNoteInfo = {
            ...noteInfo,
            confidence: pitchResult.confidence,
            stability: stability,
            yinPeriod: pitchResult.period
        };
        
        // Check if this is a new note or continuation
        if (this.currentNote === null || 
            noteInfo.note !== this.currentNote.note ||
            Math.abs(noteInfo.cents) > this.stabilityThreshold) {
            
            // Require minimum confidence and stability for new notes
            if (pitchResult.confidence < this.confidenceThreshold || stability < 0.6) {
                return null;
            }
            
            // New note detected
            this.currentNote = noteInfo;
            this.noteStartTime = currentTime;
            
            return {
                ...enhancedNoteInfo,
                isNewNote: true,
                timestamp: currentTime
            };
        }
        
        // Continue existing note
        const noteDuration = currentTime - this.noteStartTime;
        
        if (noteDuration >= this.minNoteDuration && stability > 0.4) {
            return {
                ...enhancedNoteInfo,
                isNewNote: false,
                duration: noteDuration,
                timestamp: this.noteStartTime
            };
        }
        
        return null; // Note too short or unstable
    }
}