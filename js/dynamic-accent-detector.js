/**
 * Dynamic Range and Accent Detector
 * Advanced detection of dynamic levels, accents, and volume variations in vocal performance
 * Maps dynamics to standard musical notation markings (pp, p, mp, mf, f, ff)
 */

class DynamicAccentDetector {
    constructor() {
        // Dynamic level configuration
        this.dynamicConfig = {
            // Standard dynamic levels (relative to performance range)
            levels: {
                pp: { range: [0.0, 0.15], marking: 'pianissimo' },
                p: { range: [0.15, 0.3], marking: 'piano' },
                mp: { range: [0.3, 0.45], marking: 'mezzo-piano' },
                mf: { range: [0.45, 0.65], marking: 'mezzo-forte' },
                f: { range: [0.65, 0.8], marking: 'forte' },
                ff: { range: [0.8, 1.0], marking: 'fortissimo' }
            },
            
            // Accent detection parameters
            accents: {
                sforzando: { energyRatio: 2.0, duration: [0.05, 0.2] },
                marcato: { energyRatio: 1.8, duration: [0.1, 0.4] },
                accent: { energyRatio: 1.5, duration: [0.05, 0.3] },
                tenuto: { sustainRatio: 1.2, duration: [0.3, 2.0] }
            },
            
            // Analysis parameters
            analysis: {
                smoothingWindow: 0.1, // seconds for energy smoothing
                accentWindow: 0.5, // seconds to look for accent context
                minNoteLength: 0.1, // minimum note duration for dynamic analysis
                levelChangeThreshold: 0.15 // minimum change for new dynamic level
            }
        };
        
        // Performance context for relative dynamics
        this.performanceContext = {
            globalEnergyRange: { min: 0, max: 1 },
            averageEnergy: 0.5,
            energyDistribution: {},
            adaptiveThresholds: {}
        };
        
        // Analysis state
        this.dynamicHistory = [];
        this.accentHistory = [];
        this.levelTransitions = [];
    }
    
    async analyzeDynamicRange(forensicData, noteEvents = null) {
        console.log('Analyzing dynamic range and accent patterns...');
        
        if (!forensicData || !forensicData.analysis) {
            return this.createEmptyDynamicAnalysis();
        }
        
        // 1. Establish performance context (global energy range)
        this.establishPerformanceContext(forensicData);
        
        // 2. Smooth and normalize energy data
        const processedEnergyData = this.processEnergyData(forensicData);
        
        // 3. Detect dynamic levels throughout performance
        const dynamicLevels = this.detectDynamicLevels(processedEnergyData, noteEvents);
        
        // 4. Detect accents and emphasis
        const detectedAccents = this.detectAccents(processedEnergyData, noteEvents);
        
        // 5. Analyze dynamic transitions
        const dynamicTransitions = this.analyzeDynamicTransitions(dynamicLevels);
        
        // 6. Map to musical notation
        const notationMappings = this.mapToMusicalNotation(dynamicLevels, detectedAccents);
        
        return {
            dynamicLevels,
            detectedAccents,
            dynamicTransitions,
            notationMappings,
            performanceContext: this.performanceContext,
            summary: this.generateDynamicSummary(dynamicLevels, detectedAccents),
            recommendations: this.generateDynamicRecommendations(dynamicLevels, detectedAccents)
        };
    }
    
    establishPerformanceContext(forensicData) {
        // Analyze the entire performance to establish relative dynamic context
        const energyValues = forensicData.analysis
            .filter(frame => frame.dynamics && frame.dynamics.energy !== undefined)
            .map(frame => frame.dynamics.energy);
        
        if (energyValues.length === 0) {
            this.performanceContext.globalEnergyRange = { min: 0, max: 1 };
            this.performanceContext.averageEnergy = 0.5;
            return;
        }
        
        // Calculate energy statistics
        this.performanceContext.globalEnergyRange = {
            min: Math.min(...energyValues),
            max: Math.max(...energyValues)
        };
        
        this.performanceContext.averageEnergy = 
            energyValues.reduce((sum, e) => sum + e, 0) / energyValues.length;
        
        // Create energy distribution histogram
        this.performanceContext.energyDistribution = this.createEnergyHistogram(energyValues);
        
        // Set adaptive thresholds based on actual performance range
        this.setAdaptiveThresholds(energyValues);
        
        console.log('Performance context established:', this.performanceContext);
    }
    
