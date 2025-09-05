/**
 * Articulation Connection Detector
 * Advanced analysis of note connections: legato, staccato, portamento, glissando
 * Detects vocal articulation techniques between notes with musical intelligence
 */

class ArticulationConnectionDetector {
    constructor() {
        // Detection parameters for different articulation types
        this.articulationConfig = {
            legato: {
                maxGap: 0.02, // seconds - maximum silence for legato
                pitchContinuity: 0.8, // pitch connection smoothness
                energyContinuity: 0.7, // energy connection smoothness
                transitionSmoothness: 0.8 // overall transition quality
            },
            
            staccato: {
                minGap: 0.05, // seconds - minimum separation
                maxGap: 0.3, // seconds - maximum gap still considered staccato
                attackDefinition: 0.7, // clarity of note attack
                releaseDefinition: 0.6 // clarity of note release
            },
            
            portamento: {
                minDuration: 0.1, // seconds - minimum slide duration
                maxDuration: 1.0, // seconds - maximum slide duration
                pitchChangeThreshold: 100, // cents - minimum pitch change
                continuity: 0.8, // smoothness of pitch slide
                energyMaintenance: 0.6 // energy during slide
            },
            
            glissando: {
                minDuration: 0.2, // seconds - minimum glissando duration
                pitchChangeThreshold: 200, // cents - minimum pitch change
                velocityConsistency: 0.7, // consistent sliding speed
                energyProfile: 0.5 // energy pattern during glissando
            },
            
            marcato: {
                attackStrength: 0.8, // strong attack
                energyPeak: 0.9, // prominent energy peak
                releaseClarity: 0.7 // clear release
            },
            
            tenuto: {
                fullDuration: 0.9, // held for full duration
                steadyEnergy: 0.8, // consistent energy level
                minDuration: 0.5 // minimum note length for tenuto
            }
        };
        
        // Vocal-specific considerations
        this.vocalConsiderations = {
            breathingAdjustments: true,
            consonantEffects: true,
            vowelTransitions: true,
            registerChanges: true,
            vibratoInfluence: true
        };
        
        // Analysis state
        this.detectionHistory = [];
        this.noteConnections = [];
        this.articulationPatterns = [];
    }
    
    async analyzeNoteConnections(noteEvents, forensicData, transcriptionData = null) {
        console.log(`Analyzing connections between ${noteEvents.length} note events...`);
        
        if (noteEvents.length < 2) {
            return { connections: [], patterns: [], summary: { total: 0, types: {} } };
        }
        
        const connections = [];
        
        // Analyze each consecutive pair of notes
        for (let i = 0; i < noteEvents.length - 1; i++) {
            const currentNote = noteEvents[i];
            const nextNote = noteEvents[i + 1];
            
            const connection = await this.analyzeConnection(
                currentNote, 
                nextNote, 
                forensicData, 
                transcriptionData,
                i
            );
            
            if (connection) {
                connections.push(connection);
            }
        }
        
        // Identify patterns and phrases
        const patterns = this.identifyArticulationPatterns(connections);
        
        // Generate summary statistics
        const summary = this.generateConnectionSummary(connections);
        
        return {
            connections,
            patterns,
            summary,
            recommendations: this.generateArticulationRecommendations(connections, patterns)
        };
    }
    
    async analyzeConnection(note1, note2, forensicData, transcriptionData, connectionIndex) {
        const connection = {
            index: connectionIndex,
            note1: {
                startTime: note1.timestamp,
                endTime: note1.timestamp + (note1.duration || 0.5),
                frequency: note1.frequency,
                note: note1.note
            },
            note2: {
                startTime: note2.timestamp,
                endTime: note2.timestamp + (note2.duration || 0.5),
                frequency: note2.frequency,
                note: note2.note
            },
            gap: note2.timestamp - (note1.timestamp + (note1.duration || 0.5)),
            pitchInterval: this.calculatePitchInterval(note1.frequency, note2.frequency),
            articulation: {
                type: 'unknown',
                confidence: 0,
                characteristics: {}
            }
        };
        
        // Get forensic data for the transition region
        const transitionData = this.extractTransitionData(
            forensicData, 
            connection.note1.endTime - 0.1, 
            connection.note2.startTime + 0.1
        );
        
        // Analyze different articulation possibilities
        const articulationAnalyses = {
            legato: this.analyzeLegato(connection, transitionData, transcriptionData),
            staccato: this.analyzeStaccato(connection, transitionData),
            portamento: this.analyzePortamento(connection, transitionData),
            glissando: this.analyzeGlissando(connection, transitionData),
            marcato: this.analyzeMarcato(connection, transitionData),
            tenuto: this.analyzeTenuto(connection, transitionData)
        };
        
        // Determine the most likely articulation
        connection.articulation = this.selectBestArticulation(articulationAnalyses);
        
        // Add contextual information
        connection.context = this.analyzeArticulationContext(
            connection, 
            transcriptionData, 
            connectionIndex
        );
        
        return connection;
    }
    
