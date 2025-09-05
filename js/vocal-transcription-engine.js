/**
 * Vocal Transcription Engine
 * Master orchestrator combining STT, phoneme detection, and forensic analysis
 * The world's first comprehensive web-based vocal-to-MIDI transcription system
 */

class VocalTranscriptionEngine {
    constructor(audioHandler, forensicAnalyzer) {
        this.audioHandler = audioHandler;
        this.forensicAnalyzer = forensicAnalyzer;
        
        // Initialize sub-systems
        this.vocalSTT = new VocalSTTEngine(audioHandler);
        this.syllableAligner = new SyllableNoteAligner(forensicAnalyzer);
        this.offlinePhonemeDetector = new OfflinePhonemeDetector(forensicAnalyzer);
        
        // Transcription state
        this.isTranscribing = false;
        this.transcriptionMode = 'hybrid'; // 'online', 'offline', 'hybrid'
        this.currentLanguage = 'en-US';
        
        // Integration buffers
        this.audioBuffer = [];
        this.pitchBuffer = [];
        this.transcriptionBuffer = [];
        this.alignmentBuffer = [];
        
        // Processing parameters
        this.processingConfig = {
            bufferDuration: 5.0, // seconds
            overlapDuration: 1.0, // seconds
            confidenceThreshold: 0.5,
            alignment: {
                enableRealTime: true,
                maxLatency: 0.5, // seconds
                minSegmentDuration: 0.1 // seconds
            },
            export: {
                includeLyrics: true,
                includePhonemes: true,
                includeAlignmentData: true,
                midiExportFormat: 'standard' // 'standard', 'mpe', 'extended'
            }
        };
        
        // Performance monitoring
        this.performanceMetrics = {
            processingLatency: 0,
            alignmentAccuracy: 0,
            transcriptionConfidence: 0,
            totalProcessingTime: 0,
            framesProcessed: 0
        };
        
        // Event listeners
        this.setupEventListeners();
        
        console.log('Vocal Transcription Engine initialized - Ready for revolutionary vocal analysis!');
    }
    
    setupEventListeners() {
        // Listen for syllable alignment requests from STT engine
        document.addEventListener('syllable-alignment-needed', (event) => {
            this.handleSyllableAlignmentRequest(event.detail);
        });
        
        // Listen for interim transcription results
        document.addEventListener('interim-transcript', (event) => {
            this.handleInterimTranscript(event.detail);
        });
        
        // Listen for forensic analysis updates
        document.addEventListener('forensic-analysis-update', (event) => {
            this.handleForensicUpdate(event.detail);
        });
    }
    
    async startVocalTranscription(options = {}) {
        if (this.isTranscribing) {
            console.warn('Transcription already in progress');
            return;
        }
        
        console.log('Starting revolutionary vocal transcription...');
        this.isTranscribing = true;
        
        // Configure transcription parameters
        this.transcriptionMode = options.mode || this.transcriptionMode;
        this.currentLanguage = options.language || this.currentLanguage;
        
        // Start forensic analysis
        if (this.forensicAnalyzer && !this.forensicAnalyzer.isAnalyzing) {
            await this.forensicAnalyzer.startAnalysis();
        }
        
        // Start appropriate speech recognition mode
        if (this.transcriptionMode === 'online' || this.transcriptionMode === 'hybrid') {
            try {
                this.vocalSTT.setLanguage(this.currentLanguage);
                this.vocalSTT.startRecognition();
                console.log('Online speech recognition started');
            } catch (error) {
                console.warn('Online STT failed, falling back to offline mode:', error);
                this.transcriptionMode = 'offline';
            }
        }
        
        // Initialize processing loop
        this.startProcessingLoop();
        
        // Dispatch start event
        const startEvent = new CustomEvent('vocal-transcription-started', {
            detail: {
                mode: this.transcriptionMode,
                language: this.currentLanguage,
                timestamp: performance.now()
            }
        });
        document.dispatchEvent(startEvent);
    }
    
    async stopVocalTranscription() {
        if (!this.isTranscribing) return;
        
        console.log('Stopping vocal transcription...');
        this.isTranscribing = false;
        
        // Stop sub-systems
        this.vocalSTT.stopRecognition();
        
        if (this.forensicAnalyzer && this.forensicAnalyzer.isAnalyzing) {
            this.forensicAnalyzer.stopAnalysis();
        }
        
        // Process final buffers
        await this.processRemainingBuffers();
        
        // Generate final transcription result
        const finalResult = await this.generateFinalTranscription();
        
        // Dispatch completion event
        const stopEvent = new CustomEvent('vocal-transcription-stopped', {
            detail: {
                result: finalResult,
                metrics: this.performanceMetrics,
                timestamp: performance.now()
            }
        });
        document.dispatchEvent(stopEvent);
        
        return finalResult;
    }
    