    createEnergyHistogram(energyValues) {
        const bins = 10;
        const histogram = {};
        const range = this.performanceContext.globalEnergyRange;
        const binSize = (range.max - range.min) / bins;
        
        for (let i = 0; i < bins; i++) {
            const binStart = range.min + i * binSize;
            const binEnd = binStart + binSize;
            const binKey = `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`;
            histogram[binKey] = 0;
        }
        
        energyValues.forEach(energy => {
            const binIndex = Math.min(bins - 1, Math.floor((energy - range.min) / binSize));
            const binStart = range.min + binIndex * binSize;
            const binEnd = binStart + binSize;
            const binKey = `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`;
            histogram[binKey]++;
        });
        
        return histogram;
    }
    
    setAdaptiveThresholds(energyValues) {
        // Set dynamic level thresholds based on actual energy distribution
        const sortedEnergies = [...energyValues].sort((a, b) => a - b);
        const range = this.performanceContext.globalEnergyRange;
        
        this.performanceContext.adaptiveThresholds = {
            pp: range.min + (range.max - range.min) * 0.1,
            p: range.min + (range.max - range.min) * 0.25,
            mp: range.min + (range.max - range.min) * 0.4,
            mf: range.min + (range.max - range.min) * 0.6,
            f: range.min + (range.max - range.min) * 0.75,
            ff: range.min + (range.max - range.min) * 0.9
        };
    }
    
    processEnergyData(forensicData) {
        const rawEnergy = forensicData.analysis.map(frame => ({
            timestamp: frame.timestamp,
            energy: frame.dynamics?.energy || 0,
            velocity: frame.dynamics?.velocity || 0,
            rms: frame.dynamics?.rms || 0
        }));
        
        // Apply smoothing to reduce noise
        const smoothedEnergy = this.applySmoothingFilter(rawEnergy);
        
        // Normalize to performance range
        const normalizedEnergy = this.normalizeToPerformanceRange(smoothedEnergy);
        
        return normalizedEnergy;
    }
    
    applySmoothingFilter(energyData) {
        const windowSize = Math.ceil(this.dynamicConfig.analysis.smoothingWindow * 10); // Assuming ~10 fps
        const smoothed = [];
        
        for (let i = 0; i < energyData.length; i++) {
            const windowStart = Math.max(0, i - windowSize);
            const windowEnd = Math.min(energyData.length, i + windowSize + 1);
            const windowData = energyData.slice(windowStart, windowEnd);
            
            const avgEnergy = windowData.reduce((sum, d) => sum + d.energy, 0) / windowData.length;
            const avgVelocity = windowData.reduce((sum, d) => sum + d.velocity, 0) / windowData.length;
            const avgRms = windowData.reduce((sum, d) => sum + d.rms, 0) / windowData.length;
            
            smoothed.push({
                timestamp: energyData[i].timestamp,
                energy: avgEnergy,
                velocity: avgVelocity,
                rms: avgRms,
                rawEnergy: energyData[i].energy
            });
        }
        
        return smoothed;
    }
    
    normalizeToPerformanceRange(energyData) {
        const range = this.performanceContext.globalEnergyRange;
        const span = range.max - range.min;
        
        if (span === 0) return energyData;
        
        return energyData.map(data => ({
            ...data,
            normalizedEnergy: (data.energy - range.min) / span,
            normalizedVelocity: (data.velocity - range.min) / span
        }));
    }
    