    extractTransitionData(forensicData, startTime, endTime) {
        if (!forensicData || !forensicData.analysis) {
            return { frames: [], pitchTrajectory: [], energyProfile: [] };
        }
        
        const relevantFrames = forensicData.analysis.filter(frame => 
            frame.timestamp >= startTime && frame.timestamp <= endTime
        );
        
        return {
            frames: relevantFrames,
            pitchTrajectory: relevantFrames.map(frame => ({
                timestamp: frame.timestamp,
                frequency: frame.pitch.fundamental,
                confidence: frame.pitch.confidence
            })),
            energyProfile: relevantFrames.map(frame => ({
                timestamp: frame.timestamp,
                energy: frame.dynamics?.energy || 0,
                velocity: frame.dynamics?.velocity || 0
            })),
            spectralData: relevantFrames.map(frame => ({
                timestamp: frame.timestamp,
                spectralCentroid: frame.spectral?.centroid || 0,
                harmonicContent: frame.spectral?.harmonics || []
            }))
        };
    }
    
    analyzeLegato(connection, transitionData, transcriptionData) {
        const analysis = {
            type: 'legato',
            confidence: 0,
            characteristics: {
                pitchContinuity: 0,
                energyContinuity: 0,
                gapAnalysis: {},
                smoothness: 0
            }
        };
        
        const config = this.articulationConfig.legato;
        
        // 1. Gap analysis
        analysis.characteristics.gapAnalysis = {
            duration: connection.gap,
            acceptable: connection.gap <= config.maxGap,
            score: connection.gap <= config.maxGap ? 
                1 - (connection.gap / config.maxGap) : 0
        };
        
        // 2. Pitch continuity analysis
        if (transitionData.pitchTrajectory.length > 2) {
            analysis.characteristics.pitchContinuity = this.analyzePitchContinuity(
                transitionData.pitchTrajectory, 
                connection.note1.frequency, 
                connection.note2.frequency
            );
        }
        
        // 3. Energy continuity analysis
        if (transitionData.energyProfile.length > 2) {
            analysis.characteristics.energyContinuity = this.analyzeEnergyContinuity(
                transitionData.energyProfile
            );
        }
        
        // 4. Smoothness analysis
        analysis.characteristics.smoothness = this.analyzeTransitionSmoothness(transitionData);
        
        // 5. Vocal-specific legato considerations
        const vocalFactors = this.analyzeVocalLegatoFactors(
            connection, 
            transitionData, 
            transcriptionData
        );
        
        // Calculate overall legato confidence
        let confidence = 0;
        confidence += analysis.characteristics.gapAnalysis.score * 0.3;
        confidence += analysis.characteristics.pitchContinuity * 0.25;
        confidence += analysis.characteristics.energyContinuity * 0.25;
        confidence += analysis.characteristics.smoothness * 0.2;
        
        // Apply vocal-specific adjustments
        if (vocalFactors.vowelToVowel) {
            confidence *= 1.1; // Easier legato between vowels
        }
        if (vocalFactors.consonantIntervention) {
            confidence *= 0.8; // Harder legato with consonants
        }
        if (vocalFactors.registerChange) {
            confidence *= 0.7; // Harder legato across register breaks
        }
        
        analysis.confidence = Math.min(1.0, confidence);
        analysis.characteristics.vocalFactors = vocalFactors;
        
        return analysis;
    }
    
