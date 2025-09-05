/**
 * Articulation-Transcription Integration System
 * Connects Phase 3 articulation analysis with the vocal transcription pipeline
 * Provides comprehensive performance analysis and enhanced notation output
 */

class ArticulationTranscriptionIntegration {
    constructor(vocalTranscriptionEngine, forensicIntegration) {
        this.vocalTranscriptionEngine = vocalTranscriptionEngine;
        this.forensicIntegration = forensicIntegration;
        
        // Initialize the master vocal expression classifier
        this.expressionClassifier = new VocalExpressionClassifier();
        
        // Integration state
        this.articulationAnalysisResults = null;
        this.enhancedTranscriptionData = null;
        this.performanceProfile = null;
        
        // Real-time analysis buffers
        this.articulationBuffer = [];
        this.analysisHistory = [];
        
        // Setup event listeners for transcription events
        this.setupTranscriptionEventListeners();
        
        console.log('🎼 Articulation-Transcription Integration System initialized');
    }
    
    setupTranscriptionEventListeners() {
        // Listen for transcription completion to trigger articulation analysis
        document.addEventListener('vocal-transcription-stopped', async (event) => {
            await this.handleTranscriptionComplete(event.detail);
        });
        
        // Listen for real-time transcription updates
        document.addEventListener('vocal-transcription-update', (event) => {
            this.handleRealtimeTranscriptionUpdate(event.detail);
        });
        
        // Listen for forensic analysis updates
        document.addEventListener('forensic-analysis-complete', (event) => {
            this.handleForensicAnalysisUpdate(event.detail);
        });
        
        console.log('Articulation integration event listeners established');
    }
    
    async handleTranscriptionComplete(transcriptionResult) {
        console.log('🎭 Processing complete transcription for articulation analysis...');
        
        try {
            // Extract necessary data from transcription result
            const noteEvents = this.extractNoteEvents(transcriptionResult);
            const transcriptionData = this.extractTranscriptionData(transcriptionResult);
            const forensicData = this.getForensicData();
            
            if (!noteEvents || noteEvents.length < 3) {
                console.warn('Insufficient note events for articulation analysis');
                return;
            }
            
            // Perform comprehensive articulation analysis
            const articulationResults = await this.performComprehensiveAnalysis(
                forensicData,
                noteEvents,
                transcriptionData
            );
            
            // Store results
            this.articulationAnalysisResults = articulationResults;
            
            // Generate enhanced transcription with articulation data
            this.enhancedTranscriptionData = await this.generateEnhancedTranscription(
                transcriptionResult,
                articulationResults
            );
            
            // Create performance profile
            this.performanceProfile = this.createPerformanceProfile(articulationResults);
            
            // Emit comprehensive analysis complete event
            this.emitArticulationAnalysisComplete();
            
        } catch (error) {
            console.error('Error in articulation analysis:', error);
            this.emitAnalysisError(error);
        }
    }
    
    async performComprehensiveAnalysis(forensicData, noteEvents, transcriptionData) {
        console.log('Running comprehensive vocal expression analysis...');
        
        // Use the master expression classifier for complete analysis
        const articulationResults = await this.expressionClassifier.analyzeVocalExpression(
            forensicData,
            noteEvents,
            transcriptionData
        );
        
        return articulationResults;
    }
    
    async generateEnhancedTranscription(originalTranscription, articulationResults) {
        console.log('Generating enhanced transcription with articulation data...');
        
        const enhanced = {
            ...originalTranscription,
            articulation: {
                // Expression analysis results
                overall: articulationResults.overallAssessment,
                technical: articulationResults.technicalAssessment,
                musical: articulationResults.musicalAssessment,
                character: articulationResults.performanceCharacter,
                
                // Detailed articulation annotations
                annotations: this.generateNotationAnnotations(articulationResults),
                
                // Performance coaching data
                coaching: this.generateCoachingData(articulationResults),
                
                // Enhanced MIDI data with expression
                enhancedMIDI: await this.generateEnhancedMIDI(originalTranscription, articulationResults)
            }
        };
        
        return enhanced;
    }
    
