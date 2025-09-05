/**
 * Breathing Pattern Analyzer
 * Sophisticated detection and analysis of vocal breathing patterns
 * Identifies breath marks, support patterns, and breathing technique quality
 */

class BreathingPatternAnalyzer {
    constructor() {
        // Breathing detection parameters
        this.breathingConfig = {
            detection: {
                minBreathDuration: 0.08, // seconds - minimum detectable breath
                maxBreathDuration: 2.0, // seconds - maximum reasonable breath pause
                energyDropThreshold: 0.6, // relative energy drop for breath detection
                spectralChangeThreshold: 0.4, // spectral change indicating breath
                noiseFloorRatio: 0.3 // breath noise relative to vocal energy
            },
            
            classification: {
                // Breath types
                quickBreath: { duration: [0.08, 0.3] },
                normalBreath: { duration: [0.3, 0.8] },
                deepBreath: { duration: [0.8, 2.0] },
                
                // Breathing quality indicators
                controlledBreath: {
                    energyConsistency: 0.8,
                    spectralStability: 0.7,
                    timingPrecision: 0.8
                },
                
                // Breath support analysis
                supportIndicators: {
                    steadyAirflow: 0.7,
                    consistentPressure: 0.8,
                    efficientTiming: 0.75
                }
            },
            
            // Musical breath analysis
            musical: {
                phraseBreath: true, // Breath at phrase boundaries
                cadentialBreath: true, // Breath at musical cadences
                expressiveBreath: true, // Artistic breathing choices
                technicalBreath: false // Breaths due to technical limitations
            }
        };
        
        // Breath pattern models
        this.breathPatterns = {
            professional: {
                averageBreathDuration: [0.15, 0.4],
                breathFrequency: [0.1, 0.25], // breaths per second of singing
                breathEfficiency: [0.8, 1.0],
                musicalPlacement: [0.85, 1.0],
                supportQuality: [0.8, 1.0]
            },
            
            trained: {
                averageBreathDuration: [0.2, 0.6],
                breathFrequency: [0.15, 0.35],
                breathEfficiency: [0.6, 0.85],
                musicalPlacement: [0.6, 0.85],
                supportQuality: [0.6, 0.8]
            },
            
            developing: {
                averageBreathDuration: [0.25, 0.8],
                breathFrequency: [0.2, 0.5],
                breathEfficiency: [0.4, 0.7],
                musicalPlacement: [0.3, 0.7],
                supportQuality: [0.3, 0.6]
            },
            
            untrained: {
                averageBreathDuration: [0.3, 1.2],
                breathFrequency: [0.3, 0.8],
                breathEfficiency: [0.2, 0.5],
                musicalPlacement: [0.1, 0.4],
                supportQuality: [0.1, 0.4]
            }
        };
        
        // Analysis state
        this.detectedBreaths = [];
        this.breathingSessions = [];
        this.supportAnalysis = [];
    }
    
    async analyzeBreathingPatterns(forensicData, noteEvents = null, transcriptionData = null) {
        console.log('Analyzing breathing patterns and breath support...');
        
        if (!forensicData || !forensicData.analysis) {
            return this.createEmptyBreathingAnalysis();
        }
        
        // 1. Detect individual breaths
        const detectedBreaths = this.detectBreaths(forensicData);
        
        // 2. Classify breath types and quality
        const classifiedBreaths = await this.classifyBreaths(detectedBreaths, forensicData);
        
        // 3. Analyze breath support patterns
        const supportAnalysis = this.analyzeBreathSupport(forensicData, classifiedBreaths);
        
        // 4. Evaluate musical placement of breaths
        const musicalAnalysis = this.analyzeMusicalBreathPlacement(
            classifiedBreaths, 
            noteEvents, 
            transcriptionData
        );
        
        // 5. Assess overall breathing technique
        const techniqueAssessment = this.assessBreathingTechnique(
            classifiedBreaths, 
            supportAnalysis, 
            musicalAnalysis
        );
        
        // 6. Generate recommendations
        const recommendations = this.generateBreathingRecommendations(
            classifiedBreaths, 
            supportAnalysis, 
            techniqueAssessment
        );
        
        return {
            detectedBreaths: classifiedBreaths,
            supportAnalysis,
            musicalAnalysis,
            techniqueAssessment,
            recommendations,
            summary: this.generateBreathingSummary(classifiedBreaths, supportAnalysis)
        };
    }
    