    analyzeStaccato(connection, transitionData) {
        const analysis = {
            type: 'staccato',
            confidence: 0,
            characteristics: {
                gapAnalysis: {},
                attackDefinition: 0,
                releaseDefinition: 0,
                separation: 0
            }
        };
        
        const config = this.articulationConfig.staccato;
        
        // 1. Gap analysis for staccato
        const gapInRange = connection.gap >= config.minGap && connection.gap <= config.maxGap;
        analysis.characteristics.gapAnalysis = {
            duration: connection.gap,
            inRange: gapInRange,
            score: gapInRange ? 
                1 - Math.abs(connection.gap - (config.minGap + config.maxGap) / 2) / config.maxGap : 0
        };
        
        // 2. Attack definition (clear note beginning)
        if (transitionData.energyProfile.length > 2) {
            analysis.characteristics.attackDefinition = this.analyzeAttackDefinition(
                transitionData.energyProfile, 
                connection.note2.startTime
            );
        }
        
        // 3. Release definition (clear note ending)
        analysis.characteristics.releaseDefinition = this.analyzeReleaseDefinition(
            transitionData.energyProfile, 
            connection.note1.endTime
        );
        
        // 4. Overall separation quality
        analysis.characteristics.separation = this.analyzeSeparationClarity(transitionData);
        
        // Calculate staccato confidence
        let confidence = 0;
        confidence += analysis.characteristics.gapAnalysis.score * 0.4;
        confidence += analysis.characteristics.attackDefinition * 0.3;
        confidence += analysis.characteristics.releaseDefinition * 0.2;
        confidence += analysis.characteristics.separation * 0.1;
        
        analysis.confidence = confidence;
        
        return analysis;
    }
    
    analyzePortamento(connection, transitionData) {
        const analysis = {
            type: 'portamento',
            confidence: 0,
            characteristics: {
                slideDetection: {},
                pitchCurve: {},
                duration: 0,
                smoothness: 0
            }
        };
        
        const config = this.articulationConfig.portamento;
        
        // 1. Check for continuous pitch slide
        if (transitionData.pitchTrajectory.length < 3) {
            return analysis; // Not enough data for portamento
        }
        
        const pitchChange = Math.abs(
            this.frequencyToCents(connection.note1.frequency, connection.note2.frequency)
        );
        
        if (pitchChange < config.pitchChangeThreshold) {
            return analysis; // Not enough pitch change for portamento
        }
        
        // 2. Analyze slide characteristics
        analysis.characteristics.slideDetection = this.analyzePortamentoSlide(
            transitionData.pitchTrajectory,
            connection.note1.frequency,
            connection.note2.frequency
        );
        
        // 3. Duration analysis
        analysis.characteristics.duration = this.calculateSlideDuration(transitionData.pitchTrajectory);
        const durationInRange = analysis.characteristics.duration >= config.minDuration && 
                                analysis.characteristics.duration <= config.maxDuration;
        
        // 4. Pitch curve analysis
        analysis.characteristics.pitchCurve = this.analyzePitchCurve(transitionData.pitchTrajectory);
        
        // 5. Smoothness of the slide
        analysis.characteristics.smoothness = this.analyzeSlideSmootness(transitionData.pitchTrajectory);
        
        // Calculate portamento confidence
        if (durationInRange && analysis.characteristics.slideDetection.isSlide) {
            let confidence = 0;
            confidence += analysis.characteristics.slideDetection.confidence * 0.4;
            confidence += analysis.characteristics.smoothness * 0.3;
            confidence += analysis.characteristics.pitchCurve.quality * 0.3;
            
            analysis.confidence = confidence;
        }
        
        return analysis;
    }
    
    analyzeGlissando(connection, transitionData) {
        const analysis = {
            type: 'glissando',
            confidence: 0,
            characteristics: {
                slideVelocity: 0,
                consistency: 0,
                energyMaintenance: 0,
                pitchRange: 0
            }
        };
        
        const config = this.articulationConfig.glissando;
        
        if (transitionData.pitchTrajectory.length < 5) {
            return analysis; // Not enough data for glissando analysis
        }
        
        const pitchChange = Math.abs(
            this.frequencyToCents(connection.note1.frequency, connection.note2.frequency)
        );
        
        if (pitchChange < config.pitchChangeThreshold) {
            return analysis; // Not enough pitch change for glissando
        }
        
        // 1. Analyze slide velocity consistency
        analysis.characteristics.slideVelocity = this.analyzeSlideVelocity(transitionData.pitchTrajectory);
        analysis.characteristics.consistency = this.analyzeVelocityConsistency(transitionData.pitchTrajectory);
        
        // 2. Energy maintenance during glissando
        analysis.characteristics.energyMaintenance = this.analyzeEnergyMaintenance(transitionData.energyProfile);
        
        // 3. Pitch range coverage
        analysis.characteristics.pitchRange = pitchChange;
        
        // Calculate glissando confidence
        let confidence = 0;
        confidence += analysis.characteristics.consistency * 0.35;
        confidence += analysis.characteristics.energyMaintenance * 0.3;
        confidence += Math.min(1, pitchChange / 300) * 0.35; // Favor larger pitch changes
        
        analysis.confidence = confidence;
        
        return analysis;
    }
    