    startProcessingLoop() {
        // Real-time processing loop for continuous transcription
        if (!this.isTranscribing) return;
        
        this.processCurrentBuffers()
            .then(() => {
                // Continue loop
                if (this.isTranscribing) {
                    setTimeout(() => this.startProcessingLoop(), 100); // 10 FPS processing
                }
            })
            .catch(error => {
                console.error('Processing loop error:', error);
                if (this.isTranscribing) {
                    setTimeout(() => this.startProcessingLoop(), 500); // Slower retry on error
                }
            });
    }
    
    async processCurrentBuffers() {
        const startTime = performance.now();
        
        // Get current audio data from forensic analyzer
        const currentForensicData = this.forensicAnalyzer?.getCurrentAnalysis();
        if (!currentForensicData) return;
        
        // Extract pitch events for alignment
        const pitchEvents = this.extractPitchEvents(currentForensicData);
        
        // Get current transcription state
        const sttResult = this.vocalSTT.getCurrentTranscriptionState(pitchEvents);
        
        // Perform alignment if we have both lyrics and pitch data
        if (sttResult.lyrics.length > 0 && pitchEvents.length > 0) {
            await this.performRealtimeAlignment(sttResult, pitchEvents, currentForensicData);
        }
        
        // Update performance metrics
        this.performanceMetrics.processingLatency = performance.now() - startTime;
        this.performanceMetrics.framesProcessed++;
        this.performanceMetrics.totalProcessingTime += this.performanceMetrics.processingLatency;
        
        // Emit real-time update
        this.emitRealtimeUpdate(sttResult, pitchEvents, currentForensicData);
    }
    
    extractPitchEvents(forensicData) {
        if (!forensicData || !forensicData.analysis) return [];
        
        return forensicData.analysis.map(frame => ({
            timestamp: frame.timestamp,
            frequency: frame.pitch.fundamental,
            confidence: frame.pitch.confidence,
            note: this.frequencyToNote(frame.pitch.fundamental),
            dynamics: frame.dynamics,
            articulation: frame.articulation,
            vibrato: frame.vibrato
        }));
    }
    