    generateNotationAnnotations(articulationResults) {
        const annotations = {
            dynamics: [],
            articulations: [],
            expressions: [],
            breaths: [],
            phrasing: []
        };
        
        // Extract dynamic markings
        if (articulationResults.componentAnalyses.dynamics?.notationMappings) {
            annotations.dynamics = articulationResults.componentAnalyses.dynamics.notationMappings.dynamicMarkings;
            annotations.articulations = articulationResults.componentAnalyses.dynamics.notationMappings.accentMarkings;
        }
        
        // Extract crescendo/diminuendo markings
        if (articulationResults.componentAnalyses.crescendo?.notationMappings) {
            annotations.expressions = [
                ...articulationResults.componentAnalyses.crescendo.notationMappings.crescendoMarkings,
                ...articulationResults.componentAnalyses.crescendo.notationMappings.diminuendoMarkings
            ];
        }
        
        // Extract breath markings
        if (articulationResults.componentAnalyses.breathing?.detectedBreaths) {
            annotations.breaths = articulationResults.componentAnalyses.breathing.detectedBreaths.map(breath => ({
                timestamp: breath.startTime,
                type: 'breath_mark',
                symbol: ',',
                quality: breath.classification?.quality || 'adequate'
            }));
        }
        
        // Extract phrasing from connections
        if (articulationResults.componentAnalyses.connections?.patterns) {
            annotations.phrasing = articulationResults.componentAnalyses.connections.patterns
                .filter(pattern => pattern.type === 'legato_phrase')
                .map(phrase => ({
                    startTime: phrase.startIndex,
                    endTime: phrase.endIndex,
                    type: 'slur',
                    length: phrase.length
                }));
        }
        
        return annotations;
    }
    
    generateCoachingData(articulationResults) {
        return {
            overallLevel: articulationResults.overallAssessment.level,
            strengths: articulationResults.overallAssessment.keyStrengths,
            developmentAreas: articulationResults.overallAssessment.developmentAreas,
            specificFeedback: {
                vibrato: this.generateVibratoFeedback(articulationResults.componentAnalyses.vibrato),
                breathing: this.generateBreathingFeedback(articulationResults.componentAnalyses.breathing),
                articulation: this.generateArticulationFeedback(articulationResults.componentAnalyses.connections),
                dynamics: this.generateDynamicsFeedback(articulationResults.componentAnalyses.dynamics),
                timing: this.generateTimingFeedback(articulationResults.componentAnalyses.rubato)
            },
            priorityRecommendations: articulationResults.recommendations.priority.slice(0, 3),
            practiceExercises: this.generatePracticeExercises(articulationResults)
        };
    }
    
    async generateEnhancedMIDI(originalTranscription, articulationResults) {
        console.log('Generating enhanced MIDI with articulation expression...');
        
        const enhancedMIDI = {
            ...originalTranscription.export?.midiData,
            expressionData: {
                // Vibrato modulation
                vibrato: this.generateVibratoMIDI(articulationResults.componentAnalyses.vibrato),
                
                // Dynamic control changes
                dynamics: this.generateDynamicMIDI(articulationResults.componentAnalyses.dynamics),
                
                // Articulation velocity adjustments
                articulations: this.generateArticulationMIDI(articulationResults.componentAnalyses.connections),
                
                // Tempo flexibility
                tempo: this.generateTempoMIDI(articulationResults.componentAnalyses.rubato),
                
                // Breath control
                breathing: this.generateBreathingMIDI(articulationResults.componentAnalyses.breathing)
            },
            
            // Enhanced control change data
            controlChanges: this.generateEnhancedControlChanges(articulationResults),
            
            // MPE (MIDI Polyphonic Expression) data
            mpeData: this.generateMPEData(articulationResults)
        };
        
        return enhancedMIDI;
    }
    