    analyzeMarcato(connection, transitionData) {
        const analysis = {
            type: 'marcato',
            confidence: 0,
            characteristics: {
                attackStrength: 0,
                energyPeak: 0,
                accentuation: 0
            }
        };
        
        // Focus on the second note's attack for marcato
        if (transitionData.energyProfile.length > 2) {
            const note2StartIndex = transitionData.energyProfile.findIndex(
                e => e.timestamp >= connection.note2.startTime
            );
            
            if (note2StartIndex >= 0) {
                analysis.characteristics.attackStrength = this.analyzeAttackStrength(
                    transitionData.energyProfile, 
                    note2StartIndex
                );
                
                analysis.characteristics.energyPeak = this.analyzeEnergyPeak(
                    transitionData.energyProfile, 
                    note2StartIndex
                );
                
                analysis.characteristics.accentuation = this.analyzeAccentuation(
                    transitionData.energyProfile, 
                    note2StartIndex
                );
                
                // Calculate marcato confidence
                let confidence = 0;
                confidence += analysis.characteristics.attackStrength * 0.4;
                confidence += analysis.characteristics.energyPeak * 0.3;
                confidence += analysis.characteristics.accentuation * 0.3;
                
                analysis.confidence = confidence;
            }
        }
        
        return analysis;
    }
    
    analyzeTenuto(connection, transitionData) {
        const analysis = {
            type: 'tenuto',
            confidence: 0,
            characteristics: {
                fullDuration: 0,
                steadyEnergy: 0,
                sustainQuality: 0
            }
        };
        
        // Analyze the first note for tenuto characteristics
        const note1Duration = connection.note1.endTime - connection.note1.startTime;
        
        if (note1Duration < this.articulationConfig.tenuto.minDuration) {
            return analysis; // Too short for tenuto
        }
        
        // 1. Check if note is held for full duration
        analysis.characteristics.fullDuration = this.analyzeFullDuration(
            transitionData.energyProfile, 
            connection.note1.startTime, 
            connection.note1.endTime
        );
        
        // 2. Analyze energy steadiness
        analysis.characteristics.steadyEnergy = this.analyzeSteadyEnergy(
            transitionData.energyProfile, 
            connection.note1.startTime, 
            connection.note1.endTime
        );
        
        // 3. Overall sustain quality
        analysis.characteristics.sustainQuality = this.analyzeSustainQuality(
            transitionData, 
            connection.note1.startTime, 
            connection.note1.endTime
        );
        
        // Calculate tenuto confidence
        let confidence = 0;
        confidence += analysis.characteristics.fullDuration * 0.4;
        confidence += analysis.characteristics.steadyEnergy * 0.3;
        confidence += analysis.characteristics.sustainQuality * 0.3;
        
        analysis.confidence = confidence;
        
        return analysis;
    }
    
    selectBestArticulation(analyses) {
        // Find the articulation type with highest confidence
        let bestArticulation = { type: 'unknown', confidence: 0, characteristics: {} };
        
        Object.values(analyses).forEach(analysis => {
            if (analysis.confidence > bestArticulation.confidence) {
                bestArticulation = analysis;
            }
        });
        
        // Add runner-up for ambiguous cases
        const sortedAnalyses = Object.values(analyses).sort((a, b) => b.confidence - a.confidence);
        
        if (sortedAnalyses.length > 1 && sortedAnalyses[1].confidence > 0.3) {
            bestArticulation.alternative = {
                type: sortedAnalyses[1].type,
                confidence: sortedAnalyses[1].confidence
            };
        }
        
        // Add all analysis results for detailed examination
        bestArticulation.allAnalyses = analyses;
        
        return bestArticulation;
    }
    
    analyzeArticulationContext(connection, transcriptionData, connectionIndex) {
        const context = {
            phrasePosition: 'middle',
            syllableAlignment: null,
            breathContext: null,
            musicalContext: {}
        };
        
        // Determine phrase position
        if (connectionIndex === 0) {
            context.phrasePosition = 'beginning';
        } else if (connectionIndex < 3) {
            context.phrasePosition = 'early';
        }
        
        // Analyze syllable alignment if transcription data available
        if (transcriptionData && transcriptionData.syllables) {
            context.syllableAlignment = this.findSyllableAlignment(
                connection, 
                transcriptionData.syllables
            );
        }
        
        // Musical context analysis
        context.musicalContext = {
            intervalSize: this.classifyInterval(connection.pitchInterval),
            direction: connection.pitchInterval > 0 ? 'ascending' : 'descending',
            registralPosition: this.analyzeRegistralPosition(connection)
        };
        
        return context;
    }
    