    frequencyToNote(frequency) {
        if (frequency <= 0) return null;
        
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75);
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        if (frequency > C0) {
            const h = Math.round(12 * Math.log2(frequency / C0));
            const octave = Math.floor(h / 12);
            const n = h % 12;
            return {
                name: noteNames[n],
                octave: octave,
                midi: h + 12,
                cents: Math.round(1200 * (Math.log2(frequency / C0) - h / 12))
            };
        }
        return null;
    }
    
    async performRealtimeAlignment(sttResult, pitchEvents, forensicData) {
        try {
            // Extract syllables from STT result
            const syllables = this.extractSyllablesFromSTT(sttResult);
            
            // Perform alignment
            const alignmentResult = await this.syllableAligner.alignSyllablesToNotes(
                syllables, pitchEvents, forensicData
            );
            
            // Update alignment buffer
            this.alignmentBuffer.push({
                timestamp: performance.now(),
                alignment: alignmentResult,
                sttResult,
                pitchEvents
            });
            
            // Update metrics
            this.performanceMetrics.alignmentAccuracy = alignmentResult.confidence;
            this.performanceMetrics.transcriptionConfidence = sttResult.confidence;
            
        } catch (error) {
            console.error('Real-time alignment failed:', error);
        }
    }
    
    extractSyllablesFromSTT(sttResult) {
        const syllables = [];
        
        sttResult.lyrics.forEach((word, wordIndex) => {
            if (word.syllables && word.syllables.length > 0) {
                word.syllables.forEach((syllableText, syllableIndex) => {
                    syllables.push({
                        text: syllableText,
                        word: word.word,
                        wordIndex,
                        syllableIndex,
                        estimatedStartTime: 0, // Will be calculated by aligner
                        estimatedDuration: word.estimated_duration ? 
                            word.estimated_duration / word.syllables.length : 0.5,
                        confidence: word.confidence || 0.5
                    });
                });
            } else {
                // Fallback: treat whole word as single syllable
                syllables.push({
                    text: word.word,
                    word: word.word,
                    wordIndex,
                    syllableIndex: 0,
                    estimatedStartTime: 0,
                    estimatedDuration: word.estimated_duration || 0.5,
                    confidence: word.confidence || 0.5
                });
            }
        });
        
        return syllables;
    }
    
    emitRealtimeUpdate(sttResult, pitchEvents, forensicData) {
        const updateEvent = new CustomEvent('vocal-transcription-update', {
            detail: {
                transcription: {
                    lyrics: sttResult.lyrics,
                    language: sttResult.language,
                    confidence: sttResult.confidence,
                    status: sttResult.status
                },
                musical: {
                    pitchEvents,
                    currentNote: pitchEvents.length > 0 ? pitchEvents[pitchEvents.length - 1].note : null,
                    dynamics: forensicData?.dynamics,
                    articulation: forensicData?.articulation
                },
                alignment: this.alignmentBuffer.length > 0 ? 
                    this.alignmentBuffer[this.alignmentBuffer.length - 1].alignment : null,
                metrics: this.performanceMetrics,
                timestamp: performance.now()
            }
        });
        document.dispatchEvent(updateEvent);
    }
    
    async handleSyllableAlignmentRequest(detail) {
        // Handle alignment requests from STT engine
        try {
            const currentForensicData = this.forensicAnalyzer?.getCurrentAnalysis();
            if (!currentForensicData) return;
            
            const pitchEvents = this.extractPitchEvents(currentForensicData);
            
            const alignmentResult = await this.syllableAligner.alignSyllablesToNotes(
                detail.syllables, pitchEvents, currentForensicData
            );
            
            // Emit alignment result
            const alignmentEvent = new CustomEvent('syllable-alignment-complete', {
                detail: alignmentResult
            });
            document.dispatchEvent(alignmentEvent);
            
        } catch (error) {
            console.error('Syllable alignment request failed:', error);
        }
    }
    
    handleInterimTranscript(detail) {
        // Handle interim transcription results for real-time feedback
        const interimEvent = new CustomEvent('vocal-transcription-interim', {
            detail: {
                transcript: detail.transcript,
                confidence: detail.confidence,
                timestamp: detail.timestamp
            }
        });
        document.dispatchEvent(interimEvent);
    }
    
    handleForensicUpdate(detail) {
        // Process forensic analysis updates
        if (detail.analysis && this.transcriptionMode === 'offline') {
            // Use offline phoneme detection for privacy mode
            this.processOfflineTranscription(detail.analysis);
        }
    }
    
    async processOfflineTranscription(forensicData) {
        try {
            // Extract audio buffer from forensic data
            const audioBuffer = this.reconstructAudioFromForensic(forensicData);
            const pitchEvents = this.extractPitchEvents(forensicData);
            
            // Perform offline phoneme detection
            const phonemeResult = await this.offlinePhonemeDetector.detectPhonemesFromAudio(
                audioBuffer, pitchEvents
            );
            
            // Convert phonemes to syllables and words
            const linguisticResult = this.convertPhonemesToLinguisticStructure(phonemeResult);
            
            // Emit offline transcription result
            const offlineEvent = new CustomEvent('offline-transcription-result', {
                detail: {
                    phonemes: phonemeResult.phonemes,
                    syllables: linguisticResult.syllables,
                    words: linguisticResult.words,
                    confidence: phonemeResult.confidence,
                    method: 'offline_phoneme_detection'
                }
            });
            document.dispatchEvent(offlineEvent);
            
        } catch (error) {
            console.error('Offline transcription processing failed:', error);
        }
    }
    
    reconstructAudioFromForensic(forensicData) {
        // This is a placeholder - in practice, we'd need the original audio
        // For now, return a dummy buffer
        return new Float32Array(44100); // 1 second of silence
    }
    
    convertPhonemesToLinguisticStructure(phonemeResult) {
        // Convert detected phonemes to a more linguistic structure
        return {
            syllables: phonemeResult.syllables || [],
            words: phonemeResult.words || []
        };
    }
    
    async processRemainingBuffers() {
        // Process any remaining data in buffers before stopping
        if (this.transcriptionBuffer.length > 0 || this.alignmentBuffer.length > 0) {
            console.log('Processing remaining buffers...');
            await this.processCurrentBuffers();
        }
    }
    
    async generateFinalTranscription() {
        // Generate comprehensive final transcription result
        const finalResult = {
            metadata: {
                language: this.currentLanguage,
                mode: this.transcriptionMode,
                duration: this.performanceMetrics.totalProcessingTime / 1000, // seconds
                processingTime: this.performanceMetrics.totalProcessingTime,
                confidence: this.performanceMetrics.transcriptionConfidence,
                alignmentAccuracy: this.performanceMetrics.alignmentAccuracy
            },
            
            transcription: {
                lyrics: this.consolidateLyrics(),
                syllables: this.consolidateSyllables(),
                phonemes: this.transcriptionMode === 'offline' ? this.consolidatePhonemes() : null
            },
            
            musical: {
                notes: this.consolidateNotes(),
                timing: this.consolidateTiming(),
                dynamics: this.consolidateDynamics(),
                articulations: this.consolidateArticulations()
            },
            
            alignment: {
                syllableToNoteMapping: this.consolidateAlignment(),
                confidence: this.performanceMetrics.alignmentAccuracy,
                warnings: this.generateAlignmentWarnings()
            },
            
            export: {
                midiData: await this.generateMIDIExport(),
                musicXML: this.processingConfig.export.includeAlignmentData ? 
                    await this.generateMusicXMLExport() : null,
                json: this.generateJSONExport()
            }
        };
        
        return finalResult;
    }
    
    consolidateLyrics() {
        // Consolidate lyrics from all alignment buffer entries
        const allLyrics = [];
        
        this.alignmentBuffer.forEach(entry => {
            if (entry.sttResult && entry.sttResult.lyrics) {
                entry.sttResult.lyrics.forEach(word => {
                    allLyrics.push({
                        word: word.word,
                        confidence: word.confidence,
                        timing: word.timing || null
                    });
                });
            }
        });
        
        return allLyrics;
    }
    
    consolidateSyllables() {
        // Consolidate syllable data with timing information
        const allSyllables = [];
        
        this.alignmentBuffer.forEach(entry => {
            if (entry.alignment && entry.alignment.alignedSyllables) {
                entry.alignment.alignedSyllables.forEach(alignedSyllable => {
                    allSyllables.push({
                        text: alignedSyllable.syllable.text,
                        startTime: alignedSyllable.timing.startTime,
                        endTime: alignedSyllable.timing.endTime,
                        duration: alignedSyllable.timing.duration,
                        noteEvents: alignedSyllable.noteEvents.map(note => ({
                            frequency: note.frequency,
                            note: note.note,
                            timestamp: note.timestamp
                        })),
                        confidence: alignedSyllable.confidence,
                        alignmentType: alignedSyllable.alignmentType
                    });
                });
            }
        });
        
        return allSyllables;
    }
    
    consolidatePhonemes() {
        // For offline mode - consolidate phoneme detection results
        // This would be populated by offline processing
        return [];
    }
    
    consolidateNotes() {
        // Extract all musical notes with complete information
        const allNotes = [];
        
        this.alignmentBuffer.forEach(entry => {
            if (entry.pitchEvents) {
                entry.pitchEvents.forEach(pitchEvent => {
                    if (pitchEvent.note) {
                        allNotes.push({
                            ...pitchEvent.note,
                            timestamp: pitchEvent.timestamp,
                            frequency: pitchEvent.frequency,
                            confidence: pitchEvent.confidence,
                            dynamics: pitchEvent.dynamics,
                            articulation: pitchEvent.articulation,
                            vibrato: pitchEvent.vibrato
                        });
                    }
                });
            }
        });
        
        return allNotes;
    }
    
    consolidateTiming() {
        // Extract timing information for the entire performance
        const timing = {
            totalDuration: 0,
            noteOnsets: [],
            rhythmicPatterns: [],
            tempoVariations: []
        };
        
        const allNotes = this.consolidateNotes();
        if (allNotes.length > 0) {
            timing.totalDuration = Math.max(...allNotes.map(n => n.timestamp)) - Math.min(...allNotes.map(n => n.timestamp));
            timing.noteOnsets = allNotes.map(n => n.timestamp).sort((a, b) => a - b);
        }
        
        return timing;
    }
    
    consolidateDynamics() {
        // Extract dynamics information
        return this.alignmentBuffer.map(entry => {
            if (entry.pitchEvents) {
                return entry.pitchEvents.map(pe => pe.dynamics).filter(d => d);
            }
            return [];
        }).flat();
    }
    
    consolidateArticulations() {
        // Extract articulation information
        return this.alignmentBuffer.map(entry => {
            if (entry.pitchEvents) {
                return entry.pitchEvents.map(pe => pe.articulation).filter(a => a);
            }
            return [];
        }).flat();
    }
    
    consolidateAlignment() {
        // Create final syllable-to-note mapping
        const mapping = [];
        
        this.alignmentBuffer.forEach(entry => {
            if (entry.alignment && entry.alignment.alignedSyllables) {
                entry.alignment.alignedSyllables.forEach(aligned => {
                    mapping.push({
                        syllable: aligned.syllable.text,
                        notes: aligned.noteEvents.map(note => ({
                            frequency: note.frequency,
                            note: note.note?.name + note.note?.octave,
                            timestamp: note.timestamp
                        })),
                        timing: aligned.timing,
                        confidence: aligned.confidence
                    });
                });
            }
        });
        
        return mapping;
    }
    
    generateAlignmentWarnings() {
        // Generate warnings about alignment quality
        const warnings = [];
        
        if (this.performanceMetrics.alignmentAccuracy < 0.6) {
            warnings.push('Low alignment accuracy detected - manual review recommended');
        }
        
        if (this.performanceMetrics.transcriptionConfidence < 0.5) {
            warnings.push('Low transcription confidence - audio quality may be poor');
        }
        
        return warnings;
    }
    
    async generateMIDIExport() {
        // Generate MIDI data from consolidated musical information
        const notes = this.consolidateNotes();
        const syllables = this.consolidateSyllables();
        
        if (!notes || notes.length === 0) return null;
        
        // This would integrate with the existing MIDI export system
        // For now, return a structured representation
        return {
            tracks: [
                {
                    name: 'Vocal Transcription',
                    notes: notes.map(note => ({
                        pitch: note.midi,
                        velocity: note.dynamics?.velocity || 64,
                        startTime: note.timestamp,
                        duration: 0.5, // Default duration - would be calculated from note end
                        lyrics: this.findLyricsForNote(note, syllables)
                    })),
                    controlChanges: this.generateControlChanges(notes)
                }
            ],
            format: this.processingConfig.export.midiExportFormat,
            includesLyrics: this.processingConfig.export.includeLyrics
        };
    }
    
    findLyricsForNote(note, syllables) {
        // Find syllable text corresponding to this note
        const matchingSyllable = syllables.find(syl => 
            syl.startTime <= note.timestamp && note.timestamp <= syl.endTime
        );
        return matchingSyllable ? matchingSyllable.text : null;
    }
    
    generateControlChanges(notes) {
        // Generate MIDI control changes for dynamics, vibrato, etc.
        const controlChanges = [];
        
        notes.forEach(note => {
            if (note.dynamics) {
                controlChanges.push({
                    time: note.timestamp,
                    controller: 1, // Modulation
                    value: Math.round(note.dynamics.intensity * 127)
                });
            }
            
            if (note.vibrato && note.vibrato.present) {
                controlChanges.push({
                    time: note.timestamp,
                    controller: 76, // Vibrato rate
                    value: Math.round(note.vibrato.rate * 127 / 10) // Normalize to MIDI range
                });
            }
        });
        
        return controlChanges;
    }
    
    async generateMusicXMLExport() {
        // Generate MusicXML with lyrics and articulations
        // This would be a comprehensive export including all transcription data
        return {
            format: 'musicxml',
            includesLyrics: true,
            includesArticulations: true,
            confidence: this.performanceMetrics.alignmentAccuracy
        };
    }
    
    generateJSONExport() {
        // Generate complete JSON export of all transcription data
        return {
            transcription: this.consolidateLyrics(),
            musical: {
                notes: this.consolidateNotes(),
                timing: this.consolidateTiming()
            },
            alignment: this.consolidateAlignment(),
            metadata: {
                processingTime: this.performanceMetrics.totalProcessingTime,
                confidence: this.performanceMetrics.transcriptionConfidence,
                mode: this.transcriptionMode,
                language: this.currentLanguage
            }
        };
    }
    
    // Public API methods
    
    setTranscriptionMode(mode) {
        if (['online', 'offline', 'hybrid'].includes(mode)) {
            this.transcriptionMode = mode;
            console.log(`Transcription mode set to: ${mode}`);
        }
    }
    
    setLanguage(language) {
        this.currentLanguage = language;
        if (this.vocalSTT) {
            this.vocalSTT.setLanguage(language);
        }
    }
    
    getStatus() {
        return {
            isTranscribing: this.isTranscribing,
            mode: this.transcriptionMode,
            language: this.currentLanguage,
            metrics: this.performanceMetrics,
            bufferStatus: {
                transcription: this.transcriptionBuffer.length,
                alignment: this.alignmentBuffer.length
            }
        };
    }
    
    clearBuffers() {
        this.transcriptionBuffer = [];
        this.alignmentBuffer = [];
        this.audioBuffer = [];
        this.pitchBuffer = [];
        
        if (this.vocalSTT) {
            this.vocalSTT.clearBuffer();
        }
    }
}