    detectBreaths(forensicData) {
        const detectedBreaths = [];
        const frames = forensicData.analysis;
        
        if (frames.length < 10) return detectedBreaths;
        
        let currentBreath = null;
        let lastVocalEnergy = 0;
        
        frames.forEach((frame, index) => {
            const energy = frame.dynamics?.energy || 0;
            const isVoiced = frame.pitch?.confidence > 0.3;
            const spectralCentroid = frame.spectral?.centroid || 0;
            
            // Breath detection criteria
            const energyDrop = lastVocalEnergy > 0 ? 
                (lastVocalEnergy - energy) / lastVocalEnergy : 0;
            const lowEnergy = energy < this.breathingConfig.detection.noiseFloorRatio;
            const unvoiced = !isVoiced;
            const breathLikeSpectrum = this.detectBreathSpectrum(frame);
            
            const isBreathCandidate = (
                energyDrop > this.breathingConfig.detection.energyDropThreshold ||
                (lowEnergy && unvoiced) ||
                breathLikeSpectrum
            );
            
            if (isBreathCandidate && !currentBreath) {
                // Start potential breath
                currentBreath = {
                    startTime: frame.timestamp,
                    startIndex: index,
                    frames: [frame],
                    energyProfile: [energy],
                    spectralProfile: [spectralCentroid],
                    minEnergy: energy,
                    maxEnergy: energy
                };
            } else if (isBreathCandidate && currentBreath) {
                // Continue breath
                currentBreath.frames.push(frame);
                currentBreath.energyProfile.push(energy);
                currentBreath.spectralProfile.push(spectralCentroid);
                currentBreath.endTime = frame.timestamp;
                currentBreath.endIndex = index;
                currentBreath.minEnergy = Math.min(currentBreath.minEnergy, energy);
                currentBreath.maxEnergy = Math.max(currentBreath.maxEnergy, energy);
            } else if (!isBreathCandidate && currentBreath) {
                // End breath
                currentBreath.duration = currentBreath.endTime - currentBreath.startTime;
                
                // Validate breath duration
                if (currentBreath.duration >= this.breathingConfig.detection.minBreathDuration &&
                    currentBreath.duration <= this.breathingConfig.detection.maxBreathDuration) {
                    detectedBreaths.push(currentBreath);
                }
                currentBreath = null;
            }
            
            // Update last vocal energy (only from clearly voiced frames)
            if (isVoiced && energy > lastVocalEnergy * 0.5) {
                lastVocalEnergy = energy;
            }
        });
        
        // Handle final breath
        if (currentBreath && currentBreath.duration >= this.breathingConfig.detection.minBreathDuration) {
            detectedBreaths.push(currentBreath);
        }
        
        return detectedBreaths;
    }
    
    detectBreathSpectrum(frame) {
        // Detect spectral characteristics typical of breathing sounds
        if (!frame.spectral) return false;
        
        const centroid = frame.spectral.centroid || 0;
        const harmonics = frame.spectral.harmonics || [];
        
        // Breath sounds typically have:
        // - High spectral centroid (noise-like)
        // - Low harmonic content
        // - Broad spectrum distribution
        
        const isNoisy = centroid > 2000; // High-frequency content
        const lowHarmonics = harmonics.length < 3 || 
            harmonics.reduce((sum, h) => sum + h.amplitude, 0) < 0.3;
        
        return isNoisy && lowHarmonics;
    }
    
    async classifyBreaths(detectedBreaths, forensicData) {
        const classifiedBreaths = [];
        
        for (const breath of detectedBreaths) {
            const classification = await this.classifyBreath(breath, forensicData);
            classifiedBreaths.push({
                ...breath,
                classification
            });
        }
        
        return classifiedBreaths;
    }
    
    async classifyBreath(breath, forensicData) {
        const classification = {
            type: 'normal',
            quality: 'adequate',
            characteristics: {
                audibility: 0,
                control: 0,
                efficiency: 0,
                timing: 0
            },
            breathType: {
                inhalation: false,
                exhalation: false,
                pause: false
            }
        };
        
        // 1. Classify by duration
        const duration = breath.duration;
        if (duration <= this.breathingConfig.classification.quickBreath.duration[1]) {
            classification.type = 'quick';
        } else if (duration <= this.breathingConfig.classification.normalBreath.duration[1]) {
            classification.type = 'normal';
        } else {
            classification.type = 'deep';
        }
        
        // 2. Analyze breath audibility
        classification.characteristics.audibility = this.analyzeBreathAudibility(breath);
        
        // 3. Analyze breath control
        classification.characteristics.control = this.analyzeBreathControl(breath);
        
        // 4. Analyze breath efficiency
        classification.characteristics.efficiency = this.analyzeBreathEfficiency(breath, forensicData);
        
        // 5. Determine breath type (inhalation/exhalation/pause)
        classification.breathType = this.determineBreathType(breath);
        
        // 6. Overall quality assessment
        classification.quality = this.assessBreathQuality(classification.characteristics);
        
        return classification;
    }
    
    analyzeBreathAudibility(breath) {
        // How audible/noisy is the breath?
        const avgEnergy = breath.energyProfile.reduce((sum, e) => sum + e, 0) / breath.energyProfile.length;
        const energyVariance = this.calculateVariance(breath.energyProfile);
        
        // More energy and variance = more audible breath
        const audibilityScore = Math.min(1, (avgEnergy * 2 + Math.sqrt(energyVariance)) / 2);
        
        return audibilityScore;
    }
    