    identifyArticulationPatterns(connections) {
        const patterns = [];
        
        if (connections.length < 3) return patterns;
        
        // Look for consistent articulation patterns
        const articulationSequences = this.findArticulationSequences(connections);
        const phrasalPatterns = this.identifyPhrasalPatterns(connections);
        const expressivePatterns = this.identifyExpressivePatterns(connections);
        
        patterns.push(...articulationSequences, ...phrasalPatterns, ...expressivePatterns);
        
        return patterns;
    }
    
    findArticulationSequences(connections) {
        const sequences = [];
        let currentSequence = null;
        
        connections.forEach((connection, index) => {
            const articulationType = connection.articulation.type;
            
            if (!currentSequence || currentSequence.type !== articulationType) {
                // Start new sequence
                if (currentSequence && currentSequence.length >= 2) {
                    sequences.push(currentSequence);
                }
                
                currentSequence = {
                    type: articulationType,
                    startIndex: index,
                    length: 1,
                    confidence: connection.articulation.confidence,
                    pattern: 'consistent_articulation'
                };
            } else {
                // Continue sequence
                currentSequence.length++;
                currentSequence.confidence = (currentSequence.confidence + connection.articulation.confidence) / 2;
            }
        });
        
        // Add final sequence
        if (currentSequence && currentSequence.length >= 2) {
            sequences.push(currentSequence);
        }
        
        return sequences;
    }
    
    identifyPhrasalPatterns(connections) {
        // Identify patterns that suggest musical phrasing
        const patterns = [];
        
        // Look for phrase endings (staccato or tenuto followed by gap)
        for (let i = 0; i < connections.length - 1; i++) {
            const current = connections[i];
            const next = connections[i + 1];
            
            if ((current.articulation.type === 'staccato' || current.articulation.type === 'tenuto') &&
                next.gap > 0.2) {
                patterns.push({
                    type: 'phrase_ending',
                    index: i,
                    characteristics: {
                        articulationType: current.articulation.type,
                        gapDuration: next.gap
                    }
                });
            }
        }
        
        // Look for legato phrases
        let legatoStart = null;
        for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            
            if (connection.articulation.type === 'legato') {
                if (legatoStart === null) {
                    legatoStart = i;
                }
            } else {
                if (legatoStart !== null && i - legatoStart >= 2) {
                    patterns.push({
                        type: 'legato_phrase',
                        startIndex: legatoStart,
                        endIndex: i - 1,
                        length: i - legatoStart
                    });
                }
                legatoStart = null;
            }
        }
        
