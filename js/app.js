class WhistleApp {
    constructor() {
        this.audioHandler = null;
        this.pitchDetector = null;
        this.notationRenderer = null;
        this.isListening = false;
        this.lastActivityTime = 0;
        this.inactivityThreshold = 2000; // Reduce updates after 2s of no activity
        
        this.initializeElements();
        this.bindEvents();
        this.setupCanvas();
    }
    
    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.exportPngBtn = document.getElementById('exportPngBtn');
        this.exportJsonBtn = document.getElementById('exportJsonBtn');
        this.statusText = document.getElementById('statusText');
        this.pitchDisplay = document.getElementById('pitchDisplay');
        this.freqDisplay = document.getElementById('freqDisplay');
        this.noteDisplay = document.getElementById('noteDisplay');
        this.canvas = document.getElementById('staffCanvas');
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startListening());
        this.stopBtn.addEventListener('click', () => this.stopListening());
        this.clearBtn.addEventListener('click', () => this.clearNotation());
        this.exportPngBtn.addEventListener('click', () => this.exportPng());
        this.exportJsonBtn.addEventListener('click', () => this.exportJson());
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
            
            this.pitchDetector = new PitchDetector(this.audioHandler.getAnalyser());
            
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
    
    resetButtons() {
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }
    
    startAnalysisLoop() {
        if (!this.isListening) return;
        
        const noteOnset = this.pitchDetector.detectNoteOnset();
        
        if (noteOnset) {
            this.freqDisplay.textContent = noteOnset.frequency.toFixed(1);
            this.noteDisplay.textContent = noteOnset.note;
            this.pitchDisplay.textContent = noteOnset.note;
            
            // Add note to staff when new note is detected
            if (noteOnset.isNewNote) {
                this.notationRenderer.addNote(noteOnset);
            }
        } else {
            // Still show current detection for debugging
            const frequency = this.pitchDetector.detectPitch();
            if (frequency > 0) {
                const noteInfo = this.pitchDetector.frequencyToNote(frequency);
                this.freqDisplay.textContent = frequency.toFixed(1);
                this.noteDisplay.textContent = noteInfo.note;
                this.pitchDisplay.textContent = noteInfo.note;
            } else {
                this.pitchDisplay.textContent = '--';
            }
        }
        
        requestAnimationFrame(() => this.startAnalysisLoop());
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WhistleApp();
});