    analyzeBreathControl(breath) {
        // How controlled/smooth is the breathing?
        const energyProfile = breath.energyProfile;
        
        if (energyProfile.length < 3) return 0.5;
        
        // Analyze energy curve smoothness
        let smoothness = 0;
        for (let i = 1; i < energyProfile.length - 1; i++) {
            const change1 = Math.abs(energyProfile[i] - energyProfile[i - 1]);
            const change2 = Math.abs(energyProfile[i + 1] - energyProfile[i]);
            const consistency = 1 - Math.abs(change2 - change1) / Math.max(change1 + change2, 0.001);
            smoothness += consistency;
        }
        
        const controlScore = smoothness / (energyProfile.length - 2);
        
        return Math.max(0, Math.min(1, controlScore));
    }
    
    analyzeBreathEfficiency(breath, forensicData) {
        // How efficient is the breath in terms of time and vocal preparation?
        let efficiencyScore = 0.5; // Default
        
        // 1. Duration efficiency (not too long, not rushed)
        const optimalDuration = 0.25; // Optimal breath duration
        const durationDeviation = Math.abs(breath.duration - optimalDuration) / optimalDuration;
        const durationEfficiency = Math.max(0, 1 - durationDeviation);
        
        efficiencyScore = durationEfficiency * 0.6;
        
        // 2. Recovery efficiency (how quickly vocal quality returns)
        const recoveryEfficiency = this.analyzeVocalRecovery(breath, forensicData);
        efficiencyScore += recoveryEfficiency * 0.4;
        
        return Math.max(0, Math.min(1, efficiencyScore));
    }
    
    analyzeVocalRecovery(breath, forensicData) {
        // Analyze how quickly and well vocal quality returns after breath
        const postBreathFrames = forensicData.analysis.filter(frame => 
            frame.timestamp > breath.endTime && 
            frame.timestamp <= breath.endTime + 1.0
        );
        
        if (postBreathFrames.length < 3) return 0.5;
        
        // Look for quick return to stable voicing
        let stabilityScore = 0;
        let voicingRecoveryTime = null;
        
        postBreathFrames.forEach((frame, index) => {
            const isVoiced = frame.pitch?.confidence > 0.5;
            const hasGoodEnergy = frame.dynamics?.energy > 0.3;
            
            if (isVoiced && hasGoodEnergy && !voicingRecoveryTime) {
                voicingRecoveryTime = frame.timestamp - breath.endTime;
            }
            
            if (isVoiced && hasGoodEnergy) {
                stabilityScore += 1;
            }
        });
        
        const recoverySpeed = voicingRecoveryTime ? 
            Math.max(0, 1 - voicingRecoveryTime / 0.5) : 0; // Penalty for slow recovery
        const stabilityRatio = stabilityScore / postBreathFrames.length;
        
        return (recoverySpeed * 0.6 + stabilityRatio * 0.4);
    }
    
    determineBreathType(breath) {
        const breathType = {
            inhalation: false,
            exhalation: false,
            pause: false,
            confidence: 0
        };
        
        // Analyze energy pattern to determine breath type
        const energyProfile = breath.energyProfile;
        const spectralProfile = breath.spectralProfile;
        
        if (energyProfile.length < 3) {
            breathType.pause = true;
            breathType.confidence = 0.3;
            return breathType;
        }
        
        // Inhalation typically shows:
        // - Gradual energy increase (air intake sound)
        // - Higher spectral centroid at beginning
        const energySlope = this.calculateSlope(energyProfile);
        const spectralSlope = this.calculateSlope(spectralProfile);
        
        if (energySlope > 0.1 && breath.duration < 0.6) {
            breathType.inhalation = true;
            breathType.confidence = Math.min(1, energySlope * 2);
        } else if (energySlope < -0.1 && breath.duration < 0.8) {
            breathType.exhalation = true;
            breathType.confidence = Math.min(1, Math.abs(energySlope) * 2);
        } else {
            breathType.pause = true;
            breathType.confidence = 0.6;
        }
        
        return breathType;
    }
    
    assessBreathQuality(characteristics) {
        // Overall breath quality assessment
        const scores = Object.values(characteristics);
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        
        if (avgScore >= 0.8) return 'excellent';
        if (avgScore >= 0.6) return 'good';
        if (avgScore >= 0.4) return 'adequate';
        if (avgScore >= 0.2) return 'poor';
        return 'very_poor';
    }
    
