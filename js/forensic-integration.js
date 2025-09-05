/**
 * Forensic Integration - Connects the Forensic Audio Analysis Engine with existing app
 * Provides seamless integration with existing YIN detector and notation system
 */

class ForensicIntegration {
    constructor(app) {
        this.app = app;
        this.forensicAnalyzer = null;
        this.isEnabled = false;
        this.analysisBuffer = [];
        
        // Configuration
        this.config = {
            enableForensicAnalysis: true,
            enableMidiExport: true,
            enableArticulationDetection: true,
            bufferSize: 4096,
            analysisInterval: 50 // ms between analyses
        };
        
        console.log('Forensic Integration initialized');
    }
    
    /**
     * Initialize the forensic analysis system
     */
    async initialize() {
        try {
            // Create forensic analyzer with audio context from main app
            if (!this.app.audioHandler || !this.app.audioHandler.audioContext) {
                throw new Error('Audio context not available');
            }
            
            this.forensicAnalyzer = new ForensicAudioAnalyzer(
                this.app.audioHandler.audioContext,
                this.config
            );
            
            // Connect with existing YIN detector
            if (this.app.pitchDetector && this.app.pitchDetector.yinDetector) {
                this.forensicAnalyzer.setYinDetector(this.app.pitchDetector.yinDetector);
            }
            
            // Hook into the existing analysis loop
            this.hookIntoAnalysisLoop();
            
            // Initialize UI controls
            this.initializeUI();
            
            this.isEnabled = true;
            console.log('Forensic Analysis Engine activated');
            
        } catch (error) {
            console.error('Failed to initialize Forensic Analysis Engine:', error);
            this.isEnabled = false;
        }
    }
    
    /**
     * Hook into the existing app analysis loop
     */
    hookIntoAnalysisLoop() {
        // Store original analysis method
        const originalAnalyzeFrame = this.app.analyzeFrame;
        
        // Replace with enhanced version
        this.app.analyzeFrame = (timestamp) => {
            // Run original analysis
            const originalResult = originalAnalyzeFrame.call(this.app, timestamp);
            
            // Run forensic analysis if enabled
            if (this.isEnabled && this.forensicAnalyzer && this.app.audioHandler) {
                try {
                    const audioBuffer = this.getLatestAudioBuffer();
                    if (audioBuffer && audioBuffer.length > 0) {
                        const forensicResult = this.forensicAnalyzer.analyzeSound(audioBuffer, timestamp);
                        
                        if (forensicResult) {
                            // Enhance the original result with forensic data
                            this.enhanceNoteData(originalResult, forensicResult);
                            
                            // Update UI with forensic analysis
                            this.updateForensicUI(forensicResult);
                            
                            // Store for MIDI export
                            this.storeAnalysisResult(forensicResult, timestamp);
                        }
                    }
                } catch (error) {
                    console.error('Forensic analysis failed:', error);
                }
            }
            
            return originalResult;
        };
    }
    
    /**
     * Get the latest audio buffer for analysis
     */
    getLatestAudioBuffer() {
        if (!this.app.audioHandler || !this.app.audioHandler.analyser) {
            return null;
        }
        
        const analyser = this.app.audioHandler.analyser;
        const bufferLength = analyser.fftSize;
        const audioBuffer = new Float32Array(bufferLength);
        
        // Get time domain data
        analyser.getFloatTimeDomainData(audioBuffer);
        
        return audioBuffer;
    }
    
    /**
     * Enhance original note data with forensic analysis
     */
    enhanceNoteData(originalNote, forensicResult) {
        if (!originalNote || !forensicResult) return;
        
        // Add forensic pitch data
        if (forensicResult.pitch) {
            originalNote.forensicPitch = {
                preciseFrequency: forensicResult.pitch.fundamental,
                cents: forensicResult.pitch.cents,
                vibrato: forensicResult.pitch.vibrato,
                portamento: forensicResult.pitch.portamento,
                confidence: forensicResult.pitch.confidence
            };
        }
        
        // Add dynamics analysis
        if (forensicResult.dynamics) {
            originalNote.forensicDynamics = {
                attack: forensicResult.dynamics.attack,
                sustain: forensicResult.dynamics.sustain,
                release: forensicResult.dynamics.release,
                envelope: forensicResult.dynamics.envelope
            };
        }
        
        // Add spectral/timbre data
        if (forensicResult.timbre) {
            originalNote.forensicTimbre = {
                spectralCentroid: forensicResult.timbre.spectralCentroid,
                harmonics: forensicResult.timbre.harmonicProfile,
                formants: forensicResult.timbre.formants,
                brightness: forensicResult.timbre.spectralCentroid
            };
        }
        
        // Add articulation classification
        if (forensicResult.articulation) {
            originalNote.forensicArticulation = {
                attackType: forensicResult.articulation.attackType,
                legato: forensicResult.articulation.legato,
                breathAnalysis: forensicResult.articulation.breathAnalysis,
                vocalRegister: forensicResult.articulation.vocalRegister,
                techniques: forensicResult.articulation.technique
            };
        }
        
        // Add MIDI data
        if (forensicResult.midiData) {
            originalNote.forensicMidi = forensicResult.midiData;
        }
    }
    
