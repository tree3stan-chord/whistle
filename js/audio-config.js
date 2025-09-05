class AudioConfiguration {
    constructor(audioHandler, app) {
        this.audioHandler = audioHandler;
        this.app = app;
        
        // Default audio configuration
        this.config = {
            deviceId: null, // Default device
            inputGain: 1.0,
            inputSensitivity: 0.3,
            noiseGate: 0.02,
            sampleRate: 44100,
            bufferSize: 4096
        };
        
        // Available audio devices
        this.audioDevices = [];
        this.gainNode = null;
        this.isConfigOpen = false;
        
        // Load saved settings
        this.loadSettings();
        
        console.log('AudioConfiguration initialized');
    }
    
    async initialize() {
        try {
            // Enumerate audio devices
            await this.enumerateDevices();
            
            // Create UI
            this.createConfigPanel();
            this.bindEvents();
            
            console.log('AudioConfiguration ready');
        } catch (error) {
            console.error('AudioConfiguration initialization failed:', error);
        }
    }
    
    async enumerateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.audioDevices = devices.filter(device => device.kind === 'audioinput');
            
            console.log('Found audio input devices:', this.audioDevices.length);
            
            // Listen for device changes
            navigator.mediaDevices.addEventListener('devicechange', () => {
                this.enumerateDevices();
                this.updateDeviceList();
            });
            
        } catch (error) {
            console.warn('Could not enumerate audio devices:', error);
            this.audioDevices = [];
        }
    }
    
    createConfigPanel() {
        // Remove any existing config panel
        const existingPanel = document.getElementById('audioConfigPanel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // Create main config panel
        const panel = document.createElement('div');
        panel.id = 'audioConfigPanel';
        panel.className = 'audio-config-panel';
        
        panel.innerHTML = `
            <div class="audio-config-header">
                <h3>Audio Configuration</h3>
                <button id="audioConfigToggleBtn" class="config-toggle">🎚️</button>
            </div>
            <div class="audio-config-content" id="audioConfigContent">
                <div class="config-section">
                    <h4>Input Device</h4>
                    <select id="audioDeviceSelect" class="config-select">
                        <option value="">Default Device</option>
                        ${this.audioDevices.map(device => 
                            `<option value="${device.deviceId}" ${this.config.deviceId === device.deviceId ? 'selected' : ''}>
                                ${device.label || `Device ${device.deviceId.slice(0, 8)}...`}
                            </option>`
                        ).join('')}
                    </select>
                    <button id="refreshDevicesBtn" class="config-btn-small">🔄 Refresh</button>
                </div>
                
                <div class="config-section">
                    <h4>Input Gain</h4>
                    <div class="control-group">
                        <input type="range" id="inputGainSlider" class="config-slider" 
                               min="0.1" max="3.0" step="0.1" value="${this.config.inputGain}">
                        <span id="inputGainValue" class="control-value">${this.config.inputGain.toFixed(1)}x</span>
                    </div>
                </div>
                
                <div class="config-section">
                    <h4>Input Sensitivity</h4>
                    <div class="control-group">
                        <input type="range" id="inputSensitivitySlider" class="config-slider" 
                               min="0.1" max="1.0" step="0.05" value="${this.config.inputSensitivity}">
                        <span id="inputSensitivityValue" class="control-value">${Math.round(this.config.inputSensitivity * 100)}%</span>
                    </div>
                    <small class="config-hint">Lower values require louder input to trigger notes</small>
                </div>
                
                <div class="config-section">
                    <h4>Noise Gate</h4>
                    <div class="control-group">
                        <input type="range" id="noiseGateSlider" class="config-slider" 
                               min="0.001" max="0.1" step="0.001" value="${this.config.noiseGate}">
                        <span id="noiseGateValue" class="control-value">${Math.round(this.config.noiseGate * 1000)}</span>
                    </div>
                    <small class="config-hint">Filters out background noise below threshold</small>
                </div>
                
                <div class="config-section">
                    <h4>Audio Quality</h4>
                    <div class="quality-controls">
                        <label class="radio-label">
                            <input type="radio" name="sampleRate" value="22050" ${this.config.sampleRate === 22050 ? 'checked' : ''}>
                            <span class="radio-checkmark"></span>
                            22 kHz (Lower CPU)
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="sampleRate" value="44100" ${this.config.sampleRate === 44100 ? 'checked' : ''}>
                            <span class="radio-checkmark"></span>
                            44.1 kHz (Balanced)
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="sampleRate" value="48000" ${this.config.sampleRate === 48000 ? 'checked' : ''}>
                            <span class="radio-checkmark"></span>
                            48 kHz (High Quality)
                        </label>
                    </div>
                </div>
                
                <div class="config-section">
                    <h4>Input Monitor</h4>
                    <div class="input-monitor">
                        <div class="level-meter">
                            <div id="inputLevelBar" class="level-bar"></div>
                        </div>
                        <span id="inputLevelText" class="level-text">-∞ dB</span>
                    </div>
                </div>
                
                <div class="config-actions">
                    <button id="testAudioBtn" class="config-btn test-btn">🎤 Test Audio</button>
                    <button id="resetAudioConfigBtn" class="config-btn reset-btn">Reset</button>
                    <button id="applyAudioConfigBtn" class="config-btn apply-btn">Apply Changes</button>
                </div>
            </div>
        `;
        
        // Insert panel after staff config panel
        const staffConfigPanel = document.getElementById('staffConfigPanel');
        if (staffConfigPanel) {
            staffConfigPanel.parentNode.insertBefore(panel, staffConfigPanel.nextSibling);
        } else {
            // Fallback to main element
            const mainElement = document.querySelector('main');
            const controlsElement = document.querySelector('.primary-controls');
            mainElement.insertBefore(panel, controlsElement);
        }
        
        // Initially collapsed
        this.toggleConfigPanel(false);
        
        // Start input monitoring
        this.startInputMonitoring();
    }
    
    bindEvents() {
        // Toggle panel visibility
        document.getElementById('audioConfigToggleBtn').addEventListener('click', () => {
            this.toggleConfigPanel();
        });
        
        // Device selection
        document.getElementById('audioDeviceSelect').addEventListener('change', (e) => {
            this.config.deviceId = e.target.value || null;
        });
        
        // Refresh devices
        document.getElementById('refreshDevicesBtn').addEventListener('click', async () => {
            await this.enumerateDevices();
            this.updateDeviceList();
        });
        
        // Input gain
        const gainSlider = document.getElementById('inputGainSlider');
        const gainValue = document.getElementById('inputGainValue');
        gainSlider.addEventListener('input', (e) => {
            this.config.inputGain = parseFloat(e.target.value);
            gainValue.textContent = `${this.config.inputGain.toFixed(1)}x`;
            this.applyGainChange();
        });
        
        // Input sensitivity
        const sensitivitySlider = document.getElementById('inputSensitivitySlider');
        const sensitivityValue = document.getElementById('inputSensitivityValue');
        sensitivitySlider.addEventListener('input', (e) => {
            this.config.inputSensitivity = parseFloat(e.target.value);
            sensitivityValue.textContent = `${Math.round(this.config.inputSensitivity * 100)}%`;
        });
        
        // Noise gate
        const noiseGateSlider = document.getElementById('noiseGateSlider');
        const noiseGateValue = document.getElementById('noiseGateValue');
        noiseGateSlider.addEventListener('input', (e) => {
            this.config.noiseGate = parseFloat(e.target.value);
            noiseGateValue.textContent = Math.round(this.config.noiseGate * 1000);
            this.applyNoiseGateChange();
        });
        
        // Sample rate
        document.querySelectorAll('input[name="sampleRate"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.config.sampleRate = parseInt(e.target.value);
                }
            });
        });
        
        // Action buttons
        document.getElementById('testAudioBtn').addEventListener('click', () => {
            this.testAudio();
        });
        
        document.getElementById('resetAudioConfigBtn').addEventListener('click', () => {
            this.resetToDefaults();
        });
        
        document.getElementById('applyAudioConfigBtn').addEventListener('click', () => {
            this.applyConfiguration();
        });
    }
    
    toggleConfigPanel(force = null) {
        const content = document.getElementById('audioConfigContent');
        const toggleBtn = document.getElementById('audioConfigToggleBtn');
        
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
            toggleBtn.textContent = '🎚️';
            toggleBtn.classList.remove('active');
        }
    }
    
    updateDeviceList() {
        const select = document.getElementById('audioDeviceSelect');
        if (!select) return;
        
        // Save current selection
        const currentValue = select.value;
        
        // Clear and rebuild options
        select.innerHTML = '<option value="">Default Device</option>';
        this.audioDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Device ${device.deviceId.slice(0, 8)}...`;
            if (device.deviceId === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
    
    applyGainChange() {
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(this.config.inputGain, this.audioHandler.audioContext.currentTime);
        }
    }
    
    applyNoiseGateChange() {
        if (this.audioHandler.signalConditioner) {
            this.audioHandler.signalConditioner.setNoiseGate(this.config.noiseGate);
        }
    }
    
    async applyConfiguration() {
        try {
            // Show loading state
            const applyBtn = document.getElementById('applyAudioConfigBtn');
            const originalText = applyBtn.textContent;
            applyBtn.textContent = 'Applying...';
            applyBtn.disabled = true;
            
            // If device changed, need to reinitialize audio
            const needsReinit = this.hasSignificantChanges();
            
            if (needsReinit) {
                // Stop current audio
                this.audioHandler.stop();
                
                // Reinitialize with new settings
                await this.initializeAudioWithConfig();
            } else {
                // Apply changes that don't require reinitialization
                this.applyGainChange();
                this.applyNoiseGateChange();
            }
            
            // Update signal conditioner sensitivity
            if (this.audioHandler.signalConditioner) {
                this.audioHandler.signalConditioner.setSensitivity(this.config.inputSensitivity);
            }
            
            // Save settings
            this.saveSettings();
            
            // Show confirmation
            this.showApplyConfirmation();
            
            // Restore button
            applyBtn.textContent = originalText;
            applyBtn.disabled = false;
            
            console.log('Audio configuration applied:', this.config);
            
        } catch (error) {
            console.error('Failed to apply audio configuration:', error);
            this.showErrorMessage('Failed to apply audio settings. Please try again.');
            
            // Restore button
            const applyBtn = document.getElementById('applyAudioConfigBtn');
            applyBtn.textContent = 'Apply Changes';
            applyBtn.disabled = false;
        }
    }
    
    hasSignificantChanges() {
        // Check if changes require audio reinitialization
        const currentDevice = this.audioHandler.mediaStream?.getAudioTracks()[0]?.getSettings().deviceId;
        return (this.config.deviceId !== currentDevice) || 
               (this.config.sampleRate !== this.audioHandler.audioContext?.sampleRate);
    }
    
    async initializeAudioWithConfig() {
        const constraints = {
            audio: {
                deviceId: this.config.deviceId ? { exact: this.config.deviceId } : undefined,
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false,
                sampleRate: this.config.sampleRate
            }
        };
        
        // Get media stream with specific device
        this.audioHandler.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Create audio context with preferred sample rate
        const audioContextOptions = {
            sampleRate: this.config.sampleRate
        };
        this.audioHandler.audioContext = new (window.AudioContext || window.webkitAudioContext)(audioContextOptions);
        
        // Create audio pipeline
        this.audioHandler.harmonicFilter = new HarmonicFilter(this.audioHandler.audioContext, this.audioHandler.audioContext.sampleRate);
        this.audioHandler.microphone = this.audioHandler.audioContext.createMediaStreamSource(this.audioHandler.mediaStream);
        
        // Create and insert gain node
        this.gainNode = this.audioHandler.audioContext.createGain();
        this.gainNode.gain.setValueAtTime(this.config.inputGain, this.audioHandler.audioContext.currentTime);
        
        // Connect pipeline: microphone -> gain -> harmonic filter -> analyser
        this.audioHandler.microphone.connect(this.gainNode);
        this.audioHandler.analyser = this.audioHandler.harmonicFilter.connectInput(this.gainNode);
        
        // Recreate signal conditioner
        this.audioHandler.signalConditioner = new SignalConditioner(this.audioHandler.audioContext.sampleRate, 4096);
        this.audioHandler.signalConditioner.setNoiseGate(this.config.noiseGate);
        this.audioHandler.signalConditioner.setSensitivity(this.config.inputSensitivity);
    }
    
    testAudio() {
        const testBtn = document.getElementById('testAudioBtn');
        const originalText = testBtn.textContent;
        
        // Visual feedback
        testBtn.textContent = '🎤 Testing...';
        testBtn.style.backgroundColor = 'var(--accent-red)';
        
        // Monitor input for 3 seconds
        let maxLevel = 0;
        const testDuration = 3000;
        const startTime = Date.now();
        
        const testLoop = () => {
            if (Date.now() - startTime < testDuration) {
                const level = this.getCurrentInputLevel();
                maxLevel = Math.max(maxLevel, level);
                requestAnimationFrame(testLoop);
            } else {
                // Show results
                const dbLevel = maxLevel > 0 ? 20 * Math.log10(maxLevel) : -Infinity;
                let message, color;
                
                if (dbLevel > -20) {
                    message = `Good signal! Peak: ${dbLevel.toFixed(1)} dB`;
                    color = '#4CAF50';
                } else if (dbLevel > -40) {
                    message = `Weak signal. Peak: ${dbLevel.toFixed(1)} dB. Consider increasing gain.`;
                    color = '#FF9800';
                } else {
                    message = `No signal detected. Check your microphone connection.`;
                    color = '#f44336';
                }
                
                this.showTestResult(message, color);
                
                // Restore button
                testBtn.textContent = originalText;
                testBtn.style.backgroundColor = '';
            }
        };
        
        testLoop();
    }
    
    getCurrentInputLevel() {
        if (!this.audioHandler.analyser) return 0;
        
        const bufferLength = this.audioHandler.analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        this.audioHandler.analyser.getFloatTimeDomainData(dataArray);
        
        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        return Math.sqrt(sum / bufferLength);
    }
    
    startInputMonitoring() {
        const levelBar = document.getElementById('inputLevelBar');
        const levelText = document.getElementById('inputLevelText');
        
        if (!levelBar || !levelText) return;
        
        const updateLevels = () => {
            const level = this.getCurrentInputLevel();
            const dbLevel = level > 0 ? 20 * Math.log10(level) : -Infinity;
            
            // Update level bar (0 to 100% based on -60dB to 0dB range)
            const normalizedLevel = Math.max(0, Math.min(1, (dbLevel + 60) / 60));
            levelBar.style.width = `${normalizedLevel * 100}%`;
            
            // Color based on level
            if (dbLevel > -10) {
                levelBar.style.backgroundColor = '#f44336'; // Red - too loud
            } else if (dbLevel > -20) {
                levelBar.style.backgroundColor = '#4CAF50'; // Green - good
            } else if (dbLevel > -40) {
                levelBar.style.backgroundColor = '#FF9800'; // Orange - low
            } else {
                levelBar.style.backgroundColor = '#666'; // Gray - very low
            }
            
            // Update text
            levelText.textContent = isFinite(dbLevel) ? `${dbLevel.toFixed(1)} dB` : '-∞ dB';
            
            requestAnimationFrame(updateLevels);
        };
        
        updateLevels();
    }
    
    showTestResult(message, color) {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            const originalText = statusText.textContent;
            const originalColor = statusText.style.color;
            
            statusText.textContent = message;
            statusText.style.color = color;
            
            setTimeout(() => {
                statusText.textContent = originalText;
                statusText.style.color = originalColor;
            }, 4000);
        }
    }
    
    showApplyConfirmation() {
        const statusText = document.getElementById('statusText');
        const originalText = statusText.textContent;
        statusText.textContent = 'Audio configuration updated!';
        statusText.style.color = '#4CAF50';
        
        setTimeout(() => {
            statusText.textContent = originalText;
            statusText.style.color = '';
        }, 2000);
        
        // Close panel after applying
        this.toggleConfigPanel(false);
    }
    
    showErrorMessage(message) {
        const statusText = document.getElementById('statusText');
        const originalText = statusText.textContent;
        statusText.textContent = message;
        statusText.style.color = '#f44336';
        
        setTimeout(() => {
            statusText.textContent = originalText;
            statusText.style.color = '';
        }, 4000);
    }
    
    resetToDefaults() {
        this.config = {
            deviceId: null,
            inputGain: 1.0,
            inputSensitivity: 0.3,
            noiseGate: 0.02,
            sampleRate: 44100,
            bufferSize: 4096
        };
        
        this.updateUIFromConfig();
    }
    
    updateUIFromConfig() {
        document.getElementById('audioDeviceSelect').value = this.config.deviceId || '';
        document.getElementById('inputGainSlider').value = this.config.inputGain;
        document.getElementById('inputGainValue').textContent = `${this.config.inputGain.toFixed(1)}x`;
        document.getElementById('inputSensitivitySlider').value = this.config.inputSensitivity;
        document.getElementById('inputSensitivityValue').textContent = `${Math.round(this.config.inputSensitivity * 100)}%`;
        document.getElementById('noiseGateSlider').value = this.config.noiseGate;
        document.getElementById('noiseGateValue').textContent = Math.round(this.config.noiseGate * 1000);
        
        // Sample rate radio buttons
        document.querySelector(`input[name="sampleRate"][value="${this.config.sampleRate}"]`).checked = true;
    }
    
    saveSettings() {
        try {
            localStorage.setItem('whistleAudioConfig', JSON.stringify(this.config));
        } catch (e) {
            console.warn('Could not save audio configuration:', e);
        }
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('whistleAudioConfig');
            if (saved) {
                const savedConfig = JSON.parse(saved);
                this.config = { ...this.config, ...savedConfig };
                console.log('Loaded saved audio configuration:', this.config);
            }
        } catch (e) {
            console.warn('Could not load saved audio configuration:', e);
        }
    }
    
    // Public API
    getConfiguration() {
        return { ...this.config };
    }
    
    setConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.updateUIFromConfig();
    }
    
    getAvailableDevices() {
        return [...this.audioDevices];
    }
}