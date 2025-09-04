class WhistleApp {
    constructor() {
        this.audioHandler = null;
        this.pitchDetector = null;
        this.notationRenderer = null;
        this.isListening = false;
        this.lastActivityTime = 0;
        this.inactivityThreshold = 2000; // Reduce updates after 2s of no activity
        this.inputMode = 'vocal'; // Default to vocal mode
        
        this.initializeElements();
        this.bindEvents();
        this.setupCanvas();
    }
    
    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.analyzeRhythmBtn = document.getElementById('analyzeRhythmBtn');
        this.exportPngBtn = document.getElementById('exportPngBtn');
        this.exportJsonBtn = document.getElementById('exportJsonBtn');
        this.vocalModeBtn = document.getElementById('vocalModeBtn');
        this.instrumentModeBtn = document.getElementById('instrumentModeBtn');
        this.statusText = document.getElementById('statusText');
        this.pitchDisplay = document.getElementById('pitchDisplay');
        this.freqDisplay = document.getElementById('freqDisplay');
        this.noteDisplay = document.getElementById('noteDisplay');
        this.onsetDisplay = document.getElementById('onsetDisplay');
        this.fluxDisplay = document.getElementById('fluxDisplay');
        this.tempoDisplay = document.getElementById('tempoDisplay');
        this.beatPhaseDisplay = document.getElementById('beatPhaseDisplay');
        this.intervalsDisplay = document.getElementById('intervalsDisplay');
        this.canvas = document.getElementById('staffCanvas');
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startListening());
        this.stopBtn.addEventListener('click', () => this.stopListening());
        this.clearBtn.addEventListener('click', () => this.clearNotation());
        this.analyzeRhythmBtn.addEventListener('click', () => this.analyzeRecordedRhythm());
        this.exportPngBtn.addEventListener('click', () => this.exportPng());
        this.exportJsonBtn.addEventListener('click', () => this.exportJson());
        this.vocalModeBtn.addEventListener('click', () => this.setInputMode('vocal'));
        this.instrumentModeBtn.addEventListener('click', () => this.setInputMode('instrument'));
    }
    
    setupCanvas() {
        this.notationRenderer = new NotationRenderer(this.canvas);
        this.notationRenderer.drawStaff();
    }
    
    async startListening() {
        try {
            this.statusText.textContent = 'Requesting microphone access...';
            
            this.audioHandler = new AudioHandler();
            await this.audioHandler.initialize();
            
            this.pitchDetector = new PitchDetector(this.audioHandler);
            
            this.isListening = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.statusText.textContent = 'Listening for pitch...';
            
            this.startAnalysisLoop();
            
        } catch (error) {
            console.error('Failed to start listening:', error);
            this.statusText.textContent = `Error: ${error.message}`;
            this.resetButtons();
        }
    }
    
    stopListening() {
        this.isListening = false;
        
        if (this.audioHandler) {
            this.audioHandler.stop();
            this.audioHandler = null;
        }
        
        this.pitchDetector = null;
        this.statusText.textContent = 'Stopped listening';
        this.pitchDisplay.textContent = '--';
        this.freqDisplay.textContent = '--';
        this.noteDisplay.textContent = '--';
        
        this.resetButtons();
    }
    
    clearNotation() {
        this.notationRenderer.clear();
        this.notationRenderer.drawStaff();
    }
    
    exportPng() {
        this.notationRenderer.exportPng();
    }
    
    exportJson() {
        this.notationRenderer.exportJson();
    }
    
    analyzeRecordedRhythm() {
        // Analyze rhythm from recorded notes
        const recordedNotes = this.notationRenderer.allNotes;
        
        if (recordedNotes.length < 3) {
            alert('Need at least 3 notes to analyze rhythm');
            return;
        }
        
        // Reset tempo tracker and feed it all the recorded onsets
        this.pitchDetector.tempoTracker.reset();
        
        for (const note of recordedNotes) {
            if (note.timestamp) {
                this.pitchDetector.tempoTracker.addOnset(note.timestamp, note);
            }
        }
        
        const analysis = this.pitchDetector.tempoTracker.getCurrentTempoInfo();
        
        if (analysis.tempo && analysis.confidence > 0.6) {
            const message = `Detected Rhythm:
• Tempo: ${Math.round(analysis.tempo)} BPM
• Confidence: ${Math.round(analysis.confidence * 100)}%
• Time Signature: ${this.guessTimeSignature(analysis.tempo, recordedNotes)}
• Total Notes: ${recordedNotes.length}

Apply this rhythm to notation?`;
            
            if (confirm(message)) {
                this.applyRhythmToNotation(analysis);
            }
        } else {
            alert(`Rhythm analysis inconclusive:
• Detected Tempo: ${analysis.tempo ? Math.round(analysis.tempo) + ' BPM' : 'None'}
• Confidence: ${Math.round(analysis.confidence * 100)}%

Try playing with more consistent timing or more notes.`);
        }
    }
    
    guessTimeSignature(tempo, notes) {
        // Simple heuristic: look at note groupings and intervals
        const intervals = [];
        for (let i = 1; i < notes.length; i++) {
            intervals.push(notes[i].timestamp - notes[i-1].timestamp);
        }
        
        // Most common patterns suggest 4/4
        if (tempo >= 60 && tempo <= 140) return '4/4';
        if (tempo > 140) return '2/4 or 4/4 (fast)';
        return '4/4 (slow)';
    }
    
    applyRhythmToNotation(analysis) {
        // For now, just update the display
        // Later: re-render notation with quantized note positions
        this.statusText.textContent = `Applied ${Math.round(analysis.tempo)} BPM rhythm`;
        
        // Enable rhythm-quantized mode
        this.pitchDetector.recordingMode = false;
        this.pitchDetector.tempoTracker.setTempo(analysis.tempo);
        
        setTimeout(() => {
            this.statusText.textContent = 'Rhythm applied - new notes will be quantized';
        }, 2000);
    }
    
    setInputMode(mode) {
        this.inputMode = mode;
        
        // Update button states
        this.vocalModeBtn.classList.toggle('active', mode === 'vocal');
        this.instrumentModeBtn.classList.toggle('active', mode === 'instrument');
        
        // Update harmonic filter settings
        if (this.audioHandler && this.audioHandler.harmonicFilter) {
            this.audioHandler.harmonicFilter.setVocalMode(mode === 'vocal');
            
            // Also adjust pitch detector confidence thresholds
            if (this.pitchDetector) {
                if (mode === 'vocal') {
                    this.pitchDetector.confidenceThreshold = 0.6; // Slightly lower for vocals
                    this.pitchDetector.yinDetector.setThreshold(0.15);
                } else {
                    this.pitchDetector.confidenceThreshold = 0.75; // Higher for instruments
                    this.pitchDetector.yinDetector.setThreshold(0.1);
                }
            }
        }
        
        console.log(`Input mode set to: ${mode}`);
    }
    
    resetButtons() {
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }
    
    startAnalysisLoop() {
        if (!this.isListening) return;
        
        const noteOnset = this.pitchDetector.detectNoteOnset();
        
        if (noteOnset) {
            this.freqDisplay.textContent = noteOnset.frequency.toFixed(1);
            this.noteDisplay.textContent = `${noteOnset.note} (${(noteOnset.confidence * 100).toFixed(0)}%)`;
            this.pitchDisplay.textContent = noteOnset.note;
            this.onsetDisplay.textContent = noteOnset.onsetDetected ? 'YES' : 'no';
            this.fluxDisplay.textContent = noteOnset.spectralFlux.toFixed(3);
            
            // Display tempo information
            if (noteOnset.recordingMode) {
                this.tempoDisplay.textContent = 'FREE TIME';
                this.beatPhaseDisplay.textContent = '--';
                this.intervalsDisplay.textContent = this.notationRenderer.allNotes.length;
            } else if (noteOnset.tempo) {
                this.tempoDisplay.textContent = noteOnset.tempo.tempo ? 
                    `${Math.round(noteOnset.tempo.tempo)} (${Math.round(noteOnset.tempo.confidence * 100)}%)` : '--';
                this.beatPhaseDisplay.textContent = noteOnset.tempo.beatPhase.toFixed(2);
                this.intervalsDisplay.textContent = noteOnset.tempo.intervalCount;
            }
            
            // Add note to staff when new note is detected
            if (noteOnset.isNewNote) {
                this.notationRenderer.addNote(noteOnset);
            }
        } else {
            // Still show current detection for debugging
            const pitchResult = this.pitchDetector.detectPitch();
            if (pitchResult) {
                const noteInfo = this.pitchDetector.frequencyToNote(pitchResult.frequency);
                this.freqDisplay.textContent = pitchResult.frequency.toFixed(1);
                this.noteDisplay.textContent = `${noteInfo.note} (${(pitchResult.confidence * 100).toFixed(0)}%)`;
                this.pitchDisplay.textContent = noteInfo.note;
            } else {
                this.pitchDisplay.textContent = '--';
                this.freqDisplay.textContent = '--';
                this.noteDisplay.textContent = '--';
            }
            
            // Always show current spectral flux
            this.fluxDisplay.textContent = this.pitchDetector.onsetDetector.getCurrentFlux().toFixed(3);
            this.onsetDisplay.textContent = '--';
            
            // Show current mode info
            if (this.pitchDetector.recordingMode) {
                this.tempoDisplay.textContent = 'FREE TIME';
                this.beatPhaseDisplay.textContent = '--';
                this.intervalsDisplay.textContent = this.notationRenderer.allNotes.length;
            } else {
                const tempoInfo = this.pitchDetector.tempoTracker.getCurrentTempoInfo();
                this.tempoDisplay.textContent = tempoInfo.tempo ? 
                    `${Math.round(tempoInfo.tempo)} (${Math.round(tempoInfo.confidence * 100)}%)` : '--';
                this.beatPhaseDisplay.textContent = tempoInfo.beatPhase.toFixed(2);
                this.intervalsDisplay.textContent = tempoInfo.intervalCount;
            }
        }
        
        requestAnimationFrame(() => this.startAnalysisLoop());
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WhistleApp();
});