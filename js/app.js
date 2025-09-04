class WhistleApp {
    constructor() {
        this.audioHandler = null;
        this.pitchDetector = null;
        this.notationRenderer = null;
        this.isListening = false;
        
        this.initializeElements();
        this.bindEvents();
        this.setupCanvas();
    }
    
    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
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
    
    resetButtons() {
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }
    
    startAnalysisLoop() {
        if (!this.isListening) return;
        
        const frequency = this.pitchDetector.detectPitch();
        
        if (frequency > 0) {
            const noteInfo = this.pitchDetector.frequencyToNote(frequency);
            
            this.freqDisplay.textContent = frequency.toFixed(1);
            this.noteDisplay.textContent = noteInfo.note;
            this.pitchDisplay.textContent = noteInfo.note;
            
            // Add note to staff (placeholder for now)
            // this.notationRenderer.addNote(noteInfo);
        } else {
            this.pitchDisplay.textContent = '--';
        }
        
        requestAnimationFrame(() => this.startAnalysisLoop());
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WhistleApp();
});