    analyzeBreathSupport(forensicData, classifiedBreaths) {
        const supportAnalysis = {
            overallSupport: 0,
            supportConsistency: 0,
            airflowEfficiency: 0,
            breathManagement: 0,
            supportIndicators: {
                steadyAirflow: false,
                consistentPressure: false,
                efficientTiming: false,
                adequateCapacity: false
            },
            problemAreas: []
        };
        
        if (!forensicData.analysis || classifiedBreaths.length === 0) {
            return supportAnalysis;
        }
        
        // 1. Analyze sustained notes for breath support indicators
        const sustainedPhrases = this.findSustainedPhrases(forensicData, classifiedBreaths);
        
        // 2. Analyze support consistency across phrases
        supportAnalysis.supportConsistency = this.analyzeSupportConsistency(sustainedPhrases);
        
        // 3. Analyze airflow efficiency
        supportAnalysis.airflowEfficiency = this.analyzeAirflowEfficiency(
            forensicData, 
            classifiedBreaths
        );
        
        // 4. Analyze breath management
        supportAnalysis.breathManagement = this.analyzeBreathManagement(classifiedBreaths);
        
        // 5. Identify support indicators
        supportAnalysis.supportIndicators = this.identifySupportIndicators(
            sustainedPhrases, 
            classifiedBreaths
        );
        
        // 6. Calculate overall support score
        supportAnalysis.overallSupport = this.calculateOverallSupport(supportAnalysis);
        
        // 7. Identify problem areas
        supportAnalysis.problemAreas = this.identifySupportProblems(supportAnalysis);
        
        return supportAnalysis;
    }
    
    findSustainedPhrases(forensicData, classifiedBreaths) {
        const phrases = [];
        const frames = forensicData.analysis;
        
        // Find segments between breaths
        for (let i = 0; i < classifiedBreaths.length + 1; i++) {
            const startTime = i === 0 ? 0 : classifiedBreaths[i - 1].endTime;
            const endTime = i === classifiedBreaths.length ? 
                frames[frames.length - 1].timestamp : classifiedBreaths[i].startTime;
            
            const phraseFrames = frames.filter(frame => 
                frame.timestamp >= startTime && frame.timestamp <= endTime
            );
            
            if (phraseFrames.length > 10) { // Minimum phrase length
                phrases.push({
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    frames: phraseFrames,
                    energyProfile: phraseFrames.map(f => f.dynamics?.energy || 0),
                    pitchStability: this.analyzePitchStability(phraseFrames)
                });
            }
        }
        
        return phrases;
    }
    
    analyzeSupportConsistency(sustainedPhrases) {
        if (sustainedPhrases.length === 0) return 0;
        
        // Analyze energy consistency within and across phrases
        let totalConsistency = 0;
        
        sustainedPhrases.forEach(phrase => {
            const energyProfile = phrase.energyProfile;
            
            if (energyProfile.length > 5) {
                // Calculate energy stability within phrase
                const energyMean = energyProfile.reduce((sum, e) => sum + e, 0) / energyProfile.length;
                const energyVariance = this.calculateVariance(energyProfile);
                const coefficientOfVariation = Math.sqrt(energyVariance) / Math.max(energyMean, 0.001);
                
                // Lower CV = better consistency
                const phraseConsistency = Math.max(0, 1 - coefficientOfVariation);
                totalConsistency += phraseConsistency;
            }
        });
        
        return totalConsistency / sustainedPhrases.length;
    }
    
    analyzeAirflowEfficiency(forensicData, classifiedBreaths) {
        // Measure how efficiently the singer uses breath
        const totalSingingTime = this.calculateTotalSingingTime(forensicData, classifiedBreaths);
        const totalBreathTime = classifiedBreaths.reduce((sum, b) => sum + b.duration, 0);
        const totalTime = totalSingingTime + totalBreathTime;
        
        if (totalTime === 0) return 0;
        
        // Efficiency = ratio of singing time to total time
        const timeEfficiency = totalSingingTime / totalTime;
        
        // Also consider breath quality - better breaths = better efficiency
        const avgBreathQuality = classifiedBreaths.length > 0 ?
            classifiedBreaths.reduce((sum, b) => sum + this.getBreathQualityScore(b.classification.quality), 0) / classifiedBreaths.length :
            0.5;
        
        return (timeEfficiency * 0.7 + avgBreathQuality * 0.3);
    }
    
    analyzeBreathManagement(classifiedBreaths) {
        if (classifiedBreaths.length < 2) return 0.5;
        
        // Analyze breath timing, frequency, and planning
        let managementScore = 0;
        
        // 1. Breath frequency analysis
        const breathFrequency = classifiedBreaths.length / 
            (classifiedBreaths[classifiedBreaths.length - 1].endTime - classifiedBreaths[0].startTime);
        
        const optimalFrequency = 0.2; // breaths per second (rough target)
        const frequencyScore = Math.max(0, 1 - Math.abs(breathFrequency - optimalFrequency) / optimalFrequency);
        
        // 2. Breath duration consistency
        const durations = classifiedBreaths.map(b => b.duration);
        const durationCV = this.calculateCV(durations);
        const durationConsistency = Math.max(0, 1 - durationCV);
        
        // 3. Breath quality consistency
        const qualityScores = classifiedBreaths.map(b => this.getBreathQualityScore(b.classification.quality));
        const qualityConsistency = 1 - this.calculateCV(qualityScores);
        
        managementScore = (frequencyScore * 0.4 + durationConsistency * 0.3 + qualityConsistency * 0.3);
        
        return Math.max(0, Math.min(1, managementScore));
    }
    