    createPerformanceProfile(articulationResults) {
        return {
            timestamp: Date.now(),
            
            // Performance summary
            summary: articulationResults.summary,
            
            // Technical profile
            technical: {
                level: articulationResults.technicalAssessment.level,
                score: articulationResults.technicalAssessment.overallScore,
                strengths: articulationResults.technicalAssessment.strengths,
                weaknesses: articulationResults.technicalAssessment.weaknesses
            },
            
            // Musical profile
            musical: {
                level: articulationResults.musicalAssessment.level,
                score: articulationResults.musicalAssessment.overallScore,
                expressiveElements: articulationResults.musicalAssessment.expressiveElements,
                areas: articulationResults.musicalAssessment.areas
            },
            
            // Performance character
            character: articulationResults.performanceCharacter,
            
            // Consistency analysis
            consistency: articulationResults.consistencyAnalysis,
            
            // Component scores
            componentScores: {
                vibrato: this.extractComponentScore(articulationResults.componentAnalyses.vibrato),
                breathing: this.extractComponentScore(articulationResults.componentAnalyses.breathing),
                articulation: this.extractComponentScore(articulationResults.componentAnalyses.connections),
                dynamics: this.extractComponentScore(articulationResults.componentAnalyses.dynamics),
                tempo: this.extractComponentScore(articulationResults.componentAnalyses.rubato)
            }
        };
    }
    
    handleRealtimeTranscriptionUpdate(transcriptionDetail) {
        // Store real-time data for ongoing analysis
        this.articulationBuffer.push({
            timestamp: performance.now(),
            transcriptionData: transcriptionDetail.transcription,
            musicalData: transcriptionDetail.musical
        });
        
        // Perform lightweight real-time analysis if enough data
        if (this.articulationBuffer.length > 10) {
            this.performRealtimeAnalysis();
        }
    }
    
    performRealtimeAnalysis() {
        // Lightweight real-time articulation hints
        const recentData = this.articulationBuffer.slice(-10);
        
        // Quick vibrato detection
        const vibratoHints = this.detectRealtimeVibrato(recentData);
        
        // Quick breath detection
        const breathHints = this.detectRealtimeBreaths(recentData);
        
        // Quick dynamic changes
        const dynamicHints = this.detectRealtimeDynamics(recentData);
        
        // Emit real-time coaching hints
        if (vibratoHints || breathHints || dynamicHints) {
            document.dispatchEvent(new CustomEvent('realtime-articulation-hints', {
                detail: {
                    vibrato: vibratoHints,
                    breathing: breathHints,
                    dynamics: dynamicHints,
                    timestamp: performance.now()
                }
            }));
        }
    }
    
    emitArticulationAnalysisComplete() {
        const event = new CustomEvent('articulation-analysis-complete', {
            detail: {
                articulationResults: this.articulationAnalysisResults,
                enhancedTranscription: this.enhancedTranscriptionData,
                performanceProfile: this.performanceProfile,
                timestamp: performance.now()
            }
        });
        
        document.dispatchEvent(event);
        console.log('🎭 Articulation analysis complete event emitted');
    }
    
    emitAnalysisError(error) {
        document.dispatchEvent(new CustomEvent('articulation-analysis-error', {
            detail: {
                error: error.message,
                timestamp: performance.now()
            }
        }));
    }
    
    // Data extraction methods
    
    extractNoteEvents(transcriptionResult) {
        // Extract note events from transcription result
        if (transcriptionResult.musical?.notes) {
            return transcriptionResult.musical.notes.map(note => ({
                timestamp: note.timestamp,
                frequency: note.frequency,
                note: note.note,
                duration: note.duration || 0.5,
                confidence: note.confidence || 0.8
            }));
        }
        
        return [];
    }
    