    detectDynamicLevels(processedEnergyData, noteEvents) {
        const dynamicLevels = [];
        let currentLevel = null;
        
        processedEnergyData.forEach((data, index) => {
            const level = this.classifyDynamicLevel(data.normalizedEnergy);
            
            if (!currentLevel || currentLevel.level !== level) {
                // End previous level
                if (currentLevel) {
                    currentLevel.endTime = data.timestamp;
                    currentLevel.duration = currentLevel.endTime - currentLevel.startTime;
                    
                    // Only keep levels that meet minimum duration
                    if (currentLevel.duration >= this.dynamicConfig.analysis.minNoteLength) {
                        dynamicLevels.push(currentLevel);
                    }
                }
                
                // Start new level
                currentLevel = {
                    level,
                    marking: this.dynamicConfig.levels[level].marking,
                    startTime: data.timestamp,
                    startIndex: index,
                    energyRange: {
                        min: data.normalizedEnergy,
                        max: data.normalizedEnergy,
                        avg: data.normalizedEnergy
                    },
                    energyValues: [data.normalizedEnergy],
                    confidence: 0.8 // Base confidence
                };
            } else {
                // Continue current level
                currentLevel.energyRange.min = Math.min(currentLevel.energyRange.min, data.normalizedEnergy);
                currentLevel.energyRange.max = Math.max(currentLevel.energyRange.max, data.normalizedEnergy);
                currentLevel.energyValues.push(data.normalizedEnergy);
                currentLevel.energyRange.avg = 
                    currentLevel.energyValues.reduce((sum, e) => sum + e, 0) / currentLevel.energyValues.length;
            }
        });
        
        // Handle final level
        if (currentLevel) {
            const lastData = processedEnergyData[processedEnergyData.length - 1];
            currentLevel.endTime = lastData.timestamp;
            currentLevel.duration = currentLevel.endTime - currentLevel.startTime;
            
            if (currentLevel.duration >= this.dynamicConfig.analysis.minNoteLength) {
                dynamicLevels.push(currentLevel);
            }
        }
        
        // Refine levels based on musical context
        return this.refineDynamicLevels(dynamicLevels, noteEvents);
    }
    
    classifyDynamicLevel(normalizedEnergy) {
        const thresholds = this.performanceContext.adaptiveThresholds;
        
        if (normalizedEnergy <= 0.15) return 'pp';
        if (normalizedEnergy <= 0.3) return 'p';
        if (normalizedEnergy <= 0.45) return 'mp';
        if (normalizedEnergy <= 0.65) return 'mf';
        if (normalizedEnergy <= 0.8) return 'f';
        return 'ff';
    }
    
    refineDynamicLevels(dynamicLevels, noteEvents) {
        // Refine levels based on musical context and note boundaries
        if (!noteEvents || noteEvents.length === 0) return dynamicLevels;
        
        return dynamicLevels.map(level => {
            // Find notes that overlap with this dynamic level
            const overlappingNotes = noteEvents.filter(note => 
                note.timestamp < level.endTime && 
                (note.timestamp + (note.duration || 0.5)) > level.startTime
            );
            
            // Adjust confidence based on musical context
            let adjustedConfidence = level.confidence;
            
            if (overlappingNotes.length > 0) {
                // Higher confidence if level aligns with note boundaries
                const noteAlignmentScore = this.calculateNoteAlignmentScore(level, overlappingNotes);
                adjustedConfidence *= (0.5 + noteAlignmentScore * 0.5);
            }
            
            return {
                ...level,
                confidence: adjustedConfidence,
                overlappingNotes: overlappingNotes.length,
                musicalContext: this.analyzeLevelMusicalContext(level, overlappingNotes)
            };
        });
    }
    
    detectAccents(processedEnergyData, noteEvents) {
        const detectedAccents = [];
        
        if (!noteEvents || noteEvents.length === 0) {
            // Fall back to energy-based accent detection without note context
            return this.detectAccentsFromEnergy(processedEnergyData);
        }
        
        // Analyze each note for potential accents
        noteEvents.forEach((note, noteIndex) => {
            const accent = this.analyzeNoteForAccent(note, processedEnergyData, noteIndex, noteEvents);
            if (accent) {
                detectedAccents.push(accent);
            }
        });
        
        return detectedAccents;
    }
    