    /**
     * Initialize forensic analysis UI controls
     */
    initializeUI() {
        // Create forensic analysis panel
        this.createForensicPanel();
        
        // Add forensic analysis toggle
        this.addForensicToggle();
        
        // Add MIDI export button with forensic data
        this.addForensicMidiExport();
        
        // Add forensic analysis display
        this.addForensicDisplay();
    }
    
    /**
     * Create forensic analysis control panel
     */
    createForensicPanel() {
        const existingPanel = document.querySelector('.forensic-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        const panel = document.createElement('div');
        panel.className = 'forensic-panel';
        panel.innerHTML = `
            <div class="forensic-header">
                <h3>🔬 Forensic Analysis</h3>
                <button id="forensicToggle" class="toggle-btn active">ON</button>
            </div>
            <div class="forensic-controls">
                <button id="exportForensicMidi" class="primary-btn">
                    <span>🎹 Export Detailed MIDI</span>
                </button>
                <button id="exportAnalysisReport" class="secondary-btn">
                    <span>📊 Analysis Report</span>
                </button>
            </div>
            <div class="forensic-display" id="forensicDisplay">
                <div class="forensic-metrics">
                    <div class="metric">
                        <label>Pitch Precision:</label>
                        <span id="pitchPrecision">±0.0¢</span>
                    </div>
                    <div class="metric">
                        <label>Vibrato:</label>
                        <span id="vibratoInfo">None</span>
                    </div>
                    <div class="metric">
                        <label>Attack Type:</label>
                        <span id="attackType">Soft</span>
                    </div>
                    <div class="metric">
                        <label>Vocal Register:</label>
                        <span id="vocalRegister">Mixed</span>
                    </div>
                    <div class="metric">
                        <label>Brightness:</label>
                        <span id="spectralBrightness">1200Hz</span>
                    </div>
                    <div class="metric">
                        <label>Expression CCs:</label>
                        <span id="expressionCCs">12 active</span>
                    </div>
                </div>
            </div>
        `;
        
        // Insert after debug panel
        const debugPanel = document.querySelector('.debug-panel');
        if (debugPanel) {
            debugPanel.parentNode.insertBefore(panel, debugPanel.nextSibling);
        } else {
            document.querySelector('.app-main').appendChild(panel);
        }
        
        // Bind events
        document.getElementById('forensicToggle').addEventListener('click', () => {
            this.toggleForensicAnalysis();
        });
        
        document.getElementById('exportForensicMidi').addEventListener('click', () => {
            this.exportForensicMidi();
        });
        
        document.getElementById('exportAnalysisReport').addEventListener('click', () => {
            this.exportAnalysisReport();
        });
    }
    
    /**
     * Add forensic analysis toggle to existing controls
     */
    addForensicToggle() {
        // The toggle is already in the forensic panel
        // This method can be extended to add toggles elsewhere
    }
    
    /**
     * Add forensic MIDI export functionality
     */
    addForensicMidiExport() {
        // Enhance existing MIDI export to include forensic data
        const originalExportMidi = this.app.exportMIDI;
        
        this.app.exportMIDI = () => {
            if (this.isEnabled && this.analysisBuffer.length > 0) {
                return this.exportForensicMidi();
            } else {
                return originalExportMidi.call(this.app);
            }
        };
    }
    
    /**
     * Update forensic analysis display
     */
    updateForensicUI(forensicResult) {
        if (!forensicResult) return;
        
        try {
            // Update pitch precision
            if (forensicResult.pitch && forensicResult.pitch.cents !== undefined) {
                const precision = Math.abs(forensicResult.pitch.cents % 100);
                document.getElementById('pitchPrecision').textContent = `±${precision.toFixed(1)}¢`;
            }
            
            // Update vibrato info
            if (forensicResult.pitch && forensicResult.pitch.vibrato) {
                const vibrato = forensicResult.pitch.vibrato;
                if (vibrato.present) {
                    document.getElementById('vibratoInfo').textContent = 
                        `${vibrato.rate.toFixed(1)}Hz, ${vibrato.depth.toFixed(1)}¢`;
                } else {
                    document.getElementById('vibratoInfo').textContent = 'None';
                }
            }
            
            // Update attack type
            if (forensicResult.articulation && forensicResult.articulation.attackType) {
                document.getElementById('attackType').textContent = 
                    forensicResult.articulation.attackType;
            }
            
            // Update vocal register
            if (forensicResult.articulation && forensicResult.articulation.vocalRegister) {
                document.getElementById('vocalRegister').textContent = 
                    forensicResult.articulation.vocalRegister;
            }
            
            // Update spectral brightness
            if (forensicResult.timbre && forensicResult.timbre.spectralCentroid) {
                document.getElementById('spectralBrightness').textContent = 
                    `${Math.round(forensicResult.timbre.spectralCentroid)}Hz`;
            }
            
            // Update expression CCs count
            if (forensicResult.midiData && forensicResult.midiData.controlChanges) {
                const ccCount = Object.keys(forensicResult.midiData.controlChanges).length;
                document.getElementById('expressionCCs').textContent = 
                    `${ccCount} active`;
            }
            
        } catch (error) {
            console.error('Failed to update forensic UI:', error);
        }
    }
    
    /**
     * Store analysis result for later export
     */
    storeAnalysisResult(forensicResult, timestamp) {
        this.analysisBuffer.push({
            timestamp: timestamp,
            analysis: forensicResult
        });
        
        // Keep buffer manageable (last 1000 analyses)
        if (this.analysisBuffer.length > 1000) {
            this.analysisBuffer = this.analysisBuffer.slice(-1000);
        }
    }
    
    /**
     * Toggle forensic analysis on/off
     */
    toggleForensicAnalysis() {
        this.isEnabled = !this.isEnabled;
        
        const toggleBtn = document.getElementById('forensicToggle');
        if (toggleBtn) {
            toggleBtn.textContent = this.isEnabled ? 'ON' : 'OFF';
            toggleBtn.className = this.isEnabled ? 'toggle-btn active' : 'toggle-btn';
        }
        
        const display = document.getElementById('forensicDisplay');
        if (display) {
            display.style.display = this.isEnabled ? 'block' : 'none';
        }
        
        console.log('Forensic Analysis:', this.isEnabled ? 'Enabled' : 'Disabled');
    }
    
    /**
     * Export MIDI with complete forensic analysis data
     */
    exportForensicMidi() {
        if (this.analysisBuffer.length === 0) {
            console.warn('No forensic analysis data to export');
            return;
        }
        
        console.log('Generating detailed MIDI with forensic data...');
        
        // Create comprehensive MIDI data
        const midiData = this.generateComprehensiveMidi();
        
        // Create download
        const blob = new Blob([midiData], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `whistle-forensic-${timestamp}.mid`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log(`Exported forensic MIDI: ${filename}`);
    }
    
    /**
     * Export comprehensive analysis report
     */
    exportAnalysisReport() {
        if (this.analysisBuffer.length === 0) {
            console.warn('No analysis data to export');
            return;
        }
        
        const report = this.generateAnalysisReport();
        
        const blob = new Blob([report], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `whistle-analysis-${timestamp}.json`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log(`Exported analysis report: ${filename}`);
    }
    
    /**
     * Generate comprehensive MIDI data with all forensic information
     */
    generateComprehensiveMidi() {
        // This would generate actual MIDI file with all CC data
        // For now, return mock MIDI data
        const midiEvents = [];
        
        this.analysisBuffer.forEach((item, index) => {
            const analysis = item.analysis;
            
            if (analysis.midiData) {
                // Add note on/off events
                midiEvents.push({
                    type: 'noteOn',
                    time: index * 100, // ms
                    note: analysis.midiData.note,
                    velocity: analysis.midiData.velocity,
                    channel: analysis.midiData.channel || 1
                });
                
                // Add all control changes
                Object.entries(analysis.midiData.controlChanges || {}).forEach(([cc, data]) => {
                    data.forEach(ccEvent => {
                        midiEvents.push({
                            type: 'controlChange',
                            time: (index * 100) + ccEvent.time,
                            controller: parseInt(cc),
                            value: ccEvent.value,
                            channel: analysis.midiData.channel || 1
                        });
                    });
                });
                
                // Add pitch bend data
                if (analysis.midiData.pitchBend) {
                    analysis.midiData.pitchBend.forEach(bendEvent => {
                        midiEvents.push({
                            type: 'pitchBend',
                            time: (index * 100) + bendEvent.time,
                            value: bendEvent.value,
                            channel: analysis.midiData.channel || 1
                        });
                    });
                }
            }
        });
        
        // Convert to MIDI file format (simplified for demo)
        return JSON.stringify(midiEvents, null, 2);
    }
    
    /**
     * Generate detailed analysis report
     */
    generateAnalysisReport() {
        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                analysisCount: this.analysisBuffer.length,
                version: '1.0.0',
                analyzer: 'Whistle Forensic Audio Analysis Engine'
            },
            summary: this.generateAnalysisSummary(),
            detailedAnalysis: this.analysisBuffer.map(item => ({
                timestamp: item.timestamp,
                ...item.analysis
            }))
        };
        
        return JSON.stringify(report, null, 2);
    }
    
    /**
     * Generate analysis summary statistics
     */
    generateAnalysisSummary() {
        if (this.analysisBuffer.length === 0) {
            return {};
        }
        
        const pitchData = this.analysisBuffer
            .map(item => item.analysis.pitch)
            .filter(pitch => pitch && pitch.fundamental);
            
        const dynamicsData = this.analysisBuffer
            .map(item => item.analysis.dynamics)
            .filter(dynamics => dynamics);
            
        return {
            pitchRange: {
                lowest: pitchData.length > 0 ? Math.min(...pitchData.map(p => p.fundamental)) : 0,
                highest: pitchData.length > 0 ? Math.max(...pitchData.map(p => p.fundamental)) : 0,
                averageConfidence: pitchData.length > 0 ? 
                    pitchData.reduce((sum, p) => sum + p.confidence, 0) / pitchData.length : 0
            },
            vibrato: {
                detectedCount: pitchData.filter(p => p.vibrato && p.vibrato.present).length,
                averageRate: this.calculateAverageVibratoRate(pitchData),
                averageDepth: this.calculateAverageVibratoDepth(pitchData)
            },
            dynamics: {
                averageAttackTime: dynamicsData.length > 0 ?
                    dynamicsData.reduce((sum, d) => sum + (d.attack?.time || 0), 0) / dynamicsData.length : 0,
                dynamicRange: this.calculateDynamicRange(dynamicsData)
            },
            articulation: {
                techniques: this.getUniqueArticulationTechniques(),
                registerDistribution: this.getVocalRegisterDistribution()
            }
        };
    }
    
    /**
     * Utility methods for summary generation
     */
    
    calculateAverageVibratoRate(pitchData) {
        const vibratoData = pitchData.filter(p => p.vibrato && p.vibrato.present);
        return vibratoData.length > 0 ?
            vibratoData.reduce((sum, p) => sum + p.vibrato.rate, 0) / vibratoData.length : 0;
    }
    
    calculateAverageVibratoDepth(pitchData) {
        const vibratoData = pitchData.filter(p => p.vibrato && p.vibrato.present);
        return vibratoData.length > 0 ?
            vibratoData.reduce((sum, p) => sum + p.vibrato.depth, 0) / vibratoData.length : 0;
    }
    
    calculateDynamicRange(dynamicsData) {
        if (dynamicsData.length === 0) return 0;
        
        const velocities = dynamicsData
            .map(d => d.attack?.peakVelocity)
            .filter(v => v !== undefined);
            
        return velocities.length > 0 ? Math.max(...velocities) - Math.min(...velocities) : 0;
    }
    
    getUniqueArticulationTechniques() {
        const techniques = new Set();
        
        this.analysisBuffer.forEach(item => {
            if (item.analysis.articulation && item.analysis.articulation.technique) {
                item.analysis.articulation.technique.forEach(tech => {
                    techniques.add(tech.name || tech);
                });
            }
        });
        
        return Array.from(techniques);
    }
    
    getVocalRegisterDistribution() {
        const registers = {};
        
        this.analysisBuffer.forEach(item => {
            const register = item.analysis.articulation?.vocalRegister || 'unknown';
            registers[register] = (registers[register] || 0) + 1;
        });
        
        return registers;
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ForensicIntegration;
}