    extractTranscriptionData(transcriptionResult) {
        return {
            lyrics: transcriptionResult.transcription?.lyrics || [],
            syllables: transcriptionResult.transcription?.syllables || [],
            words: transcriptionResult.transcription?.words || []
        };
    }
    
    getForensicData() {
        // Get current forensic analysis data
        return this.forensicIntegration?.forensicAnalyzer?.getCurrentAnalysis() || null;
    }
    
    // Feedback generation methods
    
    generateVibratoFeedback(vibratoAnalysis) {
        if (!vibratoAnalysis.hasVibrato) {
            return {
                status: 'No vibrato detected',
                suggestion: 'Consider developing vibrato for expressive singing',
                priority: 'medium'
            };
        }
        
        const quality = vibratoAnalysis.overallAssessment?.quality || 'developing';
        
        return {
            status: `Vibrato quality: ${quality}`,
            details: vibratoAnalysis.overallAssessment,
            suggestions: vibratoAnalysis.recommendations || [],
            priority: quality === 'basic' ? 'high' : 'low'
        };
    }
    
    generateBreathingFeedback(breathingAnalysis) {
        const supportQuality = breathingAnalysis.supportAnalysis?.overallSupport || 0.5;
        
        return {
            status: `Breath support: ${Math.round(supportQuality * 100)}%`,
            problemAreas: breathingAnalysis.supportAnalysis?.problemAreas || [],
            suggestions: breathingAnalysis.recommendations?.slice(0, 2) || [],
            priority: supportQuality < 0.5 ? 'high' : 'medium'
        };
    }
    
    generateArticulationFeedback(connectionAnalysis) {
        const clarity = connectionAnalysis.summary?.averageConfidence || 0.5;
        
        return {
            status: `Articulation clarity: ${Math.round(clarity * 100)}%`,
            articulationTypes: Object.keys(connectionAnalysis.summary?.types || {}),
            suggestions: connectionAnalysis.recommendations?.slice(0, 2) || [],
            priority: clarity < 0.6 ? 'high' : 'medium'
        };
    }
    
    generateDynamicsFeedback(dynamicsAnalysis) {
        const range = dynamicsAnalysis.summary?.dynamicRange || 'narrow';
        
        return {
            status: `Dynamic range: ${range}`,
            levelCount: Object.keys(dynamicsAnalysis.summary?.levelDistribution || {}).length,
            suggestions: dynamicsAnalysis.recommendations?.slice(0, 2) || [],
            priority: range === 'narrow' ? 'medium' : 'low'
        };
    }
    
    generateTimingFeedback(rubatoAnalysis) {
        const flexibility = rubatoAnalysis.summary?.overallFlexibility || 0.2;
        
        return {
            status: `Timing flexibility: ${Math.round(flexibility * 100)}%`,
            tempoChanges: rubatoAnalysis.summary?.totalTempoChanges || 0,
            suggestions: rubatoAnalysis.recommendations?.slice(0, 2) || [],
            priority: flexibility < 0.3 ? 'medium' : 'low'
        };
    }
    
    generatePracticeExercises(articulationResults) {
        const exercises = [];
        
        // Technical exercises based on weaknesses
        const technical = articulationResults.technicalAssessment;
        if (technical.weaknesses?.includes('breathControl')) {
            exercises.push({
                category: 'breathing',
                exercise: 'Sustained tone breath support',
                description: 'Practice long sustained notes focusing on steady airflow'
            });
        }
        
        if (technical.weaknesses?.includes('vibratoQuality')) {
            exercises.push({
                category: 'vibrato',
                exercise: 'Controlled vibrato development',
                description: 'Practice vibrato on and off at will with consistent rate and depth'
            });
        }
        
        // Musical exercises based on expression level
        const musical = articulationResults.musicalAssessment;
        if (musical.level === 'mechanical' || musical.level === 'developing') {
            exercises.push({
                category: 'expression',
                exercise: 'Dynamic phrasing',
                description: 'Practice the same phrase with different dynamic shapes'
            });
        }
        
        return exercises;
    }
    