    analyzeNoteForAccent(note, energyData, noteIndex, allNotes) {
        const noteStart = note.timestamp;
        const noteEnd = noteStart + (note.duration || 0.5);
        
        // Get energy data for this note
        const noteEnergyData = energyData.filter(data => 
            data.timestamp >= noteStart && data.timestamp <= noteEnd
        );
        
        if (noteEnergyData.length < 2) return null;
        
        // Calculate note's energy characteristics
        const noteEnergy = {
            max: Math.max(...noteEnergyData.map(d => d.normalizedEnergy)),
            avg: noteEnergyData.reduce((sum, d) => sum + d.normalizedEnergy, 0) / noteEnergyData.length,
            attack: noteEnergyData[0]?.normalizedEnergy || 0,
            attackSlope: this.calculateAttackSlope(noteEnergyData)
        };
        
        // Get context energy (surrounding notes)
        const contextEnergy = this.getContextualEnergy(noteIndex, allNotes, energyData);
        
        // Determine accent type and strength
        const accentAnalysis = this.classifyAccent(noteEnergy, contextEnergy, note.duration || 0.5);
        
        if (accentAnalysis.type !== 'none') {
            return {
                noteIndex,
                timestamp: noteStart,
                duration: noteEnd - noteStart,
                type: accentAnalysis.type,
                intensity: accentAnalysis.intensity,
                confidence: accentAnalysis.confidence,
                energyData: noteEnergy,
                contextualStrength: accentAnalysis.contextualStrength,
                musicalReasoning: accentAnalysis.reasoning
            };
        }
        
        return null;
    }
    
    calculateAttackSlope(noteEnergyData) {
        if (noteEnergyData.length < 3) return 0;
        
        // Calculate slope of first 3 energy points (attack portion)
        const attackPoints = noteEnergyData.slice(0, Math.min(3, noteEnergyData.length));
        let totalSlope = 0;
        
        for (let i = 1; i < attackPoints.length; i++) {
            const timeDiff = attackPoints[i].timestamp - attackPoints[i-1].timestamp;
            const energyDiff = attackPoints[i].normalizedEnergy - attackPoints[i-1].normalizedEnergy;
            if (timeDiff > 0) {
                totalSlope += energyDiff / timeDiff;
            }
        }
        
        return totalSlope / (attackPoints.length - 1);
    }
    
    getContextualEnergy(noteIndex, allNotes, energyData) {
        const contextWindow = 2; // Look at 2 notes before and after
        const contextNotes = [];
        
        for (let i = Math.max(0, noteIndex - contextWindow); 
             i < Math.min(allNotes.length, noteIndex + contextWindow + 1); i++) {
            if (i !== noteIndex) {
                const contextNote = allNotes[i];
                const contextNoteEnergyData = energyData.filter(data =>
                    data.timestamp >= contextNote.timestamp &&
                    data.timestamp <= contextNote.timestamp + (contextNote.duration || 0.5)
                );
                
                if (contextNoteEnergyData.length > 0) {
                    const avgEnergy = contextNoteEnergyData.reduce((sum, d) => sum + d.normalizedEnergy, 0) / 
                                    contextNoteEnergyData.length;
                    contextNotes.push({
                        noteIndex: i,
                        avgEnergy,
                        maxEnergy: Math.max(...contextNoteEnergyData.map(d => d.normalizedEnergy))
                    });
                }
            }
        }
        
        return {
            avgEnergy: contextNotes.length > 0 ? 
                contextNotes.reduce((sum, n) => sum + n.avgEnergy, 0) / contextNotes.length : 0.5,
            maxEnergy: contextNotes.length > 0 ? 
                Math.max(...contextNotes.map(n => n.maxEnergy)) : 0.5,
            count: contextNotes.length
        };
    }
    