    identifySupportIndicators(sustainedPhrases, classifiedBreaths) {
        const indicators = {
            steadyAirflow: false,
            consistentPressure: false,
            efficientTiming: false,
            adequateCapacity: false
        };
        
        // 1. Steady airflow (consistent energy in sustained phrases)
        if (sustainedPhrases.length > 0) {
            const avgConsistency = sustainedPhrases.reduce(
                (sum, phrase) => sum + this.analyzeEnergyConsistency(phrase.energyProfile), 0
            ) / sustainedPhrases.length;
            
            indicators.steadyAirflow = avgConsistency > 0.7;
        }
        
        // 2. Consistent pressure (similar energy levels across phrases)
        if (sustainedPhrases.length > 1) {
            const phraseEnergyAverages = sustainedPhrases.map(phrase => 
                phrase.energyProfile.reduce((sum, e) => sum + e, 0) / phrase.energyProfile.length
            );
            const energyCV = this.calculateCV(phraseEnergyAverages);
            
            indicators.consistentPressure = energyCV < 0.3;
        }
        
        // 3. Efficient timing (appropriate breath durations and placement)
        if (classifiedBreaths.length > 0) {
            const avgEfficiency = classifiedBreaths.reduce(
                (sum, b) => sum + b.classification.characteristics.efficiency, 0
            ) / classifiedBreaths.length;
            
            indicators.efficientTiming = avgEfficiency > 0.6;
        }
        
        // 4. Adequate capacity (long enough phrases between breaths)
        if (sustainedPhrases.length > 0) {
            const avgPhraseDuration = sustainedPhrases.reduce((sum, p) => sum + p.duration, 0) / sustainedPhrases.length;
            indicators.adequateCapacity = avgPhraseDuration > 8.0; // 8 seconds average phrase
        }
        
        return indicators;
    }
    
    calculateOverallSupport(supportAnalysis) {
        // Weight different aspects of breath support
        const weights = {
            supportConsistency: 0.3,
            airflowEfficiency: 0.25,
            breathManagement: 0.25,
            indicators: 0.2
        };
        
        let overallScore = 0;
        overallScore += supportAnalysis.supportConsistency * weights.supportConsistency;
        overallScore += supportAnalysis.airflowEfficiency * weights.airflowEfficiency;
        overallScore += supportAnalysis.breathManagement * weights.breathManagement;
        
        // Score for support indicators
        const indicators = supportAnalysis.supportIndicators;
        const indicatorScore = (
            (indicators.steadyAirflow ? 1 : 0) +
            (indicators.consistentPressure ? 1 : 0) +
            (indicators.efficientTiming ? 1 : 0) +
            (indicators.adequateCapacity ? 1 : 0)
        ) / 4;
        
        overallScore += indicatorScore * weights.indicators;
        
        return Math.max(0, Math.min(1, overallScore));
    }
    
    identifySupportProblems(supportAnalysis) {
        const problems = [];
        
        if (supportAnalysis.supportConsistency < 0.5) {
            problems.push('Inconsistent breath support - work on steady airflow maintenance');
        }
        
        if (supportAnalysis.airflowEfficiency < 0.5) {
            problems.push('Poor airflow efficiency - consider breath management exercises');
        }
        
        if (supportAnalysis.breathManagement < 0.5) {
            problems.push('Breath management needs improvement - work on strategic breath placement');
        }
        
        const indicators = supportAnalysis.supportIndicators;
        
        if (!indicators.steadyAirflow) {
            problems.push('Unsteady airflow detected - practice sustained tones with consistent energy');
        }
        
        if (!indicators.consistentPressure) {
            problems.push('Inconsistent air pressure - work on diaphragmatic breathing consistency');
        }
        
        if (!indicators.efficientTiming) {
            problems.push('Inefficient breath timing - practice breath placement at musical phrase points');
        }
        
        if (!indicators.adequateCapacity) {
            problems.push('Short breath capacity - consider breath capacity building exercises');
        }
        
        return problems;
    }
    