    // MIDI generation methods
    
    generateVibratoMIDI(vibratoAnalysis) {
        if (!vibratoAnalysis.hasVibrato) return [];
        
        return vibratoAnalysis.segments.map(segment => ({
            startTime: segment.startTime,
            endTime: segment.endTime,
            controlChange: 1, // Modulation wheel
            rate: segment.rate,
            depth: segment.depth,
            midiValues: this.convertVibratoToMIDI(segment)
        }));
    }
    
    generateDynamicMIDI(dynamicsAnalysis) {
        return (dynamicsAnalysis.dynamicLevels || []).map(level => ({
            timestamp: level.startTime,
            controlChange: 7, // Volume
            value: this.convertDynamicLevelToMIDI(level.level),
            level: level.level
        }));
    }
    
    generateArticulationMIDI(connectionAnalysis) {
        return (connectionAnalysis.connections || []).map(connection => ({
            timestamp: connection.note1.startTime,
            articulation: connection.articulation.type,
            velocityAdjustment: this.convertArticulationToVelocity(connection.articulation.type),
            confidence: connection.articulation.confidence
        }));
    }
    
    generateEnhancedControlChanges(articulationResults) {
        const controlChanges = [];
        
        // Add all dynamic control changes
        const dynamics = this.generateDynamicMIDI(articulationResults.componentAnalyses.dynamics);
        controlChanges.push(...dynamics);
        
        // Add vibrato modulation
        const vibrato = this.generateVibratoMIDI(articulationResults.componentAnalyses.vibrato);
        controlChanges.push(...vibrato);
        
        // Sort by timestamp
        return controlChanges.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }
    
    // Helper methods for real-time analysis
    
    detectRealtimeVibrato(recentData) {
        // Simple vibrato detection from recent musical data
        return recentData.some(data => 
            data.musicalData?.vibrato && data.musicalData.vibrato.present
        ) ? 'Vibrato detected' : null;
    }
    
    detectRealtimeBreaths(recentData) {
        // Simple breath detection
        const energyLevels = recentData.map(d => d.musicalData?.dynamics?.energy || 0);
        const hasEnergyDrop = energyLevels.some((energy, i) => 
            i > 0 && (energyLevels[i-1] - energy) > 0.3
        );
        
        return hasEnergyDrop ? 'Breath detected' : null;
    }
    
    detectRealtimeDynamics(recentData) {
        const energyLevels = recentData.map(d => d.musicalData?.dynamics?.energy || 0);
        const energyRange = Math.max(...energyLevels) - Math.min(...energyLevels);
        
        return energyRange > 0.4 ? 'Dynamic variation detected' : null;
    }
    
    extractComponentScore(componentAnalysis) {
        // Extract a normalized score (0-1) from component analysis
        if (componentAnalysis?.summary?.averageConfidence !== undefined) {
            return componentAnalysis.summary.averageConfidence;
        }
        if (componentAnalysis?.overallAssessment?.quality) {
            const qualityMap = { 'excellent': 1.0, 'good': 0.8, 'adequate': 0.6, 'poor': 0.4 };
            return qualityMap[componentAnalysis.overallAssessment.quality] || 0.5;
        }
        return 0.5; // Default neutral score
    }
    
    // MIDI conversion helpers
    
    convertVibratoToMIDI(vibratoSegment) {
        // Convert vibrato parameters to MIDI modulation values
        const depthMIDI = Math.round((vibratoSegment.depth / 100) * 127); // Depth to MIDI range
        const rateMIDI = Math.round((vibratoSegment.rate / 8) * 127); // Rate to MIDI range
        
        return {
            modulation: Math.min(127, depthMIDI),
            rate: Math.min(127, rateMIDI)
        };
    }
    