        return patterns;
    }
    
    identifyExpressivePatterns(connections) {
        const patterns = [];
        
        // Look for expressive slides (portamento/glissando)
        connections.forEach((connection, index) => {
            if (connection.articulation.type === 'portamento' || 
                connection.articulation.type === 'glissando') {
                
                patterns.push({
                    type: 'expressive_slide',
                    index,
                    slideType: connection.articulation.type,
                    pitchChange: connection.pitchInterval,
                    expressiveness: connection.articulation.confidence
                });
            }
        });
        
        // Look for accent patterns
        const accentIndices = connections
            .map((conn, idx) => conn.articulation.type === 'marcato' ? idx : -1)
            .filter(idx => idx !== -1);
            
        if (accentIndices.length >= 2) {
            patterns.push({
                type: 'accent_pattern',
                indices: accentIndices,
                spacing: this.analyzeAccentSpacing(accentIndices)
            });
        }
        
        return patterns;
    }
    
    generateConnectionSummary(connections) {
        const summary = {
            total: connections.length,
            types: {},
            averageConfidence: 0,
            articulationDistribution: {},
            qualityMetrics: {}
        };
        
        if (connections.length === 0) return summary;
        
        // Count articulation types
        connections.forEach(connection => {
            const type = connection.articulation.type;
            summary.types[type] = (summary.types[type] || 0) + 1;
        });
        
        // Calculate average confidence
        summary.averageConfidence = connections.reduce(
            (sum, conn) => sum + conn.articulation.confidence, 0
        ) / connections.length;
        
        // Calculate distribution percentages
        Object.keys(summary.types).forEach(type => {
            summary.articulationDistribution[type] = 
                (summary.types[type] / summary.total) * 100;
        });
        
        // Quality metrics
        summary.qualityMetrics = {
            highConfidenceConnections: connections.filter(c => c.articulation.confidence > 0.7).length,
            ambiguousConnections: connections.filter(c => c.articulation.confidence < 0.5).length,
            expressiveConnections: connections.filter(c => 
                ['portamento', 'glissando', 'marcato'].includes(c.articulation.type)
            ).length
        };
        
        return summary;
    }
    
    generateArticulationRecommendations(connections, patterns) {
        const recommendations = [];
        
        // Analyze overall articulation consistency
        const articulationTypes = connections.map(c => c.articulation.type);
        const uniqueTypes = [...new Set(articulationTypes)];
        
        if (uniqueTypes.length === 1 && uniqueTypes[0] === 'unknown') {
            recommendations.push('Consider working on clearer articulation - many connections are ambiguous');
        }
        
        // Check for lack of variety
        if (uniqueTypes.length === 1 && connections.length > 5) {
            recommendations.push(`All connections are ${uniqueTypes[0]} - consider adding articulation variety for musical interest`);
        }
        
        // Check for technical issues
        const lowConfidenceConnections = connections.filter(c => c.articulation.confidence < 0.4);
        if (lowConfidenceConnections.length > connections.length * 0.3) {
            recommendations.push('Many articulations are unclear - focus on more definite note connections');
        }
        
        // Legato-specific recommendations
        const legatoConnections = connections.filter(c => c.articulation.type === 'legato');
        if (legatoConnections.length > 0) {
            const averageLegatoQuality = legatoConnections.reduce(
                (sum, c) => sum + c.articulation.confidence, 0
            ) / legatoConnections.length;
            
            if (averageLegatoQuality < 0.6) {
                recommendations.push('Legato connections could be smoother - work on seamless note transitions');
            }
        }
        
        // Staccato-specific recommendations
        const staccatoConnections = connections.filter(c => c.articulation.type === 'staccato');
        if (staccatoConnections.length > 0) {
            const averageStaccatoQuality = staccatoConnections.reduce(
                (sum, c) => sum + c.articulation.confidence, 0
            ) / staccatoConnections.length;
            
            if (averageStaccatoQuality < 0.6) {
                recommendations.push('Staccato articulation could be clearer - work on crisp note separations');
            }
        }
        
        // Pattern-based recommendations
        const legatoPhrases = patterns.filter(p => p.type === 'legato_phrase');
        if (legatoPhrases.length === 0 && connections.length > 5) {
            recommendations.push('Consider developing longer legato phrases for musical expressiveness');
        }
        
        return recommendations;
    }
    
    // Utility methods for detailed analysis
    
    calculatePitchInterval(freq1, freq2) {
        return this.frequencyToCents(freq1, freq2) * (freq2 > freq1 ? 1 : -1);
    }
    
    frequencyToCents(freq1, freq2) {
        if (freq1 <= 0 || freq2 <= 0) return 0;
        return 1200 * Math.log2(Math.max(freq1, freq2) / Math.min(freq1, freq2));
    }
    
    analyzePitchContinuity(pitchTrajectory, startFreq, endFreq) {
        if (pitchTrajectory.length < 2) return 0;
        
        // Check how smoothly pitch moves from start to end frequency
        let continuityScore = 0;
        let validSegments = 0;
        
        for (let i = 1; i < pitchTrajectory.length; i++) {
            const prev = pitchTrajectory[i - 1];
            const curr = pitchTrajectory[i];
            
            if (prev.confidence > 0.5 && curr.confidence > 0.5) {
                const pitchJump = Math.abs(curr.frequency - prev.frequency);
                const expectedJump = Math.abs(endFreq - startFreq) / pitchTrajectory.length;
                
                // Score based on how close actual jump is to expected smooth transition
                const jumpScore = 1 - Math.min(1, pitchJump / (expectedJump * 3));
                continuityScore += jumpScore;
                validSegments++;
            }
        }
        
        return validSegments > 0 ? continuityScore / validSegments : 0;
    }
    
    analyzeEnergyContinuity(energyProfile) {
        if (energyProfile.length < 2) return 0;
        
        // Look for energy gaps or sudden drops
        let continuityScore = 0;
        let validSegments = 0;
        
        const averageEnergy = energyProfile.reduce((sum, e) => sum + e.energy, 0) / energyProfile.length;
        
        for (let i = 1; i < energyProfile.length; i++) {
            const prev = energyProfile[i - 1];
            const curr = energyProfile[i];
            
            // Score based on energy continuity (no sudden drops to near zero)
            const minEnergy = Math.min(prev.energy, curr.energy);
            const energyRatio = minEnergy / averageEnergy;
            
            continuityScore += Math.min(1, energyRatio * 2); // Boost low energy maintenance
            validSegments++;
        }
        
        return validSegments > 0 ? continuityScore / validSegments : 0;
    }
    
    analyzeTransitionSmoothness(transitionData) {
        // Combine pitch and energy smoothness
        let pitchSmoothness = 0;
        let energySmoothness = 0;
        
        if (transitionData.pitchTrajectory.length > 2) {
            // Calculate pitch smoothness (low variance in pitch changes)
            const pitchChanges = [];
            for (let i = 2; i < transitionData.pitchTrajectory.length; i++) {
                const change1 = transitionData.pitchTrajectory[i - 1].frequency - transitionData.pitchTrajectory[i - 2].frequency;
                const change2 = transitionData.pitchTrajectory[i].frequency - transitionData.pitchTrajectory[i - 1].frequency;
                pitchChanges.push(Math.abs(change2 - change1));
            }
            
            if (pitchChanges.length > 0) {
                const avgChange = pitchChanges.reduce((sum, c) => sum + c, 0) / pitchChanges.length;
                pitchSmoothness = 1 / (1 + avgChange / 10); // Normalize smoothness score
            }
        }
        
        if (transitionData.energyProfile.length > 2) {
            // Similar analysis for energy
            const energyChanges = [];
            for (let i = 2; i < transitionData.energyProfile.length; i++) {
                const change1 = transitionData.energyProfile[i - 1].energy - transitionData.energyProfile[i - 2].energy;
                const change2 = transitionData.energyProfile[i].energy - transitionData.energyProfile[i - 1].energy;
                energyChanges.push(Math.abs(change2 - change1));
            }
            
            if (energyChanges.length > 0) {
                const avgChange = energyChanges.reduce((sum, c) => sum + c, 0) / energyChanges.length;
                energySmoothness = 1 / (1 + avgChange * 10); // Normalize smoothness score
            }
        }
        
        return (pitchSmoothness + energySmoothness) / 2;
    }
    
    analyzeVocalLegatoFactors(connection, transitionData, transcriptionData) {
        const factors = {
            vowelToVowel: false,
            consonantIntervention: false,
            registerChange: false,
            breathingIssue: false
        };
        
        if (transcriptionData && transcriptionData.syllables) {
            // Analyze syllable transitions
            const syllables = transcriptionData.syllables.filter(s => 
                (s.startTime >= connection.note1.startTime - 0.1 && s.startTime <= connection.note2.endTime + 0.1)
            );
            
            if (syllables.length >= 2) {
                const syl1 = syllables[0];
                const syl2 = syllables[syllables.length - 1];
                
                // Check for vowel-to-vowel transitions (easier legato)
                factors.vowelToVowel = this.isVowelEnding(syl1.text) && this.isVowelBeginning(syl2.text);
                
                // Check for consonant intervention (harder legato)
                factors.consonantIntervention = !factors.vowelToVowel && 
                    (this.hasConsonantEnding(syl1.text) || this.hasConsonantBeginning(syl2.text));
            }
        }
        
        // Check for register change (makes legato harder)
        const freq1 = connection.note1.frequency;
        const freq2 = connection.note2.frequency;
        factors.registerChange = this.detectRegisterChange(freq1, freq2);
        
        return factors;
    }
    
    analyzeAttackDefinition(energyProfile, attackTime) {
        // Find the energy profile around the attack time
        const attackIndex = energyProfile.findIndex(e => e.timestamp >= attackTime);
        if (attackIndex < 1) return 0;
        
        const preAttack = energyProfile[attackIndex - 1];
        const attack = energyProfile[attackIndex];
        
        // Strong attack = significant energy increase
        const energyIncrease = attack.energy - preAttack.energy;
        const relativeIncrease = energyIncrease / Math.max(preAttack.energy, 0.001);
        
        return Math.min(1, relativeIncrease / 2); // Normalize to 0-1
    }
    
    analyzeReleaseDefinition(energyProfile, releaseTime) {
        // Find the energy profile around the release time
        const releaseIndex = energyProfile.findIndex(e => e.timestamp >= releaseTime);
        if (releaseIndex >= energyProfile.length - 1) return 0;
        
        const release = energyProfile[releaseIndex];
        const postRelease = energyProfile[releaseIndex + 1];
        
        // Clear release = significant energy decrease
        const energyDecrease = release.energy - postRelease.energy;
        const relativeDecrease = energyDecrease / Math.max(release.energy, 0.001);
        
        return Math.min(1, relativeDecrease / 2); // Normalize to 0-1
    }
    
    analyzeSeparationClarity(transitionData) {
        // Look for clear energy gap between notes
        if (transitionData.energyProfile.length < 3) return 0;
        
        const minEnergy = Math.min(...transitionData.energyProfile.map(e => e.energy));
        const maxEnergy = Math.max(...transitionData.energyProfile.map(e => e.energy));
        const energyRange = maxEnergy - minEnergy;
        
        if (energyRange === 0) return 0;
        
        // Good separation = low energy in the middle of transition
        const middleIndex = Math.floor(transitionData.energyProfile.length / 2);
        const middleEnergy = transitionData.energyProfile[middleIndex].energy;
        
        const separationScore = 1 - (middleEnergy - minEnergy) / energyRange;
        
        return Math.max(0, separationScore);
    }
    
    isVowelEnding(text) {
        return /[aeiouAEIOU]$/.test(text);
    }
    
    isVowelBeginning(text) {
        return /^[aeiouAEIOU]/.test(text);
    }
    
    hasConsonantEnding(text) {
        return /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]$/.test(text);
    }
    
    hasConsonantBeginning(text) {
        return /^[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/.test(text);
    }
    
    detectRegisterChange(freq1, freq2) {
        // Detect vocal register transitions (chest/mixed/head/falsetto)
        const registerBoundaries = [
            { name: 'chest_mixed', frequency: 350 },
            { name: 'mixed_head', frequency: 600 },
            { name: 'head_falsetto', frequency: 900 }
        ];
        
        let reg1 = 'chest';
        let reg2 = 'chest';
        
        // Determine registers for both frequencies
        for (const boundary of registerBoundaries) {
            if (freq1 > boundary.frequency) reg1 = boundary.name.split('_')[1];
            if (freq2 > boundary.frequency) reg2 = boundary.name.split('_')[1];
        }
        
        return reg1 !== reg2;
    }
    
    classifyInterval(cents) {
        const absInterval = Math.abs(cents);
        
        if (absInterval < 100) return 'unison';
        if (absInterval < 300) return 'minor_second';
        if (absInterval < 400) return 'major_second';
        if (absInterval < 500) return 'minor_third';
        if (absInterval < 600) return 'major_third';
        if (absInterval < 700) return 'fourth';
        if (absInterval < 800) return 'tritone';
        if (absInterval < 900) return 'fifth';
        if (absInterval < 1000) return 'minor_sixth';
        if (absInterval < 1100) return 'major_sixth';
        if (absInterval < 1200) return 'minor_seventh';
        if (absInterval < 1300) return 'major_seventh';
        return 'octave_or_larger';
    }
    
    analyzeRegistralPosition(connection) {
        const avgFreq = (connection.note1.frequency + connection.note2.frequency) / 2;
        
        if (avgFreq < 200) return 'very_low';
        if (avgFreq < 350) return 'low';
        if (avgFreq < 600) return 'middle';
        if (avgFreq < 900) return 'high';
        return 'very_high';
    }
    
    findSyllableAlignment(connection, syllables) {
        // Find syllables that align with this connection
        const relevantSyllables = syllables.filter(s => 
            (s.startTime >= connection.note1.startTime - 0.1 && 
             s.startTime <= connection.note2.endTime + 0.1)
        );
        
        return {
            count: relevantSyllables.length,
            syllables: relevantSyllables,
            alignment: relevantSyllables.length > 0 ? 'aligned' : 'no_alignment'
        };
    }
    
    analyzeAccentSpacing(accentIndices) {
        if (accentIndices.length < 2) return { pattern: 'none' };
        
        const spacings = [];
        for (let i = 1; i < accentIndices.length; i++) {
            spacings.push(accentIndices[i] - accentIndices[i - 1]);
        }
        
        // Check for regular spacing
        const uniqueSpacings = [...new Set(spacings)];
        
        if (uniqueSpacings.length === 1) {
            return { pattern: 'regular', spacing: uniqueSpacings[0] };
        } else {
            return { pattern: 'irregular', spacings };
        }
    }
}