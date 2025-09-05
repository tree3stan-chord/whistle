class WhistleApp {
    constructor() {
        this.audioHandler = null;
        this.pitchDetector = null;
        this.notationRenderer = null;
        this.rhythmQuantizer = null;
        this.isListening = false;
        this.lastActivityTime = 0;
        this.inactivityThreshold = 2000; // Reduce updates after 2s of no activity
        this.inputMode = 'vocal'; // Default to vocal mode
        this.realTimeQuantization = false; // Start with cadenza mode
        
        // Real-time vocal coaching
        this.vocalCoach = null;
        
        // Phase 7+8: Advanced Musical Intelligence
        this.musicalIntelligence = null;
        
        // Performance optimization
        this.targetFrameRate = 60; // Target FPS for analysis loop
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / this.targetFrameRate;
        this.performanceStats = {
            frameCount: 0,
            lastStatsTime: 0,
            averageFrameTime: 0,
            maxFrameTime: 0,
            dropgedFrames: 0
        };
        this.skipNonCriticalUpdates = false; // Skip UI updates when performance is poor
        
        this.initializeElements();
        this.bindEvents();
        this.setupCanvas();
        this.initializeQuantizer();
        this.initializeStaffConfig();
        this.initializePlayhead();
        this.initializeRegisterDetector();
        this.initializeAudioConfig();
        this.initializeEnhancedExport();
        this.initializeSessionManager();
        this.initializeForensicAnalysis();
        this.initializeVocalTranscription();
        this.initializeArticulationIntegration();
        this.initializeVocalCoaching();
        this.initializeAdvancedMusicalIntelligence();
    }
    
    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.analyzeRhythmBtn = document.getElementById('analyzeRhythmBtn');
        this.quantizeToggleBtn = document.getElementById('quantizeToggleBtn');
        this.exportPngBtn = document.getElementById('exportPngBtn');
        this.exportJsonBtn = document.getElementById('exportJsonBtn');
        this.exportMidiBtn = document.getElementById('exportMidiBtn');
        this.exportMusicXmlBtn = document.getElementById('exportMusicXmlBtn');
        this.exportSvgBtn = document.getElementById('exportSvgBtn');
        this.exportPdfBtn = document.getElementById('exportPdfBtn');
        this.exportAllBtn = document.getElementById('exportAllBtn');
        this.vocalModeBtn = document.getElementById('vocalModeBtn');
        this.instrumentModeBtn = document.getElementById('instrumentModeBtn');
        this.statusText = document.getElementById('statusText');
        this.pitchDisplay = document.getElementById('pitchDisplay');
        
        // New UI elements
        this.debugToggle = document.getElementById('debugToggle');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.debugPanel = document.getElementById('debugPanel');
        this.freqDisplay = document.getElementById('freqDisplay');
        this.noteDisplay = document.getElementById('noteDisplay');
        this.onsetDisplay = document.getElementById('onsetDisplay');
        this.fluxDisplay = document.getElementById('fluxDisplay');
        this.tempoDisplay = document.getElementById('tempoDisplay');
        this.beatPhaseDisplay = document.getElementById('beatPhaseDisplay');
        this.intervalsDisplay = document.getElementById('intervalsDisplay');
        this.canvas = document.getElementById('staffCanvas');
        
        // Session Management UI
        this.saveSessionBtn = document.getElementById('saveSessionBtn');
        this.loadSessionBtn = document.getElementById('loadSessionBtn');
        this.authBtn = document.getElementById('authBtn');
        this.authInfo = document.getElementById('authInfo');
        this.connectivityStatus = document.getElementById('connectivityStatus');
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startListening());
        this.stopBtn.addEventListener('click', () => this.stopListening());
        this.clearBtn.addEventListener('click', () => this.clearNotation());
        this.analyzeRhythmBtn.addEventListener('click', () => this.analyzeRecordedRhythm());
        this.quantizeToggleBtn.addEventListener('click', () => this.toggleQuantization());
        this.exportPngBtn.addEventListener('click', () => this.exportPng());
        this.exportJsonBtn.addEventListener('click', () => this.exportJson());
        this.exportMidiBtn.addEventListener('click', () => this.exportMIDI());
        this.exportMusicXmlBtn.addEventListener('click', () => this.exportMusicXML());
        this.exportSvgBtn.addEventListener('click', () => this.exportSVG());
        this.exportPdfBtn.addEventListener('click', () => this.exportPDF());
        this.exportAllBtn.addEventListener('click', () => this.exportAll());
        this.vocalModeBtn.addEventListener('click', () => this.setInputMode('vocal'));
        this.instrumentModeBtn.addEventListener('click', () => this.setInputMode('instrument'));
        
        // New UI event handlers
        this.debugToggle.addEventListener('click', () => this.toggleDebugPanel());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        
        // Session Management event handlers
        this.saveSessionBtn.addEventListener('click', () => this.showSessionModal('save'));
        this.loadSessionBtn.addEventListener('click', () => this.showSessionModal('load'));
        this.authBtn.addEventListener('click', () => this.showAuthModal());
    }
    
    setupCanvas() {
        this.notationRenderer = new VocalNotationRenderer(this.canvas);
        this.notationRenderer.drawStaff();
    }
    
    initializeQuantizer() {
        this.rhythmQuantizer = new RhythmQuantizer();
        this.rhythmQuantizer.setTempo(120); // Default tempo
        this.rhythmQuantizer.setQuantizationLevel(16); // 16th note quantization
        this.rhythmQuantizer.enableAdaptiveQuantization(true);
    }
    
    /**
     * Update vocal notation with latest transcription data
     */
    updateVocalNotation() {
        if (!this.notationRenderer || !this.vocalTranscriptionEngine) return;
        
        // Get latest transcription data if available
        const transcriptionData = this.vocalTranscriptionEngine.getLatestTranscription();
        const articulationData = this.articulationIntegration ? 
            this.articulationIntegration.getLatestArticulationAnalysis() : null;
        
        // Update vocal notation with comprehensive data
        if (transcriptionData || articulationData) {
            this.notationRenderer.renderVocalScore(
                this.notationRenderer.allNotes,  // Current pitch data
                transcriptionData ? {
                    syllables: transcriptionData.syllables || [],
                    confidence: transcriptionData.confidence || 0
                } : null,
                articulationData
            );
        }
    }
    
    /**
     * Update vocal coaching with latest performance data
     */
    updateVocalCoaching(noteOnset) {
        if (!this.vocalCoach || !noteOnset) return;
        
        // Get rhythm data if available
        const rhythmData = this.rhythmQuantizer ? {
            onsetTime: noteOnset.timestamp,
            beat: this.rhythmQuantizer.currentBeat,
            tempo: this.rhythmQuantizer.currentTempo
        } : null;
        
        // Get articulation data if available
        const articulationData = this.articulationIntegration ?
            this.articulationIntegration.getLatestArticulationAnalysis() : null;
        
        // Analyze performance and get coaching feedback
        this.vocalCoach.analyzePerformance(noteOnset, rhythmData, articulationData);
    }
    
    /**
     * Update advanced musical intelligence with latest performance data
     */
    async updateMusicalIntelligence(noteOnset) {
        if (!this.musicalIntelligence || !noteOnset) return;
        
        // Throttle musical intelligence updates for performance
        const now = Date.now();
        if (!this.lastMusicalIntelligenceUpdate) this.lastMusicalIntelligenceUpdate = 0;
        
        if (now - this.lastMusicalIntelligenceUpdate < 1000) return; // Update every 1 second
        
        try {
            // Gather comprehensive data for analysis
            const audioData = {
                pitchData: this.notationRenderer.allNotes || [],
                spectralData: this.forensicIntegration ? this.forensicIntegration.getLatestSpectralData() : null,
                pitchVariation: this.calculatePitchVariation(),
                vibratoPresent: noteOnset.vibrato || false
            };
            
            const transcriptionData = this.vocalTranscriptionEngine ? 
                this.vocalTranscriptionEngine.getLatestTranscription() : { 
                    text: '', 
                    syllables: [], 
                    pitchData: [noteOnset] 
                };
            
            const rhythmData = this.rhythmQuantizer ? {
                beatPositions: this.rhythmQuantizer.getBeatPositions ? this.rhythmQuantizer.getBeatPositions() : [],
                currentBeat: this.rhythmQuantizer.currentBeat || 0,
                tempo: this.rhythmQuantizer.currentTempo || 120
            } : null;
            
            // Perform comprehensive musical intelligence analysis
            const analysis = await this.musicalIntelligence.performComprehensiveAnalysis(
                audioData,
                transcriptionData,
                rhythmData
            );
            
            if (analysis) {
                // Log insights for debugging
                if (analysis.insights && analysis.insights.cultural.length > 0) {
                    console.log('🌍 Cultural insight:', analysis.insights.cultural[0].message);
                }
                
                if (analysis.insights && analysis.insights.harmonic.length > 0) {
                    console.log('🎼 Harmonic insight:', analysis.insights.harmonic[0].message);
                }
                
                // Update UI if needed (could add musical intelligence display panel)
                this.displayMusicalIntelligenceInsights(analysis.insights);
            }
            
            this.lastMusicalIntelligenceUpdate = now;
            
        } catch (error) {
            console.error('Musical intelligence update failed:', error);
        }
    }
    
    /**
     * Display musical intelligence insights (placeholder for future UI)
     */
    displayMusicalIntelligenceInsights(insights) {
        // This could be expanded to update a dedicated musical intelligence UI panel
        if (insights && insights.performance.length > 0) {
            console.log('🧠 Performance insight:', insights.performance[0].message);
        }
    }
    
    /**
     * Calculate pitch variation for musical intelligence analysis
     */
    calculatePitchVariation() {
        if (!this.notationRenderer || !this.notationRenderer.allNotes || this.notationRenderer.allNotes.length < 2) {
            return 0;
        }
        
        const notes = this.notationRenderer.allNotes;
        let totalVariation = 0;
        
        for (let i = 1; i < notes.length; i++) {
            const interval = Math.abs(notes[i].midiNote - notes[i-1].midiNote);
            totalVariation += interval;
        }
        
        return totalVariation / (notes.length - 1) / 12; // Normalize to octaves
    }
    
    initializeStaffConfig() {
        // Initialize staff configuration system
        this.staffConfig = new StaffConfiguration(this.notationRenderer, this);
        
        // Apply initial configuration from saved settings
        const config = this.staffConfig.getConfiguration();
        if (this.rhythmQuantizer) {
            this.rhythmQuantizer.setTempo(config.tempo);
            this.rhythmQuantizer.setQuantizationLevel(config.quantizationLevel);
        }
    }
    
    initializePlayhead() {
        // Initialize playhead system
        this.playhead = new Playhead(this.notationRenderer, this);
        
        // Connect playhead to notation renderer
        this.notationRenderer.setPlayhead(this.playhead);
        
        // Apply initial configuration
        const config = this.staffConfig.getConfiguration();
        this.playhead.updateConfiguration(config);
    }
    
    initializeRegisterDetector() {
        // Initialize intelligent register detection
        this.registerDetector = new RegisterDetector(this.notationRenderer);
        
        // Connect register detector to notation renderer
        this.notationRenderer.setRegisterDetector(this.registerDetector);
        
        console.log('RegisterDetector initialized for intelligent clef switching');
    }
    
    async initializeAudioConfig() {
        // Initialize audio configuration system
        this.audioConfig = new AudioConfiguration(null, this);
        await this.audioConfig.initialize();
        
        console.log('AudioConfiguration initialized');
    }
    
    initializeEnhancedExport() {
        // Initialize enhanced export system with Phase 6 Professional Export
        this.enhancedExport = new EnhancedExport(
            this.notationRenderer, 
            this.staffConfig,
            this.vocalTranscriptionEngine,  // Will be set when vocal transcription is initialized
            this.articulationIntegration    // Will be set when articulation integration is initialized
        );
        console.log('🚀 Phase 6 Enhanced Export initialized with Professional Export capabilities');
    }
    
    initializeForensicAnalysis() {
        // Initialize forensic audio analysis system
        this.forensicIntegration = new ForensicIntegration(this);
        console.log('Forensic Analysis System initialized');
    }
    
    initializeVocalTranscription() {
        // Initialize revolutionary vocal transcription engine
        if (this.forensicIntegration && this.forensicIntegration.forensicAnalyzer) {
            this.vocalTranscriptionEngine = new VocalTranscriptionEngine(
                this.audioHandler, 
                this.forensicIntegration.forensicAnalyzer
            );
            
            // Set up event listeners for transcription updates
            this.setupTranscriptionEventListeners();
            
            // Update enhanced export with vocal transcription engine
            if (this.enhancedExport) {
                this.enhancedExport.vocalTranscriptionEngine = this.vocalTranscriptionEngine;
                if (this.enhancedExport.professionalExporter) {
                    this.enhancedExport.professionalExporter.transcriptionEngine = this.vocalTranscriptionEngine;
                }
            }
            
            console.log('🎤 Revolutionary Vocal Transcription Engine initialized - World\'s first web-based vocal-to-MIDI system ready!');
        } else {
            console.warn('Vocal transcription requires forensic analysis - initializing after audio starts');
        }
    }
    
    initializeArticulationIntegration() {
        // Initialize comprehensive articulation analysis integration
        if (this.vocalTranscriptionEngine && this.forensicIntegration) {
            this.articulationIntegration = new ArticulationTranscriptionIntegration(
                this.vocalTranscriptionEngine,
                this.forensicIntegration
            );
            
            this.setupArticulationEventListeners();
            
            // Update enhanced export with articulation integration
            if (this.enhancedExport) {
                this.enhancedExport.articulationIntegration = this.articulationIntegration;
                if (this.enhancedExport.professionalExporter) {
                    this.enhancedExport.professionalExporter.articulationIntegration = this.articulationIntegration;
                }
            }
            
            console.log('🎭 Advanced Articulation Analysis Integration initialized - Complete vocal performance analysis ready!');
        } else {
            console.warn('Articulation integration requires vocal transcription and forensic analysis');
        }
    }
    
    initializeVocalCoaching() {
        // Initialize real-time vocal coaching system
        // Wait for other systems to be ready
        if (this.audioHandler && this.pitchDetector && this.articulationIntegration) {
            this.vocalCoach = new RealTimeVocalCoach(
                this.audioHandler,
                this.pitchDetector,
                this.articulationIntegration
            );
            
            console.log('🎓 Real-time vocal coaching initialized');
        } else {
            // Defer initialization until dependencies are ready
            console.log('🎓 Vocal coaching deferred - waiting for dependencies');
        }
    }
    
    initializeAdvancedMusicalIntelligence() {
        // Initialize Phase 7+8: Advanced Musical Intelligence System
        // This will be fully initialized after all dependencies are ready
        console.log('🧠 Advanced Musical Intelligence initialization deferred - waiting for dependencies');
    }
    
    async startListening() {
        try {
            this.statusText.textContent = 'Requesting microphone access...';
            
            this.audioHandler = new AudioHandler();
            
            // Get audio configuration if available
            let audioConfig = null;
            if (this.audioConfig) {
                audioConfig = this.audioConfig.getConfiguration();
                this.audioConfig.audioHandler = this.audioHandler;
            }
            
            await this.audioHandler.initialize(audioConfig);
            
            this.pitchDetector = new PitchDetector(this.audioHandler);
            
            // Initialize vocal coach now that audio systems are ready
            if (!this.vocalCoach && this.articulationIntegration) {
                this.vocalCoach = new RealTimeVocalCoach(
                    this.audioHandler,
                    this.pitchDetector,
                    this.articulationIntegration
                );
                console.log('🎓 Real-time vocal coaching initialized (deferred)');
            }
            
            // Initialize advanced musical intelligence now that all systems are ready
            if (!this.musicalIntelligence && this.vocalTranscriptionEngine && this.articulationIntegration) {
                this.musicalIntelligence = new AdvancedMusicalIntelligence(
                    this.vocalTranscriptionEngine,
                    this.articulationIntegration,
                    this.pitchDetector
                );
                console.log('🧠 Advanced Musical Intelligence initialized (deferred)');
            }
            
            this.isListening = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            
            // Start playhead recording
            this.playhead.startRecording();
            this.notationRenderer.setRecordingState(true);
            
            this.statusText.textContent = 'Listening for pitch...';
            
            // Start vocal transcription if available
            if (this.vocalTranscriptionEngine) {
                await this.vocalTranscriptionEngine.startVocalTranscription({
                    mode: 'hybrid',
                    language: 'en-US'
                });
            }
            
            // Start vocal coaching session
            if (this.vocalCoach) {
                this.vocalCoach.startCoachingSession();
            }
            
            this.startAnalysisLoop();
            
        } catch (error) {
            console.error('Failed to start listening:', error);
            this.statusText.textContent = `Error: ${error.message}`;
            this.resetButtons();
        }
    }
    
    setupTranscriptionEventListeners() {
        // Listen for vocal transcription events
        document.addEventListener('vocal-transcription-update', (event) => {
            this.handleTranscriptionUpdate(event.detail);
        });
        
        document.addEventListener('vocal-transcription-interim', (event) => {
            this.handleInterimTranscription(event.detail);
        });
        
        document.addEventListener('syllable-alignment-complete', (event) => {
            this.handleAlignmentComplete(event.detail);
        });
        
        console.log('Vocal transcription event listeners established');
    }
    
    handleTranscriptionUpdate(detail) {
        // Handle real-time transcription updates
        if (detail.transcription && detail.transcription.lyrics.length > 0) {
            // Update UI with lyrics - you could add a lyrics display area
            console.log('Transcription update:', detail.transcription.lyrics.map(l => l.word).join(' '));
        }
        
        // Update status with transcription confidence
        if (detail.transcription.confidence > 0) {
            const confidencePercent = Math.round(detail.transcription.confidence * 100);
            this.statusText.textContent = `Transcribing... (${confidencePercent}% confidence)`;
        }
    }
    
    handleInterimTranscription(detail) {
        // Show interim results - could add to UI
        console.log('Interim:', detail.transcript);
    }
    
    handleAlignmentComplete(detail) {
        // Handle completed syllable-to-note alignments
        console.log('Alignment complete:', detail.alignedSyllables?.length || 0, 'syllables aligned');
    }
    
    setupArticulationEventListeners() {
        // Listen for comprehensive articulation analysis results
        document.addEventListener('articulation-analysis-complete', (event) => {
            this.handleArticulationAnalysisComplete(event.detail);
        });
        
        document.addEventListener('realtime-articulation-hints', (event) => {
            this.handleRealtimeArticulationHints(event.detail);
        });
        
        document.addEventListener('articulation-analysis-error', (event) => {
            console.error('Articulation analysis error:', event.detail.error);
        });
        
        console.log('Articulation analysis event listeners established');
    }
    
    handleArticulationAnalysisComplete(detail) {
        // Handle comprehensive articulation analysis completion
        console.log('🎭 Comprehensive articulation analysis complete!');
        console.log('Performance Level:', detail.performanceProfile?.summary?.level);
        console.log('Technical Score:', Math.round((detail.performanceProfile?.technical?.score || 0) * 100) + '%');
        console.log('Musical Score:', Math.round((detail.performanceProfile?.musical?.score || 0) * 100) + '%');
        
        // Update status with performance summary
        if (detail.performanceProfile?.summary) {
            const summary = detail.performanceProfile.summary;
            this.statusText.textContent = `Analysis complete - Level: ${summary.level} (${summary.overallScore}%)`;
        }
        
        // Store results for potential export/display
        this.lastArticulationResults = detail;
    }
    
    handleRealtimeArticulationHints(detail) {
        // Handle real-time articulation coaching hints
        let hints = [];
        if (detail.vibrato) hints.push(detail.vibrato);
        if (detail.breathing) hints.push(detail.breathing);
        if (detail.dynamics) hints.push(detail.dynamics);
        
        if (hints.length > 0) {
            console.log('🎯 Real-time hints:', hints.join(', '));
        }
    }
    
    async stopListening() {
        this.isListening = false;
        
        // Stop playhead recording
        if (this.playhead) {
            this.playhead.stopRecording();
        }
        this.notationRenderer.setRecordingState(false);
        
        // Stop vocal transcription if running
        if (this.vocalTranscriptionEngine) {
            const transcriptionResult = await this.vocalTranscriptionEngine.stopVocalTranscription();
            console.log('🎤 Vocal transcription stopped. Final result:', transcriptionResult);
        }
        
        // Stop vocal coaching session and get summary
        if (this.vocalCoach) {
            const coachingSummary = this.vocalCoach.stopCoachingSession();
            if (coachingSummary) {
                console.log('🎓 Coaching session summary:', coachingSummary);
            }
        }
        
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
        
        // Reset register detector
        if (this.registerDetector) {
            this.registerDetector.reset();
        }
    }
    
    exportPng() {
        this.notationRenderer.exportPng();
    }
    
    exportJson() {
        this.notationRenderer.exportJson();
    }
    
    // Enhanced export methods
    exportMIDI() {
        try {
            this.enhancedExport.exportMIDI();
            this.statusText.textContent = 'MIDI export completed!';
            setTimeout(() => this.statusText.textContent = 'Ready', 2000);
        } catch (error) {
            console.error('MIDI export failed:', error);
            this.statusText.textContent = `MIDI export failed: ${error.message}`;
            setTimeout(() => this.statusText.textContent = 'Ready', 3000);
        }
    }
    
    exportMusicXML() {
        try {
            this.enhancedExport.exportMusicXML();
            this.statusText.textContent = 'MusicXML export completed!';
            setTimeout(() => this.statusText.textContent = 'Ready', 2000);
        } catch (error) {
            console.error('MusicXML export failed:', error);
            this.statusText.textContent = `MusicXML export failed: ${error.message}`;
            setTimeout(() => this.statusText.textContent = 'Ready', 3000);
        }
    }
    
    exportSVG() {
        try {
            this.enhancedExport.exportSVG();
            this.statusText.textContent = 'SVG export completed!';
            setTimeout(() => this.statusText.textContent = 'Ready', 2000);
        } catch (error) {
            console.error('SVG export failed:', error);
            this.statusText.textContent = `SVG export failed: ${error.message}`;
            setTimeout(() => this.statusText.textContent = 'Ready', 3000);
        }
    }
    
    exportPDF() {
        try {
            this.enhancedExport.exportPDF();
            this.statusText.textContent = 'PDF export completed!';
            setTimeout(() => this.statusText.textContent = 'Ready', 2000);
        } catch (error) {
            console.error('PDF export failed:', error);
            this.statusText.textContent = `PDF export failed: ${error.message}`;
            setTimeout(() => this.statusText.textContent = 'Ready', 3000);
        }
    }
    
    exportAll() {
        try {
            this.enhancedExport.exportAll();
            this.statusText.textContent = 'Batch export started! Files will download sequentially...';
            setTimeout(() => this.statusText.textContent = 'Ready', 5000);
        } catch (error) {
            console.error('Batch export failed:', error);
            this.statusText.textContent = `Batch export failed: ${error.message}`;
            setTimeout(() => this.statusText.textContent = 'Ready', 3000);
        }
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
        // Update rhythm quantizer with detected tempo
        this.rhythmQuantizer.setTempo(analysis.tempo);
        
        // Enable real-time quantization mode
        this.realTimeQuantization = true;
        this.pitchDetector.recordingMode = false;
        this.pitchDetector.tempoTracker.setTempo(analysis.tempo);
        
        this.statusText.textContent = `Applied ${Math.round(analysis.tempo)} BPM rhythm - quantization enabled`;
        
        setTimeout(() => {
            this.statusText.textContent = 'Rhythm applied - new notes will be quantized';
        }, 2000);
        
        console.log('Real-time quantization enabled with tempo:', Math.round(analysis.tempo), 'BPM');
    }
    
    setInputMode(mode) {
        this.inputMode = mode;
        
        // Update button states
        this.vocalModeBtn.classList.toggle('active', mode === 'vocal');
        this.instrumentModeBtn.classList.toggle('active', mode === 'instrument');
        
        // Update audio processing settings
        if (this.audioHandler) {
            this.audioHandler.setVocalMode(mode === 'vocal');
            
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
        
        // Trigger vocal notation update when switching to vocal mode
        if (mode === 'vocal' && this.notationRenderer.allNotes.length > 0) {
            this.updateVocalNotation();
        }
        
        console.log(`Input mode set to: ${mode}`);
    }
    
    applyQuantization(noteOnset) {
        // Create a copy of the note to avoid modifying the original
        const quantizedNote = { ...noteOnset };
        
        // Get the last recorded note for duration calculation
        const allNotes = this.notationRenderer.allNotes;
        const lastNote = allNotes[allNotes.length - 1];
        
        if (lastNote && lastNote.timestamp) {
            // Calculate actual duration since last note
            const actualDuration = (noteOnset.timestamp - lastNote.timestamp) / 1000; // Convert to seconds
            
            // Apply quantization to duration
            const quantizedDuration = this.rhythmQuantizer.quantizeDuration(actualDuration);
            
            // Update note with quantized timing
            quantizedNote.quantizedDuration = quantizedDuration.duration;
            quantizedNote.musicalDuration = quantizedDuration.musicalDuration;
            quantizedNote.notationType = quantizedDuration.notationType;
            quantizedNote.quantizationConfidence = quantizedDuration.confidence;
            
            // If we have tempo information, also quantize the onset time
            if (noteOnset.tempo && noteOnset.tempo.beatPhase !== undefined) {
                const quantizedOnset = this.rhythmQuantizer.quantizeOnset(
                    noteOnset.timestamp / 1000, // Convert to seconds
                    lastNote.timestamp / 1000,
                    noteOnset.tempo.beatPhase
                );
                
                if (quantizedOnset.onset) {
                    quantizedNote.quantizedTimestamp = quantizedOnset.onset * 1000; // Convert back to ms
                    quantizedNote.gridAlignment = quantizedOnset;
                }
            }
            
            // Update rhythm quantizer tempo if we have tempo information
            if (noteOnset.tempo && noteOnset.tempo.tempo) {
                this.rhythmQuantizer.setTempo(noteOnset.tempo.tempo);
            }
            
            console.log(`Quantized: ${actualDuration.toFixed(3)}s -> ${quantizedDuration.duration.toFixed(3)}s (${quantizedDuration.notationType})`);
        }
        
        return quantizedNote;
    }
    
    toggleQuantization() {
        this.realTimeQuantization = !this.realTimeQuantization;
        
        // Update button text and state
        if (this.realTimeQuantization) {
            this.quantizeToggleBtn.textContent = 'Disable Quantization';
            this.quantizeToggleBtn.classList.add('active');
            this.statusText.textContent = 'Real-time quantization enabled';
            
            // Set default tempo if not already set
            if (!this.rhythmQuantizer.tempo || this.rhythmQuantizer.tempo === 120) {
                this.rhythmQuantizer.setTempo(120);
            }
        } else {
            this.quantizeToggleBtn.textContent = 'Enable Quantization';
            this.quantizeToggleBtn.classList.remove('active');
            this.statusText.textContent = 'Quantization disabled - free time mode';
        }
        
        console.log('Quantization', this.realTimeQuantization ? 'enabled' : 'disabled');
    }
    
    toggleDebugPanel() {
        this.debugPanel.classList.toggle('hidden');
        
        // Update button state
        if (this.debugPanel.classList.contains('hidden')) {
            this.debugToggle.style.opacity = '0.7';
        } else {
            this.debugToggle.style.opacity = '1';
            this.debugPanel.classList.add('fade-in');
        }
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Error attempting to enable fullscreen:', err.message);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    resetButtons() {
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.quantizeToggleBtn.disabled = false;
    }
    
    startAnalysisLoop(currentTime = performance.now()) {
        if (!this.isListening) return;
        
        // Frame rate limiting for performance
        const deltaTime = currentTime - this.lastFrameTime;
        if (deltaTime < this.frameInterval) {
            requestAnimationFrame((time) => this.startAnalysisLoop(time));
            return;
        }
        
        // Performance monitoring
        const frameStartTime = performance.now();
        this.updatePerformanceStats(frameStartTime, deltaTime);
        
        // Core audio analysis (always runs)
        const noteOnset = this.pitchDetector.detectNoteOnset();
        
        if (noteOnset) {
            // Update UI (can be skipped for performance)
            if (!this.skipNonCriticalUpdates) {
                this.freqDisplay.textContent = noteOnset.frequency.toFixed(1);
                this.noteDisplay.textContent = `${noteOnset.note} (${(noteOnset.confidence * 100).toFixed(0)}%)`;
                this.pitchDisplay.textContent = noteOnset.note;
                this.onsetDisplay.textContent = noteOnset.isNewNote ? 'NEW NOTE!' : (noteOnset.onsetDetected ? 'YES' : 'no');
                this.fluxDisplay.textContent = noteOnset.articulationReason || noteOnset.spectralFlux?.toFixed(3) || '--';
            }
            
            // Display tempo information (can be throttled for performance)
            if (!this.skipNonCriticalUpdates) {
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
            }
            
            // Add note to staff when new note is detected
            if (noteOnset.isNewNote) {
                // Analyze register and potentially change clef
                if (this.registerDetector) {
                    this.registerDetector.analyzeNote(noteOnset);
                }
                
                // Apply rhythm quantization if enabled
                if (this.realTimeQuantization && this.rhythmQuantizer) {
                    const quantizedNote = this.applyQuantization(noteOnset);
                    this.notationRenderer.addNote(quantizedNote);
                } else {
                    // Cadenza mode - no quantization
                    this.notationRenderer.addNote(noteOnset);
                }
                
                // Update vocal notation with latest transcription data
                this.updateVocalNotation();
                
                // Real-time vocal coaching analysis
                this.updateVocalCoaching(noteOnset);
                
                // Advanced musical intelligence analysis
                this.updateMusicalIntelligence(noteOnset);
            }
        } else if (!this.skipNonCriticalUpdates) {
            // Still show current detection for debugging (throttled for performance)
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
        
        // Complete performance monitoring
        this.completePerformanceFrame(frameStartTime);
        this.lastFrameTime = currentTime;
        
        requestAnimationFrame((time) => this.startAnalysisLoop(time));
    }
    
    updatePerformanceStats(frameStartTime, deltaTime) {
        this.performanceStats.frameCount++;
        
        // Log performance stats every 2 seconds
        if (frameStartTime - this.performanceStats.lastStatsTime > 2000) {
            const avgFps = this.performanceStats.frameCount / 2;
            
            // Determine if we should skip non-critical updates
            const targetFps = this.targetFrameRate * 0.8; // 80% of target
            this.skipNonCriticalUpdates = avgFps < targetFps;
            
            if (this.skipNonCriticalUpdates) {
                console.warn(`Performance warning: ${avgFps.toFixed(1)} FPS (target: ${this.targetFrameRate}). Throttling UI updates.`);
            } else {
                console.log(`Performance: ${avgFps.toFixed(1)} FPS, avg frame time: ${this.performanceStats.averageFrameTime.toFixed(2)}ms`);
            }
            
            // Reset stats
            this.performanceStats.frameCount = 0;
            this.performanceStats.lastStatsTime = frameStartTime;
            this.performanceStats.maxFrameTime = 0;
            this.performanceStats.averageFrameTime = 0;
        }
    }
    
    completePerformanceFrame(frameStartTime) {
        const frameTime = performance.now() - frameStartTime;
        
        // Update stats
        this.performanceStats.averageFrameTime = 
            (this.performanceStats.averageFrameTime * (this.performanceStats.frameCount - 1) + frameTime) / 
            this.performanceStats.frameCount;
        
        if (frameTime > this.performanceStats.maxFrameTime) {
            this.performanceStats.maxFrameTime = frameTime;
        }
        
        // Warn about long frames
        const targetFrameTime = this.frameInterval;
        if (frameTime > targetFrameTime * 2) {
            this.performanceStats.dropgedFrames++;
            console.warn(`Long frame detected: ${frameTime.toFixed(2)}ms (target: ${targetFrameTime.toFixed(2)}ms)`);
        }
    }
    
    // Utility method to get current performance info
    getPerformanceInfo() {
        return {
            ...this.performanceStats,
            targetFrameRate: this.targetFrameRate,
            skipNonCriticalUpdates: this.skipNonCriticalUpdates,
            actualFrameRate: this.performanceStats.frameCount / 2
        };
    }
    
    /**
     * Session Manager Integration
     */
    
    initializeSessionManager() {
        this.sessionManager = new SessionManager(this);
        this.bindModalEvents();
        console.log('Session manager initialized');
    }
    
    bindModalEvents() {
        // Auth modal events
        const authModal = document.getElementById('authModal');
        const sessionModal = document.getElementById('sessionModal');
        
        // Modal close events
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal);
            });
        });
        
        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });
        
        // Auth tab switching
        document.getElementById('loginTab').addEventListener('click', () => this.switchAuthTab('login'));
        document.getElementById('registerTab').addEventListener('click', () => this.switchAuthTab('register'));
        
        // Session tab switching
        document.getElementById('saveTab').addEventListener('click', () => this.switchSessionTab('save'));
        document.getElementById('loadTab').addEventListener('click', () => this.switchSessionTab('load'));
        
        // Auth form submission
        document.getElementById('authForm').addEventListener('submit', (e) => this.handleAuthSubmit(e));
        document.getElementById('authCancelBtn').addEventListener('click', () => this.closeModal(authModal));
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        
        // Session form submission
        document.getElementById('saveSessionForm').addEventListener('submit', (e) => this.handleSaveSession(e));
    }
    
    showAuthModal() {
        const modal = document.getElementById('authModal');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (this.sessionManager.user) {
            // User is logged in, show logout option
            logoutBtn.style.display = 'inline-block';
            document.getElementById('authSubmitBtn').style.display = 'none';
        } else {
            // Show login form
            logoutBtn.style.display = 'none';
            document.getElementById('authSubmitBtn').style.display = 'inline-block';
        }
        
        this.showModal(modal);
    }
    
    showSessionModal(tab = 'save') {
        const modal = document.getElementById('sessionModal');
        this.showModal(modal);
        this.switchSessionTab(tab);
        
        if (tab === 'load') {
            this.loadSessionList();
        }
    }
    
    showModal(modal) {
        modal.style.display = 'block';
        modal.setAttribute('aria-hidden', 'false');
        // Focus first input
        const firstInput = modal.querySelector('input');
        if (firstInput) firstInput.focus();
    }
    
    closeModal(modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    
    switchAuthTab(tab) {
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        const usernameGroup = document.getElementById('usernameGroup');
        const submitBtn = document.getElementById('authSubmitBtn');
        
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            usernameGroup.style.display = 'none';
            submitBtn.textContent = 'Login';
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            usernameGroup.style.display = 'block';
            submitBtn.textContent = 'Register';
        }
    }
    
    switchSessionTab(tab) {
        const saveTab = document.getElementById('saveTab');
        const loadTab = document.getElementById('loadTab');
        const saveTabContent = document.getElementById('saveSessionTab');
        const loadTabContent = document.getElementById('loadSessionTab');
        
        if (tab === 'save') {
            saveTab.classList.add('active');
            loadTab.classList.remove('active');
            saveTabContent.style.display = 'block';
            loadTabContent.style.display = 'none';
        } else {
            loadTab.classList.add('active');
            saveTab.classList.remove('active');
            loadTabContent.style.display = 'block';
            saveTabContent.style.display = 'none';
        }
    }
    
    async handleAuthSubmit(e) {
        e.preventDefault();
        
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const username = document.getElementById('authUsername').value;
        const isRegister = document.getElementById('registerTab').classList.contains('active');
        
        try {
            let result;
            if (isRegister) {
                result = await this.sessionManager.registerUser(email, password, username);
            } else {
                result = await this.sessionManager.loginUser(email, password);
            }
            
            if (result.success) {
                this.closeModal(document.getElementById('authModal'));
                this.showNotification(`${isRegister ? 'Registration' : 'Login'} successful!`, 'success');
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.showNotification('Authentication failed', 'error');
        }
    }
    
    async handleLogout() {
        try {
            await this.sessionManager.logout();
            this.closeModal(document.getElementById('authModal'));
            this.showNotification('Logged out successfully', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Logout failed', 'error');
        }
    }
    
    async handleSaveSession(e) {
        e.preventDefault();
        
        const name = document.getElementById('sessionName').value;
        const description = document.getElementById('sessionDescription').value;
        
        try {
            const result = await this.sessionManager.saveSession(
                this.sessionManager.getCurrentSessionData(),
                name,
                description
            );
            
            if (result.success) {
                this.closeModal(document.getElementById('sessionModal'));
                const message = result.offline ? 'Session saved offline' : 'Session saved successfully';
                this.showNotification(message, 'success');
            } else {
                this.showNotification(result.error || 'Failed to save session', 'error');
            }
        } catch (error) {
            console.error('Save session error:', error);
            this.showNotification('Failed to save session', 'error');
        }
    }
    
    async loadSessionList() {
        const container = document.getElementById('sessionListContainer');
        container.innerHTML = '<div class="loading">Loading sessions...</div>';
        
        try {
            const result = await this.sessionManager.listSessions();
            
            if (result.success) {
                this.renderSessionList(result.sessions, result.offline);
            } else {
                container.innerHTML = `<div class="error">Failed to load sessions: ${result.error}</div>`;
            }
        } catch (error) {
            console.error('Load sessions error:', error);
            container.innerHTML = '<div class="error">Failed to load sessions</div>';
        }
    }
    
    renderSessionList(sessions, offline = false) {
        const container = document.getElementById('sessionListContainer');
        
        if (sessions.length === 0) {
            container.innerHTML = '<div class="empty">No sessions found</div>';
            return;
        }
        
        const html = sessions.map(session => `
            <div class="session-item" data-session-id="${session.sessionId}">
                <div class="session-info">
                    <h4>${session.name}</h4>
                    <p class="session-meta">
                        Created: ${new Date(session.createdAt).toLocaleDateString()}
                        ${offline ? ' (Offline)' : ''}
                    </p>
                </div>
                <div class="session-actions">
                    <button class="load-session-btn primary-btn" data-session-id="${session.sessionId}">
                        Load
                    </button>
                    <button class="delete-session-btn secondary-btn" data-session-id="${session.sessionId}">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
        
        // Bind load and delete events
        container.querySelectorAll('.load-session-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleLoadSession(e.target.dataset.sessionId));
        });
        
        container.querySelectorAll('.delete-session-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleDeleteSession(e.target.dataset.sessionId));
        });
    }
    
    async handleLoadSession(sessionId) {
        try {
            const result = await this.sessionManager.loadSession(sessionId);
            
            if (result.success) {
                // Apply loaded session data
                this.applySessionData(result.data);
                this.closeModal(document.getElementById('sessionModal'));
                const message = result.offline ? 'Session loaded from offline storage' : 'Session loaded successfully';
                this.showNotification(message, 'success');
            } else {
                this.showNotification(result.error || 'Failed to load session', 'error');
            }
        } catch (error) {
            console.error('Load session error:', error);
            this.showNotification('Failed to load session', 'error');
        }
    }
    
    async handleDeleteSession(sessionId) {
        if (!confirm('Are you sure you want to delete this session?')) {
            return;
        }
        
        try {
            const result = await this.sessionManager.deleteSession(sessionId);
            
            if (result.success) {
                this.showNotification('Session deleted successfully', 'success');
                this.loadSessionList(); // Refresh the list
            } else {
                this.showNotification(result.error || 'Failed to delete session', 'error');
            }
        } catch (error) {
            console.error('Delete session error:', error);
            this.showNotification('Failed to delete session', 'error');
        }
    }
    
    applySessionData(sessionData) {
        // Clear current notation
        this.clearNotation();
        
        // Apply configuration if available
        if (sessionData.configuration) {
            if (sessionData.configuration.staff && this.staffConfig) {
                this.staffConfig.updateConfiguration(sessionData.configuration.staff);
            }
            if (sessionData.configuration.audio && this.audioConfig) {
                this.audioConfig.updateConfiguration(sessionData.configuration.audio);
            }
        }
        
        // Apply notation data
        if (sessionData.notation && sessionData.notation.notes) {
            // Add notes to notation renderer
            sessionData.notation.notes.forEach(note => {
                this.notationRenderer.addNote(note);
            });
            
            console.log(`Loaded session with ${sessionData.notation.notes.length} notes`);
        }
    }
    
    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WhistleApp();
});