    convertDynamicLevelToMIDI(level) {
        const levelMap = {
            'pp': 20, 'p': 40, 'mp': 60, 'mf': 80, 'f': 100, 'ff': 127
        };
        return levelMap[level] || 64;
    }
    
    convertArticulationToVelocity(articulationType) {
        const articulationMap = {
            'staccato': -10, // Reduce velocity for staccato
            'marcato': 15,   // Increase velocity for marcato
            'accent': 10,    // Slight increase for accent
            'legato': 0,     // No change for legato
            'tenuto': 5      // Slight increase for tenuto
        };
        return articulationMap[articulationType] || 0;
    }
    
    generateTempoMIDI(rubatoAnalysis) {
        return (rubatoAnalysis.tempoChanges || []).map(change => ({
            startTime: change.startTime,
            endTime: change.endTime,
            direction: change.direction,
            tempoChange: change.totalChange,
            midiTempo: this.convertTempoChangeToMIDI(change)
        }));
    }
    
    generateBreathingMIDI(breathingAnalysis) {
        return (breathingAnalysis.detectedBreaths || []).map(breath => ({
            timestamp: breath.startTime,
            duration: breath.duration,
            type: 'breath_pause',
            midiEffect: 'note_off' // Trigger note off for breath
        }));
    }
    
    generateMPEData(articulationResults) {
        // Generate MIDI Polyphonic Expression data for advanced MIDI controllers
        return {
            pitchBend: this.generatePitchBendData(articulationResults.componentAnalyses.vibrato),
            channelPressure: this.generateChannelPressureData(articulationResults.componentAnalyses.dynamics),
            timbre: this.generateTimbreData(articulationResults.componentAnalyses.connections)
        };
    }
    
    generatePitchBendData(vibratoAnalysis) {
        if (!vibratoAnalysis.hasVibrato) return [];
        
        return vibratoAnalysis.segments.map(segment => ({
            startTime: segment.startTime,
            endTime: segment.endTime,
            pitchBendRange: Math.round(segment.depth * 2), // Convert cents to pitch bend
            vibrato: true
        }));
    }
    
    generateChannelPressureData(dynamicsAnalysis) {
        return (dynamicsAnalysis.dynamicLevels || []).map(level => ({
            timestamp: level.startTime,
            pressure: this.convertDynamicLevelToPressure(level.level)
        }));
    }
    
    generateTimbreData(connectionAnalysis) {
        return (connectionAnalysis.connections || []).map(connection => ({
            timestamp: connection.note1.startTime,
            timbreControl: this.convertArticulationToTimbre(connection.articulation.type)
        }));
    }
    
    convertTempoChangeToMIDI(tempoChange) {
        // Convert tempo change to MIDI tempo adjustment
        const baseChange = tempoChange.totalChange * 100; // Percentage change
        return Math.max(-50, Math.min(50, baseChange)); // Clamp to reasonable range
    }
    
    convertDynamicLevelToPressure(level) {
        const pressureMap = {
            'pp': 10, 'p': 30, 'mp': 50, 'mf': 70, 'f': 90, 'ff': 127
        };
        return pressureMap[level] || 64;
    }
    
    convertArticulationToTimbre(articulationType) {
        const timbreMap = {
            'legato': 20,    // Smooth timbre
            'staccato': 80,  // Bright timbre
            'marcato': 100,  // Harsh timbre
            'tenuto': 40     // Rich timbre
        };
        return timbreMap[articulationType] || 50;
    }
    
    // Public API methods
    
    getLatestArticulationResults() {
        return this.articulationAnalysisResults;
    }
    
    getEnhancedTranscription() {
        return this.enhancedTranscriptionData;
    }
    
    getPerformanceProfile() {
        return this.performanceProfile;
    }
    
    clearAnalysisData() {
        this.articulationAnalysisResults = null;
        this.enhancedTranscriptionData = null;
        this.performanceProfile = null;
        this.articulationBuffer = [];
        this.analysisHistory = [];
    }
}