    classifyAccent(noteEnergy, contextEnergy, noteDuration) {
        const classification = {
            type: 'none',
            intensity: 0,
            confidence: 0,
            contextualStrength: 0,
            reasoning: []
        };
        
        if (contextEnergy.count === 0) {
            return classification; // Can't classify without context
        }
        
        // Calculate relative strength compared to context
        const energyRatio = noteEnergy.max / Math.max(contextEnergy.maxEnergy, 0.1);
        const avgEnergyRatio = noteEnergy.avg / Math.max(contextEnergy.avgEnergy, 0.1);
        
        classification.contextualStrength = energyRatio;
        
        // Classify accent type based on energy patterns and duration
        if (energyRatio >= 2.0 && noteDuration <= 0.2) {
            classification.type = 'sforzando';
            classification.intensity = Math.min(1.0, (energyRatio - 1.5) / 1.5);
            classification.confidence = 0.9;
            classification.reasoning.push('Very high energy ratio with short duration suggests sforzando');
        } else if (energyRatio >= 1.8 && noteDuration <= 0.4) {
            classification.type = 'marcato';
            classification.intensity = Math.min(1.0, (energyRatio - 1.3) / 1.2);
            classification.confidence = 0.8;
            classification.reasoning.push('High energy ratio with moderate duration suggests marcato');
        } else if (energyRatio >= 1.5) {
            classification.type = 'accent';
            classification.intensity = Math.min(1.0, (energyRatio - 1.2) / 0.8);
            classification.confidence = 0.7;
            classification.reasoning.push('Moderate energy increase suggests regular accent');
        } else if (avgEnergyRatio >= 1.2 && noteDuration >= 0.3) {
            classification.type = 'tenuto';
            classification.intensity = Math.min(1.0, (avgEnergyRatio - 1.0) / 0.5);
            classification.confidence = 0.6;
            classification.reasoning.push('Sustained energy with longer duration suggests tenuto');
        }
        
        // Additional validation based on attack characteristics
        if (noteEnergy.attackSlope > 2.0 && classification.type === 'none') {
            classification.type = 'accent';
            classification.intensity = Math.min(1.0, noteEnergy.attackSlope / 4.0);
            classification.confidence = 0.5;
            classification.reasoning.push('Sharp attack slope suggests accent');
        }
        
        return classification;
    }
    
    detectAccentsFromEnergy(processedEnergyData) {
        // Fallback method when no note events are available
        const accents = [];
        const windowSize = 5; // Frames to look for local maxima
        
        for (let i = windowSize; i < processedEnergyData.length - windowSize; i++) {
            const currentEnergy = processedEnergyData[i].normalizedEnergy;
            const contextEnergies = [];
            
            // Gather context energies
            for (let j = i - windowSize; j <= i + windowSize; j++) {
                if (j !== i) {
                    contextEnergies.push(processedEnergyData[j].normalizedEnergy);
                }
            }
            
            const maxContextEnergy = Math.max(...contextEnergies);
            const avgContextEnergy = contextEnergies.reduce((sum, e) => sum + e, 0) / contextEnergies.length;
            
            // Check for accent based on local energy peak
            if (currentEnergy > maxContextEnergy * 1.3 && currentEnergy > avgContextEnergy * 1.5) {
                accents.push({
                    timestamp: processedEnergyData[i].timestamp,
                    type: 'accent',
                    intensity: Math.min(1.0, (currentEnergy - avgContextEnergy) / avgContextEnergy),
                    confidence: 0.6,
                    energyRatio: currentEnergy / avgContextEnergy,
                    detectionMethod: 'energy_peak'
                });
            }
        }
        
        return accents;
    }
    
    analyzeDynamicTransitions(dynamicLevels) {
        const transitions = [];
        
        for (let i = 1; i < dynamicLevels.length; i++) {
            const fromLevel = dynamicLevels[i - 1];
            const toLevel = dynamicLevels[i];
            
            const transition = {
                fromLevel: fromLevel.level,
                toLevel: toLevel.level,
                startTime: fromLevel.endTime,
                endTime: toLevel.startTime,
                duration: toLevel.startTime - fromLevel.endTime,
                energyChange: toLevel.energyRange.avg - fromLevel.energyRange.avg,
                transitionType: this.classifyTransition(fromLevel.level, toLevel.level),
                smoothness: this.analyzeTransitionSmoothness(fromLevel, toLevel)
            };
            
            transitions.push(transition);
        }
        
        return transitions;
    }
    
    classifyTransition(fromLevel, toLevel) {
        const levelOrder = ['pp', 'p', 'mp', 'mf', 'f', 'ff'];
        const fromIndex = levelOrder.indexOf(fromLevel);
        const toIndex = levelOrder.indexOf(toLevel);
        const change = toIndex - fromIndex;
        
        if (change > 2) return 'sudden_increase';
        if (change > 0) return 'gradual_increase';
        if (change < -2) return 'sudden_decrease';
        if (change < 0) return 'gradual_decrease';
        return 'no_change';
    }
    