    analyzeMusicalBreathPlacement(classifiedBreaths, noteEvents, transcriptionData) {
        const musicalAnalysis = {
            phraseBreaths: 0,
            cadentialBreaths: 0,
            expressiveBreaths: 0,
            technicalBreaths: 0,
            breathPlacementScore: 0,
            musicalContexts: []
        };
        
        if (classifiedBreaths.length === 0) return musicalAnalysis;
        
        classifiedBreaths.forEach(breath => {
            const context = this.analyzeBreathMusicalContext(
                breath, 
                noteEvents, 
                transcriptionData
            );
            
            musicalAnalysis.musicalContexts.push(context);
            
            // Count breath types
            switch (context.placementType) {
                case 'phrase_boundary':
                    musicalAnalysis.phraseBreaths++;
                    break;
                case 'cadential':
                    musicalAnalysis.cadentialBreaths++;
                    break;
                case 'expressive':
                    musicalAnalysis.expressiveBreaths++;
                    break;
                case 'technical':
                    musicalAnalysis.technicalBreaths++;
                    break;
            }
        });
        
        // Calculate breath placement score
        const total = classifiedBreaths.length;
        if (total > 0) {
            const musicalBreaths = musicalAnalysis.phraseBreaths + 
                                 musicalAnalysis.cadentialBreaths + 
                                 musicalAnalysis.expressiveBreaths;
            musicalAnalysis.breathPlacementScore = musicalBreaths / total;
        }
        
        return musicalAnalysis;
    }
    
    analyzeBreathMusicalContext(breath, noteEvents, transcriptionData) {
        const context = {
            placementType: 'technical',
            musicalJustification: 'none',
            qualityAssessment: 'adequate',
            contextualFit: 0.5
        };
        
        // Analyze note events around the breath
        if (noteEvents && noteEvents.length > 0) {
            const nearbyNotes = this.findNotesAroundBreath(breath, noteEvents);
            
            if (nearbyNotes.beforeBreath.length > 0 && nearbyNotes.afterBreath.length > 0) {
                // Analyze interval and phrase structure
                const intervalBeforeBreath = this.analyzePreBreathInterval(nearbyNotes.beforeBreath);
                const intervalAfterBreath = this.analyzePostBreathInterval(nearbyNotes.afterBreath);
                
                // Determine placement type based on musical factors
                if (this.indicatesPhraseBoundary(intervalBeforeBreath, intervalAfterBreath)) {
                    context.placementType = 'phrase_boundary';
                    context.musicalJustification = 'phrase_break';
                    context.contextualFit = 0.8;
                } else if (this.indicatesCadence(nearbyNotes.beforeBreath)) {
                    context.placementType = 'cadential';
                    context.musicalJustification = 'cadential_break';
                    context.contextualFit = 0.7;
                } else if (this.indicatesExpressiveChoice(breath, nearbyNotes)) {
                    context.placementType = 'expressive';
                    context.musicalJustification = 'expressive_pause';
                    context.contextualFit = 0.6;
                }
            }
        }
        
        // Analyze syllable/word context if available
        if (transcriptionData && transcriptionData.words) {
            const wordContext = this.analyzeBreathWordContext(breath, transcriptionData.words);
            if (wordContext.atWordBoundary) {
                context.contextualFit = Math.max(context.contextualFit, 0.7);
            }
        }
        
        return context;
    }
    
    assessBreathingTechnique(classifiedBreaths, supportAnalysis, musicalAnalysis) {
        const assessment = {
            overallTechnique: 'developing',
            technicalLevel: 0.5,
            strengths: [],
            weaknesses: [],
            comparison: 'developing',
            recommendations: []
        };
        
        if (classifiedBreaths.length === 0) return assessment;
        
        // Calculate technical scores
        const breathQualityScores = classifiedBreaths.map(b => 
            this.getBreathQualityScore(b.classification.quality)
        );
        const avgBreathQuality = breathQualityScores.reduce((sum, s) => sum + s, 0) / breathQualityScores.length;
        
        // Combine scores for overall assessment
        const technicalScore = (
            avgBreathQuality * 0.3 +
            supportAnalysis.overallSupport * 0.4 +
            musicalAnalysis.breathPlacementScore * 0.3
        );
        
        assessment.technicalLevel = technicalScore;
        
        // Classify technique level
        if (technicalScore >= 0.8) {
            assessment.overallTechnique = 'professional';
            assessment.comparison = 'professional';
        } else if (technicalScore >= 0.6) {
            assessment.overallTechnique = 'trained';
            assessment.comparison = 'trained';
        } else if (technicalScore >= 0.4) {
            assessment.overallTechnique = 'developing';
            assessment.comparison = 'developing';
        } else {
            assessment.overallTechnique = 'untrained';
            assessment.comparison = 'untrained';
        }
        
        // Identify strengths and weaknesses
        if (avgBreathQuality > 0.7) {
            assessment.strengths.push('Good breath control and quality');
        } else if (avgBreathQuality < 0.4) {
            assessment.weaknesses.push('Breath control needs improvement');
        }
        
        if (supportAnalysis.overallSupport > 0.7) {
            assessment.strengths.push('Strong breath support');
        } else if (supportAnalysis.overallSupport < 0.4) {
            assessment.weaknesses.push('Breath support needs development');
        }
        
        if (musicalAnalysis.breathPlacementScore > 0.7) {
            assessment.strengths.push('Good musical breath placement');
        } else if (musicalAnalysis.breathPlacementScore < 0.4) {
            assessment.weaknesses.push('Breath placement could be more musical');
        }
        
        return assessment;
    }
    
