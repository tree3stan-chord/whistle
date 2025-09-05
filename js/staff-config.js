class StaffConfiguration {
    constructor(notationRenderer, app) {
        this.notationRenderer = notationRenderer;
        this.app = app;
        
        // Default staff configuration
        this.config = {
            timeSignature: { numerator: 4, denominator: 4 },
            keySignature: 'C', // Key of C (no sharps/flats)
            tempo: 120,
            clef: 'treble',
            metronome: false,
            showBeatGrid: true,
            quantizationLevel: 16, // 16th notes
            autoKeyDetection: true // Enable automatic key detection
        };
        
        // Key signature data with sharps/flats
        this.keySignatures = {
            'C': { sharps: 0, flats: 0, name: 'C Major' },
            'G': { sharps: 1, flats: 0, name: 'G Major', accidentals: ['F#'] },
            'D': { sharps: 2, flats: 0, name: 'D Major', accidentals: ['F#', 'C#'] },
            'A': { sharps: 3, flats: 0, name: 'A Major', accidentals: ['F#', 'C#', 'G#'] },
            'E': { sharps: 4, flats: 0, name: 'E Major', accidentals: ['F#', 'C#', 'G#', 'D#'] },
            'B': { sharps: 5, flats: 0, name: 'B Major', accidentals: ['F#', 'C#', 'G#', 'D#', 'A#'] },
            'F#': { sharps: 6, flats: 0, name: 'F# Major', accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'] },
            'C#': { sharps: 7, flats: 0, name: 'C# Major', accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'] },
            'F': { sharps: 0, flats: 1, name: 'F Major', accidentals: ['Bb'] },
            'Bb': { sharps: 0, flats: 2, name: 'Bb Major', accidentals: ['Bb', 'Eb'] },
            'Eb': { sharps: 0, flats: 3, name: 'Eb Major', accidentals: ['Bb', 'Eb', 'Ab'] },
            'Ab': { sharps: 0, flats: 4, name: 'Ab Major', accidentals: ['Bb', 'Eb', 'Ab', 'Db'] },
            'Db': { sharps: 0, flats: 5, name: 'Db Major', accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'] },
            'Gb': { sharps: 0, flats: 6, name: 'Gb Major', accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'] },
            'Cb': { sharps: 0, flats: 7, name: 'Cb Major', accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'] }
        };
        
        // Common time signatures
        this.timeSignatures = {
            '4/4': { numerator: 4, denominator: 4, name: 'Common Time' },
            '2/4': { numerator: 2, denominator: 4, name: '2/4 Time' },
            '3/4': { numerator: 3, denominator: 4, name: 'Waltz Time' },
            '6/8': { numerator: 6, denominator: 8, name: 'Compound Duple' },
            '9/8': { numerator: 9, denominator: 8, name: 'Compound Triple' },
            '12/8': { numerator: 12, denominator: 8, name: 'Compound Quadruple' },
            '2/2': { numerator: 2, denominator: 2, name: 'Cut Time' },
            '5/4': { numerator: 5, denominator: 4, name: '5/4 Time' },
            '7/8': { numerator: 7, denominator: 8, name: '7/8 Time' }
        };
        
        // Load saved settings
        this.loadSettings();
        
        // Create UI
        this.createConfigPanel();
        this.bindEvents();
        
        console.log('StaffConfiguration initialized');
    }
    
    createConfigPanel() {
        // Remove any existing config panel
        const existingPanel = document.getElementById('staffConfigPanel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // Create main config panel
        const panel = document.createElement('div');
        panel.id = 'staffConfigPanel';
        panel.className = 'staff-config-panel';
        
        panel.innerHTML = `
            <div class="config-header">
                <h3>Staff Configuration</h3>
                <button id="configToggleBtn" class="config-toggle">⚙️</button>
            </div>
            <div class="config-content" id="configContent">
                <div class="config-section">
                    <h4>Time Signature</h4>
                    <select id="timeSignatureSelect" class="config-select">
                        ${Object.entries(this.timeSignatures).map(([key, ts]) => 
                            `<option value="${key}" ${this.config.timeSignature.numerator === ts.numerator && this.config.timeSignature.denominator === ts.denominator ? 'selected' : ''}>
                                ${key} - ${ts.name}
                            </option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="config-section">
                    <h4>Key Signature</h4>
                    <select id="keySignatureSelect" class="config-select">
                        ${Object.entries(this.keySignatures).map(([key, ks]) => 
                            `<option value="${key}" ${this.config.keySignature === key ? 'selected' : ''}>
                                ${ks.name}
                            </option>`
                        ).join('')}
                    </select>
                    <div class="key-options">
                        <label class="checkbox-label">
                            <input type="checkbox" id="autoKeyDetectionCheck" ${this.config.autoKeyDetection ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Auto-detect key signature
                        </label>
                        <button id="analyzeKeyBtn" class="config-btn-small" style="margin-top: 0.5rem;">📊 Analyze Current Key</button>
                    </div>
                </div>
                
                <div class="config-section">
                    <h4>Tempo</h4>
                    <div class="tempo-controls">
                        <input type="range" id="tempoSlider" class="tempo-slider" 
                               min="60" max="200" step="1" value="${this.config.tempo}">
                        <span id="tempoValue" class="tempo-value">${this.config.tempo} BPM</span>
                    </div>
                </div>
                
                <div class="config-section">
                    <h4>Clef</h4>
                    <select id="clefSelect" class="config-select">
                        <option value="treble" ${this.config.clef === 'treble' ? 'selected' : ''}>Treble Clef</option>
                        <option value="bass" ${this.config.clef === 'bass' ? 'selected' : ''}>Bass Clef</option>
                        <option value="alto" ${this.config.clef === 'alto' ? 'selected' : ''}>Alto Clef</option>
                    </select>
                </div>
                
                <div class="config-section">
                    <h4>Quantization</h4>
                    <select id="quantizationSelect" class="config-select">
                        <option value="4" ${this.config.quantizationLevel === 4 ? 'selected' : ''}>Quarter Notes</option>
                        <option value="8" ${this.config.quantizationLevel === 8 ? 'selected' : ''}>Eighth Notes</option>
                        <option value="16" ${this.config.quantizationLevel === 16 ? 'selected' : ''}>16th Notes</option>
                        <option value="32" ${this.config.quantizationLevel === 32 ? 'selected' : ''}>32nd Notes</option>
                    </select>
                </div>
                
                <div class="config-section">
                    <h4>Visual Options</h4>
                    <div class="checkbox-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="metronomeCheck" ${this.config.metronome ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Enable Metronome
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" id="beatGridCheck" ${this.config.showBeatGrid ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Show Beat Grid
                        </label>
                    </div>
                </div>
                
                <div class="config-actions">
                    <button id="resetConfigBtn" class="config-btn reset-btn">Reset to Defaults</button>
                    <button id="applyConfigBtn" class="config-btn apply-btn">Apply Changes</button>
                </div>
            </div>
        `;
        
        // Insert panel before the main controls
        const mainElement = document.querySelector('main');
        const controlsElement = document.querySelector('.controls');
        mainElement.insertBefore(panel, controlsElement);
        
        // Initially collapsed
        this.isConfigOpen = false;
        this.toggleConfigPanel(false);
    }
    
    bindEvents() {
        // Toggle panel visibility
        document.getElementById('configToggleBtn').addEventListener('click', () => {
            this.toggleConfigPanel();
        });
        
        // Time signature change
        document.getElementById('timeSignatureSelect').addEventListener('change', (e) => {
            const [num, den] = e.target.value.split('/');
            this.config.timeSignature = { 
                numerator: parseInt(num), 
                denominator: parseInt(den) 
            };
        });
        
        // Key signature change
        document.getElementById('keySignatureSelect').addEventListener('change', (e) => {
            this.config.keySignature = e.target.value;
        });
        
        // Tempo changes
        const tempoSlider = document.getElementById('tempoSlider');
        const tempoValue = document.getElementById('tempoValue');
        
        tempoSlider.addEventListener('input', (e) => {
            this.config.tempo = parseInt(e.target.value);
            tempoValue.textContent = `${this.config.tempo} BPM`;
        });
        
        // Clef change
        document.getElementById('clefSelect').addEventListener('change', (e) => {
            this.config.clef = e.target.value;
        });
        
        // Quantization change
        document.getElementById('quantizationSelect').addEventListener('change', (e) => {
            this.config.quantizationLevel = parseInt(e.target.value);
        });
        
        // Checkboxes
        document.getElementById('metronomeCheck').addEventListener('change', (e) => {
            this.config.metronome = e.target.checked;
        });
        
        document.getElementById('beatGridCheck').addEventListener('change', (e) => {
            this.config.showBeatGrid = e.target.checked;
        });
        
        // Auto key detection
        document.getElementById('autoKeyDetectionCheck').addEventListener('change', (e) => {
            this.config.autoKeyDetection = e.target.checked;
            this.applyKeyDetectionSetting();
        });
        
        // Analyze key button
        document.getElementById('analyzeKeyBtn').addEventListener('click', () => {
            this.analyzeCurrentKey();
        });
        
        // Action buttons
        document.getElementById('resetConfigBtn').addEventListener('click', () => {
            this.resetToDefaults();
        });
        
        document.getElementById('applyConfigBtn').addEventListener('click', () => {
            this.applyConfiguration();
        });
    }
    
    toggleConfigPanel(force = null) {
        const content = document.getElementById('configContent');
        const toggleBtn = document.getElementById('configToggleBtn');
        
        if (force !== null) {
            this.isConfigOpen = force;
        } else {
            this.isConfigOpen = !this.isConfigOpen;
        }
        
        if (this.isConfigOpen) {
            content.style.display = 'block';
            toggleBtn.textContent = '✕';
            toggleBtn.classList.add('active');
        } else {
            content.style.display = 'none';
            toggleBtn.textContent = '⚙️';
            toggleBtn.classList.remove('active');
        }
    }
    
    resetToDefaults() {
        this.config = {
            timeSignature: { numerator: 4, denominator: 4 },
            keySignature: 'C',
            tempo: 120,
            clef: 'treble',
            metronome: false,
            showBeatGrid: true,
            quantizationLevel: 16,
            autoKeyDetection: true
        };
        
        // Update UI to reflect defaults
        this.updateUIFromConfig();
    }
    
    updateUIFromConfig() {
        const timeKey = `${this.config.timeSignature.numerator}/${this.config.timeSignature.denominator}`;
        document.getElementById('timeSignatureSelect').value = timeKey;
        document.getElementById('keySignatureSelect').value = this.config.keySignature;
        document.getElementById('tempoSlider').value = this.config.tempo;
        document.getElementById('tempoValue').textContent = `${this.config.tempo} BPM`;
        document.getElementById('clefSelect').value = this.config.clef;
        document.getElementById('quantizationSelect').value = this.config.quantizationLevel;
        document.getElementById('metronomeCheck').checked = this.config.metronome;
        document.getElementById('beatGridCheck').checked = this.config.showBeatGrid;
        document.getElementById('autoKeyDetectionCheck').checked = this.config.autoKeyDetection;
    }
    
    applyConfiguration() {
        // Apply configuration to notation renderer
        this.notationRenderer.updateConfiguration(this.config);
        
        // Apply to app systems
        if (this.app.rhythmQuantizer) {
            this.app.rhythmQuantizer.setTempo(this.config.tempo);
            this.app.rhythmQuantizer.setQuantizationLevel(this.config.quantizationLevel);
        }
        
        // Apply to playhead system
        if (this.app.playhead) {
            this.app.playhead.updateConfiguration(this.config);
        }
        
        // Apply to register detector (manual clef override)
        if (this.app.registerDetector && this.config.clef) {
            this.app.registerDetector.setClef(this.config.clef);
        }
        
        // Apply to pitch detector (key signature for enharmonic spelling)
        if (this.app.pitchDetector && this.config.keySignature) {
            this.app.pitchDetector.setKeySignature(this.config.keySignature);
        }
        
        // Apply auto key detection setting
        this.applyKeyDetectionSetting();
        
        // Save settings
        this.saveSettings();
        
        // Close panel after applying
        this.toggleConfigPanel(false);
        
        // Show confirmation
        this.showApplyConfirmation();
        
        console.log('Configuration applied:', this.config);
    }
    
    showApplyConfirmation() {
        const statusText = document.getElementById('statusText');
        const originalText = statusText.textContent;
        statusText.textContent = 'Staff configuration updated!';
        statusText.style.color = '#4CAF50';
        
        setTimeout(() => {
            statusText.textContent = originalText;
            statusText.style.color = '';
        }, 2000);
    }
    
    saveSettings() {
        try {
            localStorage.setItem('whistleStaffConfig', JSON.stringify(this.config));
        } catch (e) {
            console.warn('Could not save staff configuration:', e);
        }
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('whistleStaffConfig');
            if (saved) {
                const savedConfig = JSON.parse(saved);
                this.config = { ...this.config, ...savedConfig };
                console.log('Loaded saved configuration:', this.config);
            }
        } catch (e) {
            console.warn('Could not load saved configuration:', e);
        }
    }
    
    // Public API
    getConfiguration() {
        return { ...this.config };
    }
    
    setConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.updateUIFromConfig();
        this.applyConfiguration();
    }
    
    getKeySignatureInfo() {
        return this.keySignatures[this.config.keySignature];
    }
    
    getTimeSignatureInfo() {
        return this.config.timeSignature;
    }
    
    applyKeyDetectionSetting() {
        if (this.app.pitchDetector) {
            this.app.pitchDetector.setAutoKeyDetection(this.config.autoKeyDetection);
        }
    }
    
    analyzeCurrentKey() {
        if (!this.app.pitchDetector) {
            this.showKeyAnalysisResult('No pitch detector available', '#f44336');
            return;
        }
        
        const keyAnalysis = this.app.pitchDetector.getKeyAnalysis();
        
        if (keyAnalysis.confidence === 'insufficient_data' || keyAnalysis.suggestions.length === 0) {
            this.showKeyAnalysisResult('Not enough data for key analysis. Try playing some notes first.', '#FF9800');
            return;
        }
        
        const topSuggestion = keyAnalysis.suggestions[0];
        const confidence = Math.round(topSuggestion.confidence * 100);
        
        if (confidence < 50) {
            this.showKeyAnalysisResult(`Uncertain key analysis. Best guess: ${topSuggestion.key} (${confidence}% confident)`, '#FF9800');
            return;
        }
        
        // Show analysis result
        let message = `Detected key: ${topSuggestion.key} (${confidence}% confident)`;
        
        if (keyAnalysis.suggestions.length > 1) {
            const alternatives = keyAnalysis.suggestions.slice(1, 3)
                .map(s => `${s.key} (${Math.round(s.confidence * 100)}%)`)
                .join(', ');
            message += `\\nAlternatives: ${alternatives}`;
        }
        
        // Ask user if they want to apply the detected key
        if (confirm(`${message}\\n\\nApply this key signature?`)) {
            this.config.keySignature = topSuggestion.key;
            this.updateUIFromConfig();
            this.applyConfiguration();
            this.showKeyAnalysisResult(`Key signature changed to ${topSuggestion.key}`, '#4CAF50');
        } else {
            this.showKeyAnalysisResult(message, '#4a9eff');
        }
    }
    
    showKeyAnalysisResult(message, color) {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            const originalText = statusText.textContent;
            const originalColor = statusText.style.color;
            
            statusText.textContent = message;
            statusText.style.color = color;
            
            setTimeout(() => {
                statusText.textContent = originalText;
                statusText.style.color = originalColor;
            }, 5000);
        }
    }
}