    analyzeTransitionSmoothness(fromLevel, toLevel) {
        // Analyze how smooth the transition is between dynamic levels
        const energyGap = Math.abs(toLevel.energyRange.min - fromLevel.energyRange.max);
        const maxGap = 0.3; // Maximum energy gap for smooth transition
        
        return Math.max(0, 1 - (energyGap / maxGap));
    }
    
    mapToMusicalNotation(dynamicLevels, detectedAccents) {
        const notationMappings = {
            dynamicMarkings: [],
            accentMarkings: [],
            expressionMarkings: []
        };
        
        // Map dynamic levels to notation markings
        dynamicLevels.forEach(level => {
            notationMappings.dynamicMarkings.push({
                timestamp: level.startTime,
                marking: level.level,
                description: level.marking,
                confidence: level.confidence,
                duration: level.duration
            });
        });
        
        // Map accents to notation markings
        detectedAccents.forEach(accent => {
            let notationSymbol = '>';
            
            switch (accent.type) {
                case 'sforzando':
                    notationSymbol = 'sf';
                    break;
                case 'marcato':
                    notationSymbol = '^';
                    break;
                case 'accent':
                    notationSymbol = '>';
                    break;
                case 'tenuto':
                    notationSymbol = '-';
                    break;
            }
            
            notationMappings.accentMarkings.push({
                timestamp: accent.timestamp,
                symbol: notationSymbol,
                type: accent.type,
                intensity: accent.intensity,
                confidence: accent.confidence
            });
        });
        
        return notationMappings;
    }
    
    generateDynamicSummary(dynamicLevels, detectedAccents) {
        const summary = {
            totalDynamicLevels: dynamicLevels.length,
            levelDistribution: {},
            averageLevelDuration: 0,
            totalAccents: detectedAccents.length,
            accentTypes: {},
            dynamicRange: 'unknown',
            overallDynamicCharacter: 'moderate'
        };
        
        if (dynamicLevels.length === 0) return summary;
        
        // Analyze level distribution
        dynamicLevels.forEach(level => {
            summary.levelDistribution[level.level] = (summary.levelDistribution[level.level] || 0) + 1;
        });
        
        // Calculate average duration
        summary.averageLevelDuration = dynamicLevels.reduce((sum, level) => sum + level.duration, 0) / dynamicLevels.length;
        
        // Analyze accent distribution
        detectedAccents.forEach(accent => {
            summary.accentTypes[accent.type] = (summary.accentTypes[accent.type] || 0) + 1;
        });
        
        // Determine overall dynamic range
        const levels = Object.keys(summary.levelDistribution);
        const levelOrder = ['pp', 'p', 'mp', 'mf', 'f', 'ff'];
        const usedLevelIndices = levels.map(level => levelOrder.indexOf(level)).filter(index => index !== -1);
        
        if (usedLevelIndices.length > 0) {
            const range = Math.max(...usedLevelIndices) - Math.min(...usedLevelIndices);
            if (range >= 4) summary.dynamicRange = 'wide';
            else if (range >= 2) summary.dynamicRange = 'moderate';
            else summary.dynamicRange = 'narrow';
        }
        
        // Determine overall character
        const forteLevels = (summary.levelDistribution.f || 0) + (summary.levelDistribution.ff || 0);
        const pianoLevels = (summary.levelDistribution.p || 0) + (summary.levelDistribution.pp || 0);
        const totalLevels = dynamicLevels.length;
        
        if (forteLevels / totalLevels > 0.6) {
            summary.overallDynamicCharacter = 'energetic';
        } else if (pianoLevels / totalLevels > 0.6) {
            summary.overallDynamicCharacter = 'gentle';
        } else {
            summary.overallDynamicCharacter = 'balanced';
        }
        
        return summary;
    }
    
