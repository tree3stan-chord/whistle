class PitchDetector {
    constructor(analyser) {
        this.analyser = analyser;
        this.bufferLength = analyser.frequencyBinCount;
        this.dataArray = new Float32Array(this.bufferLength);
        this.sampleRate = 44100; // Will be updated from audioContext
        
        // Note frequencies (A4 = 440 Hz)
        this.noteFreqs = this.generateNoteFrequencies();
        
        // Pitch detection parameters
        this.minFreq = 80;   // Lowest detectable frequency
        this.maxFreq = 2000; // Highest detectable frequency
        this.threshold = -40; // dB threshold for detection
        
        // Onset detection parameters
        this.previousAmplitude = -Infinity;
        this.currentNote = null;
        this.noteStartTime = 0;
        this.minNoteDuration = 150; // Minimum note duration in ms (reduced for responsiveness)
        this.stabilityThreshold = 50; // cents tolerance for note stability
        
        // Performance optimization
        this.smoothingBuffer = new Float32Array(5); // Frequency smoothing
        this.bufferIndex = 0;
        this.lastDetectionTime = 0;
        this.detectionInterval = 50; // Throttle detection to every 50ms
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
        // Get frequency domain data
        this.analyser.getFloatFrequencyData(this.dataArray);
        
        // Find peak frequency using simple peak detection
        let maxAmplitude = -Infinity;
        let peakIndex = 0;
        
        for (let i = 0; i < this.bufferLength; i++) {
            if (this.dataArray[i] > maxAmplitude && this.dataArray[i] > this.threshold) {
                maxAmplitude = this.dataArray[i];
                peakIndex = i;
            }
        }
        
        if (maxAmplitude === -Infinity) {
            return 0; // No signal detected
        }
        
        // Convert bin index to frequency
        const frequency = peakIndex * this.sampleRate / (2 * this.bufferLength);
        
        // Filter out frequencies outside our range
        if (frequency < this.minFreq || frequency > this.maxFreq) {
            return 0;
        }
        
        // Apply simple smoothing/stability check
        return this.refineFrequency(frequency, peakIndex);
    }
    
    refineFrequency(centerFreq, peakIndex) {
        // Simple parabolic interpolation for sub-bin accuracy
        const y1 = peakIndex > 0 ? this.dataArray[peakIndex - 1] : this.dataArray[peakIndex];
        const y2 = this.dataArray[peakIndex];
        const y3 = peakIndex < this.bufferLength - 1 ? this.dataArray[peakIndex + 1] : this.dataArray[peakIndex];
        
        const a = (y1 - 2 * y2 + y3) / 2;
        const b = (y3 - y1) / 2;
        
        if (a !== 0) {
            const xOffset = -b / (2 * a);
            const refinedIndex = peakIndex + xOffset;
            return refinedIndex * this.sampleRate / (2 * this.bufferLength);
        }
        
        return centerFreq;
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
        
        const frequency = this.detectPitch();
        
        if (frequency <= 0) {
            return null; // No signal
        }
        
        // Apply frequency smoothing
        this.smoothingBuffer[this.bufferIndex] = frequency;
        this.bufferIndex = (this.bufferIndex + 1) % this.smoothingBuffer.length;
        
        // Calculate smoothed frequency (simple moving average)
        let smoothedFreq = 0;
        let validSamples = 0;
        for (let i = 0; i < this.smoothingBuffer.length; i++) {
            if (this.smoothingBuffer[i] > 0) {
                smoothedFreq += this.smoothingBuffer[i];
                validSamples++;
            }
        }
        
        if (validSamples === 0) return null;
        smoothedFreq /= validSamples;
        
        const noteInfo = this.frequencyToNote(smoothedFreq);
        
        // Check if this is a new note or continuation
        if (this.currentNote === null || 
            noteInfo.note !== this.currentNote.note ||
            Math.abs(noteInfo.cents) > this.stabilityThreshold) {
            
            // New note detected
            this.currentNote = noteInfo;
            this.noteStartTime = currentTime;
            
            return {
                ...noteInfo,
                isNewNote: true,
                timestamp: currentTime
            };
        }
        
        // Continue existing note
        const noteDuration = currentTime - this.noteStartTime;
        
        if (noteDuration >= this.minNoteDuration) {
            return {
                ...noteInfo,
                isNewNote: false,
                duration: noteDuration,
                timestamp: this.noteStartTime
            };
        }
        
        return null; // Note too short to register
    }
}