    generateBreathingRecommendations(classifiedBreaths, supportAnalysis, techniqueAssessment) {
        const recommendations = [];
        
        // Breath quality recommendations
        const noisyBreaths = classifiedBreaths.filter(b => 
            b.classification.characteristics.audibility > 0.6
        );
        
        if (noisyBreaths.length > classifiedBreaths.length * 0.3) {
            recommendations.push({
                category: 'breath_quality',
                priority: 'medium',
                recommendation: 'Work on quieter breathing - practice silent breath intake and release',
                exercises: ['Silent breathing exercises', 'Breath control with metronome']
            });
        }
        
        // Breath support recommendations
        if (supportAnalysis.overallSupport < 0.6) {
            recommendations.push({
                category: 'breath_support',
                priority: 'high',
                recommendation: 'Develop stronger breath support through diaphragmatic breathing exercises',
                exercises: ['Sustained tone exercises', 'Breath support scales', 'Diaphragmatic breathing practice']
            });
        }
        
        // Breath timing recommendations
        const inefficientBreaths = classifiedBreaths.filter(b => 
            b.classification.characteristics.efficiency < 0.5
        );
        
        if (inefficientBreaths.length > classifiedBreaths.length * 0.4) {
            recommendations.push({
                category: 'breath_timing',
                priority: 'medium',
                recommendation: 'Improve breath timing efficiency - practice strategic breath placement',
                exercises: ['Phrase analysis with breath marking', 'Breath timing exercises']
            });
        }
        
        // Musical placement recommendations
        const technicalBreathRatio = supportAnalysis.problemAreas.length / Math.max(classifiedBreaths.length, 1);
        
        if (technicalBreathRatio > 0.5) {
            recommendations.push({
                category: 'musical_placement',
                priority: 'medium',
                recommendation: 'Focus on musical breath placement rather than technical necessity',
                exercises: ['Phrase analysis', 'Text-based breathing', 'Musical phrasing exercises']
            });
        }
        
        // Overall technique recommendations
        if (techniqueAssessment.technicalLevel < 0.4) {
            recommendations.push({
                category: 'overall_technique',
                priority: 'high',
                recommendation: 'Overall breathing technique needs development - consider working with a vocal coach',
                exercises: ['Comprehensive breath work', 'Postural alignment', 'Basic breathing fundamentals']
            });
        }
        
        return recommendations;
    }
    
    generateBreathingSummary(classifiedBreaths, supportAnalysis) {
        return {
            totalBreaths: classifiedBreaths.length,
            averageBreathDuration: classifiedBreaths.length > 0 ?
                classifiedBreaths.reduce((sum, b) => sum + b.duration, 0) / classifiedBreaths.length : 0,
            breathTypes: this.countBreathTypes(classifiedBreaths),
            overallSupport: supportAnalysis.overallSupport,
            supportQuality: this.classifySupportQuality(supportAnalysis.overallSupport),
            problemCount: supportAnalysis.problemAreas.length
        };
    }
    
    // Utility methods
    
    createEmptyBreathingAnalysis() {
        return {
            detectedBreaths: [],
            supportAnalysis: {
                overallSupport: 0,
                supportConsistency: 0,
                airflowEfficiency: 0,
                breathManagement: 0,
                supportIndicators: {
                    steadyAirflow: false,
                    consistentPressure: false,
                    efficientTiming: false,
                    adequateCapacity: false
                },
                problemAreas: ['Insufficient data for breath support analysis']
            },
            musicalAnalysis: {
                phraseBreaths: 0,
                cadentialBreaths: 0,
                expressiveBreaths: 0,
                technicalBreaths: 0,
                breathPlacementScore: 0,
                musicalContexts: []
            },
            techniqueAssessment: {
                overallTechnique: 'unknown',
                technicalLevel: 0,
                strengths: [],
                weaknesses: ['Insufficient data'],
                comparison: 'unknown',
                recommendations: []
            },
            recommendations: [],
            summary: {
                totalBreaths: 0,
                averageBreathDuration: 0,
                breathTypes: {},
                overallSupport: 0,
                supportQuality: 'unknown',
                problemCount: 1
            }
        };
    }
    
    calculateVariance(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    }
    
    calculateSlope(values) {
        if (values.length < 2) return 0;
        
        const n = values.length;
        const indices = Array.from({length: n}, (_, i) => i);
        
        const meanX = indices.reduce((sum, x) => sum + x, 0) / n;
        const meanY = values.reduce((sum, y) => sum + y, 0) / n;
        
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < n; i++) {
            numerator += (indices[i] - meanX) * (values[i] - meanY);
            denominator += Math.pow(indices[i] - meanX, 2);
        }
        