    generateDynamicRecommendations(dynamicLevels, detectedAccents) {
        const recommendations = [];
        
        if (dynamicLevels.length === 0) {
            recommendations.push({
                category: 'dynamic_expression',
                priority: 'high',
                message: 'No dynamic variation detected - try incorporating more volume changes for musical expression'
            });
            return recommendations;
        }
        
        // Analyze dynamic range
        const summary = this.generateDynamicSummary(dynamicLevels, detectedAccents);
        
        if (summary.dynamicRange === 'narrow') {
            recommendations.push({
                category: 'dynamic_range',
                priority: 'medium',
                message: 'Limited dynamic range detected - practice singing with greater volume contrasts between loud and soft passages'
            });
        }
        
        // Check for accent usage
        if (detectedAccents.length === 0 && dynamicLevels.length > 5) {
            recommendations.push({
                category: 'accents',
                priority: 'low',
                message: 'No accents detected - consider adding emphasis to important notes or words for musical expression'
            });
        }
        
        // Check for dynamic variety
        const levelCount = Object.keys(summary.levelDistribution).length;
        if (levelCount < 3) {
            recommendations.push({
                category: 'dynamic_variety',
                priority: 'medium',
                message: 'Limited dynamic levels used - try incorporating more variety (pp, p, mp, mf, f, ff) throughout the performance'
            });
        }
        
        // Check average level duration
        if (summary.averageLevelDuration < 1.0) {
            recommendations.push({
                category: 'dynamic_stability',
                priority: 'low',
                message: 'Dynamic levels change very frequently - consider sustaining dynamics for longer phrases'
            });
        }
        
        return recommendations;
    }
    
    // Utility methods
    
    createEmptyDynamicAnalysis() {
        return {
            dynamicLevels: [],
            detectedAccents: [],
            dynamicTransitions: [],
            notationMappings: {
                dynamicMarkings: [],
                accentMarkings: [],
                expressionMarkings: []
            },
            performanceContext: {
                globalEnergyRange: { min: 0, max: 1 },
                averageEnergy: 0.5,
                energyDistribution: {},
                adaptiveThresholds: {}
            },
            summary: {
                totalDynamicLevels: 0,
                levelDistribution: {},
                averageLevelDuration: 0,
                totalAccents: 0,
                accentTypes: {},
                dynamicRange: 'unknown',
                overallDynamicCharacter: 'unknown'
            },
            recommendations: [{
                category: 'data_insufficient',
                priority: 'info',
                message: 'Insufficient audio data for dynamic analysis'
            }]
        };
    }
    
    calculateNoteAlignmentScore(level, overlappingNotes) {
        // Score how well the dynamic level aligns with note boundaries
        if (overlappingNotes.length === 0) return 0;
        
        let alignmentScore = 0;
        let alignmentCount = 0;
        
        overlappingNotes.forEach(note => {
            const noteStart = note.timestamp;
            const noteEnd = noteStart + (note.duration || 0.5);
            
            // Check alignment with note start
            const startAlignment = Math.abs(level.startTime - noteStart);
            if (startAlignment < 0.1) { // Within 100ms
                alignmentScore += 1 - (startAlignment / 0.1);
                alignmentCount++;
            }
            
            // Check alignment with note end
            const endAlignment = Math.abs(level.endTime - noteEnd);
            if (endAlignment < 0.1) { // Within 100ms
                alignmentScore += 1 - (endAlignment / 0.1);
                alignmentCount++;
            }
        });
        
        return alignmentCount > 0 ? alignmentScore / alignmentCount : 0;
    }
    
    analyzeLevelMusicalContext(level, overlappingNotes) {
        const context = {
            noteCount: overlappingNotes.length,
            averageNoteDuration: 0,
            pitchRange: { min: 0, max: 0 },
            musicalCharacter: 'unknown'
        };
        
        if (overlappingNotes.length === 0) return context;
        
        // Calculate average note duration
        const durations = overlappingNotes.map(note => note.duration || 0.5);
        context.averageNoteDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        
        // Calculate pitch range
        const frequencies = overlappingNotes.map(note => note.frequency).filter(f => f > 0);
        if (frequencies.length > 0) {
            context.pitchRange.min = Math.min(...frequencies);
            context.pitchRange.max = Math.max(...frequencies);
        }
        
        // Determine musical character
        if (context.averageNoteDuration > 1.0) {
            context.musicalCharacter = 'sustained';
        } else if (context.averageNoteDuration < 0.3) {
            context.musicalCharacter = 'articulated';
        } else {
            context.musicalCharacter = 'moderate';
        }
        
        return context;
    }
}