        return denominator !== 0 ? numerator / denominator : 0;
    }
    
    calculateCV(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = this.calculateVariance(values);
        return mean !== 0 ? Math.sqrt(variance) / mean : 0;
    }
    
    getBreathQualityScore(quality) {
        const qualityMap = {
            'excellent': 1.0,
            'good': 0.8,
            'adequate': 0.6,
            'poor': 0.4,
            'very_poor': 0.2
        };
        return qualityMap[quality] || 0.5;
    }
    
    analyzePitchStability(frames) {
        const pitches = frames
            .filter(f => f.pitch && f.pitch.confidence > 0.5)
            .map(f => f.pitch.fundamental);
        
        if (pitches.length < 3) return 0.5;
        
        const variance = this.calculateVariance(pitches);
        const mean = pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
        const cv = Math.sqrt(variance) / mean;
        
        return Math.max(0, 1 - cv); // Lower CV = better stability
    }
    
    calculateTotalSingingTime(forensicData, classifiedBreaths) {
        const totalTime = forensicData.analysis[forensicData.analysis.length - 1].timestamp - 
                          forensicData.analysis[0].timestamp;
        const breathTime = classifiedBreaths.reduce((sum, b) => sum + b.duration, 0);
        
        return Math.max(0, totalTime - breathTime);
    }
    
    analyzeEnergyConsistency(energyProfile) {
        if (energyProfile.length < 3) return 0.5;
        
        const cv = this.calculateCV(energyProfile);
        return Math.max(0, 1 - cv); // Lower CV = better consistency
    }
    
    countBreathTypes(classifiedBreaths) {
        const types = {};
        classifiedBreaths.forEach(breath => {
            const type = breath.classification.type;
            types[type] = (types[type] || 0) + 1;
        });
        return types;
    }
    
    classifySupportQuality(supportScore) {
        if (supportScore >= 0.8) return 'excellent';
        if (supportScore >= 0.6) return 'good';
        if (supportScore >= 0.4) return 'adequate';
        if (supportScore >= 0.2) return 'poor';
        return 'very_poor';
    }
    
    findNotesAroundBreath(breath, noteEvents) {
        const beforeBreath = noteEvents.filter(note => 
            note.timestamp < breath.startTime && 
            note.timestamp > breath.startTime - 2.0
        );
        
        const afterBreath = noteEvents.filter(note => 
            note.timestamp > breath.endTime && 
            note.timestamp < breath.endTime + 2.0
        );
        
        return { beforeBreath, afterBreath };
    }
    
    analyzePreBreathInterval(notes) {
        if (notes.length < 2) return null;
        
        const lastNote = notes[notes.length - 1];
        const secondLastNote = notes[notes.length - 2];
        
        return {
            interval: this.calculateInterval(secondLastNote.frequency, lastNote.frequency),
            duration: lastNote.timestamp - secondLastNote.timestamp
        };
    }
    
    analyzePostBreathInterval(notes) {
        if (notes.length < 2) return null;
        
        const firstNote = notes[0];
        const secondNote = notes[1];
        
        return {
            interval: this.calculateInterval(firstNote.frequency, secondNote.frequency),
            duration: secondNote.timestamp - firstNote.timestamp
        };
    }
    
    calculateInterval(freq1, freq2) {
        if (freq1 <= 0 || freq2 <= 0) return 0;
        return 1200 * Math.log2(freq2 / freq1); // Cents
    }
    
    indicatesPhraseBoundary(beforeInterval, afterInterval) {
        // Heuristic: large intervals or long durations suggest phrase boundaries
        if (!beforeInterval || !afterInterval) return false;
        
        const hasLargeInterval = Math.abs(beforeInterval.interval) > 400 || 
                                Math.abs(afterInterval.interval) > 400;
        const hasLongDuration = beforeInterval.duration > 1.0 || afterInterval.duration > 1.0;
        
        return hasLargeInterval || hasLongDuration;
    }
    
    indicatesCadence(notes) {
        // Heuristic: descending motion or resolution patterns
        if (notes.length < 3) return false;
        
        const lastThreeNotes = notes.slice(-3);
        let descendingMotion = 0;
        
        for (let i = 1; i < lastThreeNotes.length; i++) {
            if (lastThreeNotes[i].frequency < lastThreeNotes[i - 1].frequency) {
                descendingMotion++;
            }
        }
        
        return descendingMotion >= 2; // Mostly descending = possible cadence
    }
    
    indicatesExpressiveChoice(breath, nearbyNotes) {
        // Heuristic: short breath in unexpected places might be expressive
        return breath.duration < 0.2 && 
               nearbyNotes.beforeBreath.length > 0 && 
               nearbyNotes.afterBreath.length > 0;
    }
    
    analyzeBreathWordContext(breath, words) {
        const context = {
            atWordBoundary: false,
            wordType: null,
            contextualAppropriate: false
        };
        
        // Find words around the breath
        const wordsAroundBreath = words.filter(word => 
            Math.abs(word.timestamp - breath.startTime) < 0.5
        );
        
        if (wordsAroundBreath.length > 0) {
            // Check if breath occurs at natural word boundaries
            context.atWordBoundary = true;
            context.contextualAppropriate = true;
        }
        
        return context;
    }
}