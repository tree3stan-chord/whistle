/**
 * Rubato and Tempo Flexibility Detector
 * Analyzes expressive timing variations: rubato, ritardando, accelerando
 * Detects musical phrasing through tempo manipulation and timing flexibility
 */

class RubatoTempoDetector {
    constructor() {
        // Analysis parameters
        this.tempoConfig = {
            detection: {
                minTempoChange: 0.1, // 10% tempo change minimum
                maxTempoChange: 0.8, // 80% tempo change maximum (beyond this is likely error)
                minDuration: 1.0, // seconds - minimum duration for tempo analysis
                smoothingWindow: 2.0, // seconds for tempo smoothing
                confidenceThreshold: 0.6 // minimum confidence for tempo detection
            },
            
            classification: {
                // Tempo change types
                accelerando: { tempoIncrease: [0.15, 1.0], duration: [2, 15] },
                ritardando: { tempoDecrease: [0.15, 1.0], duration: [2, 15] },
                rubato: { tempoVariation: [0.1, 0.4], flexibility: [0.3, 1.0] },
                agogic: { noteExtension: [1.2, 3.0], selectivity: [0.2, 0.8] }, // Selective note lengthening
                
                // Speed classifications
                subtle: { changeRange: [0.1, 0.25] },
                moderate: { changeRange: [0.25, 0.5] },
                pronounced: { changeRange: [0.5, 0.8] }
            }
        };
        
        // Musical context parameters
        this.musicalContext = {
            phraseEndDetection: true,
            cadentialRitardando: true,
            expressiveAcceleration: true,
            structuralTempo: true
        };
        
        // Analysis state
        this.tempoHistory = [];
        this.rubatoSegments = [];
        this.baseTempoEstimate = 0;
    }
    
    async analyzeRubatoAndTempo(forensicData, noteEvents = null, transcriptionData = null) {
        console.log('Analyzing rubato and tempo flexibility...');
        
        if (!noteEvents || noteEvents.length < 5) {
            return this.createEmptyTempoAnalysis('Insufficient note events for tempo analysis');
        }
        
        // 1. Calculate inter-onset intervals (IOIs) between notes
        const interOnsetIntervals = this.calculateInterOnsetIntervals(noteEvents);
        
        // 2. Estimate base tempo and tempo variations
        const tempoAnalysis = this.analyzeTempoVariations(interOnsetIntervals);
        
        // 3. Detect tempo change patterns (accelerando/ritardando)
        const tempoChanges = this.detectTempoChanges(tempoAnalysis.tempoSequence);
        
        // 4. Analyze rubato patterns (flexible timing)
        const rubatoPatterns = this.analyzeRubatoPatterns(tempoAnalysis.tempoSequence, noteEvents);
        
        // 5. Detect agogic accents (selective note lengthening)
        const agogicAccents = this.detectAgogicAccents(interOnsetIntervals, noteEvents);
        
        // 6. Analyze musical context for tempo changes
        const contextualAnalysis = this.analyzeMusicalContext(
            tempoChanges, 
            rubatoPatterns, 
            transcriptionData
        );
        
        return {
            baseTempoEstimate: tempoAnalysis.baseTempo,
            tempoSequence: tempoAnalysis.tempoSequence,
            tempoChanges,
            rubatoPatterns,
            agogicAccents,
            contextualAnalysis,
            summary: this.generateTempoSummary(tempoChanges, rubatoPatterns, agogicAccents),
            recommendations: this.generateTempoRecommendations(tempoChanges, rubatoPatterns),
            analysisMetadata: {
                totalNotes: noteEvents.length,
                analysisSpan: noteEvents[noteEvents.length - 1].timestamp - noteEvents[0].timestamp,
                tempoStability: tempoAnalysis.stability
            }
        };
    }
    
    calculateInterOnsetIntervals(noteEvents) {
        const intervals = [];
        
        for (let i = 1; i < noteEvents.length; i++) {
            const prevNote = noteEvents[i - 1];
            const currentNote = noteEvents[i];
            
            const ioi = currentNote.timestamp - prevNote.timestamp;
            const noteDuration = currentNote.duration || 0.5;
            
            intervals.push({
                startNoteIndex: i - 1,
                endNoteIndex: i,
                startTime: prevNote.timestamp,
                endTime: currentNote.timestamp,
                interval: ioi,
                noteDuration: noteDuration,
                gapRatio: (ioi - noteDuration) / Math.max(noteDuration, 0.1), // How much gap vs. note length
                startNote: prevNote,
                endNote: currentNote
            });
        }
        
        return intervals;
    }
    
    analyzeTempoVariations(interOnsetIntervals) {
        if (interOnsetIntervals.length === 0) {
            return { baseTempo: 120, tempoSequence: [], stability: 0 };
        }
        
        // Convert IOIs to instantaneous tempo estimates
        const tempoSequence = interOnsetIntervals.map(ioi => {
            const beatsPerSecond = 1 / Math.max(ioi.interval, 0.1); // Prevent division by zero
            const bpm = beatsPerSecond * 60;
            
            return {
                timestamp: (ioi.startTime + ioi.endTime) / 2,
                bpm: Math.min(300, Math.max(40, bpm)), // Clamp to reasonable range
                ioi: ioi.interval,
                confidence: this.calculateTempoConfidence(ioi, interOnsetIntervals)
            };
        });
        
        // Smooth tempo sequence to reduce noise
        const smoothedTempoSequence = this.smoothTempoSequence(tempoSequence);
        
        // Estimate base tempo (median of stable sections)
        const stableTempos = smoothedTempoSequence.filter(t => t.confidence > 0.7);
        const baseTempo = stableTempos.length > 0 ?
            this.calculateMedian(stableTempos.map(t => t.bpm)) :
            this.calculateMedian(smoothedTempoSequence.map(t => t.bpm));
        
        // Calculate tempo stability
        const stability = this.calculateTempoStability(smoothedTempoSequence, baseTempo);
        
        return {
            baseTempo,
            tempoSequence: smoothedTempoSequence,
            stability
        };
    }
    
    calculateTempoConfidence(ioi, allIntervals) {
        // Confidence based on how consistent this IOI is with neighbors
        const windowSize = 2;
        const startIndex = Math.max(0, allIntervals.indexOf(ioi) - windowSize);
        const endIndex = Math.min(allIntervals.length, allIntervals.indexOf(ioi) + windowSize + 1);
        
        const neighborIntervals = allIntervals.slice(startIndex, endIndex)
            .map(interval => interval.interval);
        
        const meanInterval = neighborIntervals.reduce((sum, int) => sum + int, 0) / neighborIntervals.length;
        const variance = neighborIntervals.reduce((sum, int) => sum + Math.pow(int - meanInterval, 2), 0) / neighborIntervals.length;
        const cv = Math.sqrt(variance) / meanInterval;
        
        // Higher confidence for lower coefficient of variation
        return Math.max(0, Math.min(1, 1 - cv));
    }
    
    smoothTempoSequence(tempoSequence) {
        const windowSize = 3;
        const smoothed = [];
        
        for (let i = 0; i < tempoSequence.length; i++) {
            const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
            const windowEnd = Math.min(tempoSequence.length, i + Math.floor(windowSize / 2) + 1);
            
            const window = tempoSequence.slice(windowStart, windowEnd);
            const avgBpm = window.reduce((sum, t) => sum + t.bpm, 0) / window.length;
            const avgConfidence = window.reduce((sum, t) => sum + t.confidence, 0) / window.length;
            
            smoothed.push({
                timestamp: tempoSequence[i].timestamp,
                bpm: avgBpm,
                ioi: tempoSequence[i].ioi,
                confidence: avgConfidence,
                rawBpm: tempoSequence[i].bpm
            });
        }
        
        return smoothed;
    }
    
    calculateTempoStability(tempoSequence, baseTempo) {
        if (tempoSequence.length === 0) return 0;
        
        const deviations = tempoSequence.map(t => Math.abs(t.bpm - baseTempo) / baseTempo);
        const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
        
        return Math.max(0, 1 - avgDeviation * 2); // Stability score 0-1
    }
    
    detectTempoChanges(tempoSequence) {
        const tempoChanges = [];
        
        if (tempoSequence.length < 5) return tempoChanges;
        
        let currentChange = null;
        const baseTempo = this.calculateMedian(tempoSequence.map(t => t.bpm));
        
        for (let i = 2; i < tempoSequence.length - 2; i++) {
            const tempo = tempoSequence[i];
            const relativeChange = (tempo.bpm - baseTempo) / baseTempo;
            
            // Detect start of tempo change
            if (Math.abs(relativeChange) > this.tempoConfig.detection.minTempoChange && !currentChange) {
                currentChange = {
                    startTime: tempo.timestamp,
                    startIndex: i,
                    startTempo: tempo.bpm,
                    direction: relativeChange > 0 ? 'accelerando' : 'ritardando',
                    maxChange: Math.abs(relativeChange),
                    tempoPoints: [tempo]
                };
            } 
            // Continue current tempo change
            else if (currentChange && this.isSameDirection(currentChange.direction, relativeChange)) {
                currentChange.tempoPoints.push(tempo);
                currentChange.maxChange = Math.max(currentChange.maxChange, Math.abs(relativeChange));
                currentChange.endTime = tempo.timestamp;
                currentChange.endIndex = i;
                currentChange.endTempo = tempo.bpm;
            }
            // End current tempo change
            else if (currentChange) {
                currentChange.duration = currentChange.endTime - currentChange.startTime;
                currentChange.totalChange = (currentChange.endTempo - currentChange.startTempo) / currentChange.startTempo;
                
                // Validate and classify tempo change
                if (this.validateTempoChange(currentChange)) {
                    currentChange.classification = this.classifyTempoChange(currentChange);
                    tempoChanges.push(currentChange);
                }
                
                currentChange = null;
            }
        }
        
        // Handle final tempo change
        if (currentChange && currentChange.tempoPoints.length >= 3) {
            currentChange.duration = currentChange.endTime - currentChange.startTime;
            currentChange.totalChange = (currentChange.endTempo - currentChange.startTempo) / currentChange.startTempo;
            
            if (this.validateTempoChange(currentChange)) {
                currentChange.classification = this.classifyTempoChange(currentChange);
                tempoChanges.push(currentChange);
            }
        }
        
        return tempoChanges;
    }
    
    isSameDirection(changeDirection, relativeChange) {
        return (changeDirection === 'accelerando' && relativeChange > 0) ||
               (changeDirection === 'ritardando' && relativeChange < 0);
    }
    
    validateTempoChange(change) {
        const config = this.tempoConfig.detection;
        
        return change.duration >= config.minDuration &&
               Math.abs(change.totalChange) >= config.minTempoChange &&
               Math.abs(change.totalChange) <= config.maxTempoChange &&
               change.tempoPoints.length >= 3;
    }
    
    classifyTempoChange(change) {
        const classification = {
            type: change.direction,
            strength: 'moderate',
            quality: 'good',
            musicalCharacter: 'expressive'
        };
        
        // Classify strength
        const absChange = Math.abs(change.totalChange);
        if (absChange <= 0.25) {
            classification.strength = 'subtle';
        } else if (absChange <= 0.5) {
            classification.strength = 'moderate';
        } else {
            classification.strength = 'pronounced';
        }
        
        // Assess quality based on smoothness
        const smoothness = this.calculateTempoChangeSmoothness(change.tempoPoints);
        if (smoothness >= 0.8) {
            classification.quality = 'excellent';
        } else if (smoothness >= 0.6) {
            classification.quality = 'good';
        } else if (smoothness >= 0.4) {
            classification.quality = 'adequate';
        } else {
            classification.quality = 'choppy';
        }
        
        // Determine musical character
        if (change.direction === 'ritardando' && change.duration > 5) {
            classification.musicalCharacter = 'phrase_ending';
        } else if (change.direction === 'accelerando' && classification.strength === 'pronounced') {
            classification.musicalCharacter = 'dramatic';
        } else {
            classification.musicalCharacter = 'expressive';
        }
        
        return classification;
    }
    
    calculateTempoChangeSmoothness(tempoPoints) {
        if (tempoPoints.length < 3) return 1;
        
        // Calculate smoothness based on tempo curve consistency
        let totalVariation = 0;
        let expectedVariation = 0;
        
        for (let i = 2; i < tempoPoints.length; i++) {
            // Second derivative approximation
            const accel1 = tempoPoints[i - 1].bpm - tempoPoints[i - 2].bpm;
            const accel2 = tempoPoints[i].bpm - tempoPoints[i - 1].bpm;
            const acceleration = accel2 - accel1;
            
            totalVariation += Math.abs(acceleration);
            expectedVariation += Math.abs(accel1); // What we'd expect for smooth change
        }
        
        return expectedVariation > 0 ? Math.max(0, 1 - totalVariation / expectedVariation) : 0.5;
    }
    
    analyzeRubatoPatterns(tempoSequence, noteEvents) {
        const rubatoPatterns = [];
        
        if (tempoSequence.length < 10) return rubatoPatterns;
        
        // Find sections with flexible timing (moderate tempo variations)
        const windowSize = 5; // Analyze rubato in 5-note windows
        
        for (let i = 0; i <= tempoSequence.length - windowSize; i++) {
            const window = tempoSequence.slice(i, i + windowSize);
            const rubatoAnalysis = this.analyzeRubatoInWindow(window, noteEvents, i);
            
            if (rubatoAnalysis.hasRubato) {
                rubatoPatterns.push(rubatoAnalysis);
            }
        }
        
        // Merge overlapping rubato sections
        return this.mergeOverlappingRubato(rubatoPatterns);
    }
    
    analyzeRubatoInWindow(window, noteEvents, startIndex) {
        const analysis = {
            hasRubato: false,
            startTime: window[0].timestamp,
            endTime: window[window.length - 1].timestamp,
            duration: window[window.length - 1].timestamp - window[0].timestamp,
            flexibility: 0,
            patterns: [],
            quality: 'adequate'
        };
        
        // Calculate tempo flexibility within window
        const tempos = window.map(w => w.bpm);
        const meanTempo = tempos.reduce((sum, t) => sum + t, 0) / tempos.length;
        const maxDeviation = Math.max(...tempos.map(t => Math.abs(t - meanTempo) / meanTempo));
        
        analysis.flexibility = maxDeviation;
        
        // Check if this qualifies as rubato
        if (analysis.flexibility >= this.tempoConfig.classification.rubato.tempoVariation[0] &&
            analysis.flexibility <= this.tempoConfig.classification.rubato.tempoVariation[1]) {
            
            analysis.hasRubato = true;
            
            // Analyze rubato patterns within the window
            analysis.patterns = this.identifyRubatoPatterns(window);
            
            // Assess rubato quality
            analysis.quality = this.assessRubatoQuality(window, analysis.patterns);
            
            // Classify rubato type
            analysis.type = this.classifyRubatoType(analysis);
        }
        
        return analysis;
    }
    
    identifyRubatoPatterns(tempoWindow) {
        const patterns = [];
        
        // Look for common rubato patterns
        const tempos = tempoWindow.map(w => w.bpm);
        
        // Pattern 1: Push and pull (accelerate then slow)
        if (this.detectPushAndPull(tempos)) {
            patterns.push({ type: 'push_and_pull', description: 'Accelerate then slow down' });
        }
        
        // Pattern 2: Hesitation (slow then quick recovery)
        if (this.detectHesitation(tempos)) {
            patterns.push({ type: 'hesitation', description: 'Slow down then speed up' });
        }
        
        // Pattern 3: Flexible phrasing (varied timing)
        if (this.detectFlexiblePhrasing(tempos)) {
            patterns.push({ type: 'flexible_phrasing', description: 'Varied timing for expression' });
        }
        
        return patterns;
    }
    
    detectPushAndPull(tempos) {
        if (tempos.length < 4) return false;
        
        // Look for acceleration followed by deceleration
        const midpoint = Math.floor(tempos.length / 2);
        const firstHalf = tempos.slice(0, midpoint);
        const secondHalf = tempos.slice(midpoint);
        
        const firstTrend = this.calculateTempoTrend(firstHalf);
        const secondTrend = this.calculateTempoTrend(secondHalf);
        
        return firstTrend > 0.05 && secondTrend < -0.05; // Acceleration then deceleration
    }
    
    detectHesitation(tempos) {
        if (tempos.length < 4) return false;
        
        const midpoint = Math.floor(tempos.length / 2);
        const firstHalf = tempos.slice(0, midpoint);
        const secondHalf = tempos.slice(midpoint);
        
        const firstTrend = this.calculateTempoTrend(firstHalf);
        const secondTrend = this.calculateTempoTrend(secondHalf);
        
        return firstTrend < -0.05 && secondTrend > 0.05; // Slow down then speed up
    }
    
    detectFlexiblePhrasing(tempos) {
        // Check for moderate tempo variation throughout
        const variance = this.calculateVariance(tempos);
        const mean = tempos.reduce((sum, t) => sum + t, 0) / tempos.length;
        const cv = Math.sqrt(variance) / mean;
        
        return cv >= 0.1 && cv <= 0.3; // Moderate but not excessive variation
    }
    
    calculateTempoTrend(tempos) {
        if (tempos.length < 2) return 0;
        
        // Simple linear trend calculation
        const n = tempos.length;
        const indices = Array.from({length: n}, (_, i) => i);
        
        const meanIndex = indices.reduce((sum, i) => sum + i, 0) / n;
        const meanTempo = tempos.reduce((sum, t) => sum + t, 0) / n;
        
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < n; i++) {
            numerator += (indices[i] - meanIndex) * (tempos[i] - meanTempo);
            denominator += Math.pow(indices[i] - meanIndex, 2);
        }
        
        return denominator !== 0 ? numerator / denominator : 0;
    }
    
    detectAgogicAccents(interOnsetIntervals, noteEvents) {
        const agogicAccents = [];
        
        // Calculate expected note durations based on context
        interOnsetIntervals.forEach((ioi, index) => {
            const expectedDuration = this.calculateExpectedNoteDuration(ioi, interOnsetIntervals, index);
            const actualDuration = ioi.noteDuration;
            const lengtheningRatio = actualDuration / expectedDuration;
            
            // Check if note is significantly lengthened
            if (lengtheningRatio >= this.tempoConfig.classification.agogic.noteExtension[0]) {
                agogicAccents.push({
                    noteIndex: ioi.endNoteIndex,
                    timestamp: ioi.endTime,
                    expectedDuration,
                    actualDuration,
                    lengtheningRatio,
                    intensity: Math.min(1, (lengtheningRatio - 1) / 2), // Normalize intensity
                    confidence: this.calculateAgogicConfidence(lengtheningRatio, expectedDuration),
                    musicalContext: this.analyzeAgogicContext(ioi, noteEvents)
                });
            }
        });
        
        return agogicAccents;
    }
    
    calculateExpectedNoteDuration(currentIoi, allIntervals, index) {
        // Calculate expected duration based on neighboring intervals
        const windowSize = 2;
        const startIndex = Math.max(0, index - windowSize);
        const endIndex = Math.min(allIntervals.length, index + windowSize + 1);
        
        const contextIntervals = allIntervals.slice(startIndex, endIndex)
            .filter((_, i) => i !== index - startIndex); // Exclude current interval
        
        if (contextIntervals.length === 0) {
            return currentIoi.noteDuration; // Fallback to actual duration
        }
        
        const avgDuration = contextIntervals.reduce((sum, ioi) => sum + ioi.noteDuration, 0) / contextIntervals.length;
        return avgDuration;
    }
    
    calculateAgogicConfidence(lengtheningRatio, expectedDuration) {
        // Higher confidence for more significant lengthening and longer expected durations
        const significanceScore = Math.min(1, (lengtheningRatio - 1) / 1.5);
        const durationScore = Math.min(1, expectedDuration / 1.0); // Favor longer base durations
        
        return (significanceScore + durationScore) / 2;
    }
    
    analyzeAgogicContext(ioi, noteEvents) {
        // Analyze musical context for agogic accent
        const context = {
            position: 'middle',
            intervalSize: 0,
            phrasePosition: 'internal'
        };
        
        // Determine position in phrase (beginning, middle, end)
        const noteIndex = ioi.endNoteIndex;
        const totalNotes = noteEvents.length;
        
        if (noteIndex < totalNotes * 0.2) {
            context.position = 'beginning';
        } else if (noteIndex > totalNotes * 0.8) {
            context.position = 'end';
        } else {
            context.position = 'middle';
        }
        
        // Calculate interval size to this note
        if (ioi.startNote.frequency && ioi.endNote.frequency) {
            const cents = 1200 * Math.log2(ioi.endNote.frequency / ioi.startNote.frequency);
            context.intervalSize = Math.abs(cents);
        }
        
        return context;
    }
    
    analyzeMusicalContext(tempoChanges, rubatoPatterns, transcriptionData) {
        const contextualAnalysis = {
            phraseRelatedChanges: 0,
            expressiveChanges: 0,
            structuralChanges: 0,
            overallMusicalLogic: 'moderate'
        };
        
        // Analyze tempo changes in musical context
        tempoChanges.forEach(change => {
            if (change.classification.musicalCharacter === 'phrase_ending') {
                contextualAnalysis.phraseRelatedChanges++;
            } else if (change.classification.musicalCharacter === 'expressive') {
                contextualAnalysis.expressiveChanges++;
            } else if (change.classification.musicalCharacter === 'dramatic') {
                contextualAnalysis.structuralChanges++;
            }
        });
        
        // Assess overall musical logic
        const totalChanges = tempoChanges.length + rubatoPatterns.length;
        if (totalChanges === 0) {
            contextualAnalysis.overallMusicalLogic = 'stable';
        } else {
            const expressiveRatio = (contextualAnalysis.expressiveChanges + contextualAnalysis.phraseRelatedChanges) / totalChanges;
            
            if (expressiveRatio > 0.7) {
                contextualAnalysis.overallMusicalLogic = 'highly_expressive';
            } else if (expressiveRatio > 0.4) {
                contextualAnalysis.overallMusicalLogic = 'moderately_expressive';
            } else {
                contextualAnalysis.overallMusicalLogic = 'mechanical';
            }
        }
        
        return contextualAnalysis;
    }
    
    generateTempoSummary(tempoChanges, rubatoPatterns, agogicAccents) {
        return {
            totalTempoChanges: tempoChanges.length,
            accelerandoCount: tempoChanges.filter(t => t.direction === 'accelerando').length,
            ritardandoCount: tempoChanges.filter(t => t.direction === 'ritardando').length,
            rubatoSections: rubatoPatterns.length,
            agogicAccents: agogicAccents.length,
            overallFlexibility: this.calculateOverallFlexibility(tempoChanges, rubatoPatterns),
            tempoCharacter: this.determineTempoCharacter(tempoChanges, rubatoPatterns)
        };
    }
    
    calculateOverallFlexibility(tempoChanges, rubatoPatterns) {
        let flexibilityScore = 0;
        let totalWeight = 0;
        
        // Weight tempo changes
        tempoChanges.forEach(change => {
            const changeWeight = Math.abs(change.totalChange);
            flexibilityScore += changeWeight * 0.7;
            totalWeight += changeWeight;
        });
        
        // Weight rubato patterns
        rubatoPatterns.forEach(rubato => {
            const rubatoWeight = rubato.flexibility;
            flexibilityScore += rubatoWeight * 0.3;
            totalWeight += rubatoWeight;
        });
        
        return totalWeight > 0 ? Math.min(1, flexibilityScore / totalWeight) : 0;
    }
    
    determineTempoCharacter(tempoChanges, rubatoPatterns) {
        const totalChanges = tempoChanges.length + rubatoPatterns.length;
        
        if (totalChanges === 0) return 'strict';
        if (totalChanges >= 5) return 'highly_flexible';
        if (totalChanges >= 2) return 'expressive';
        return 'moderate';
    }
    
    generateTempoRecommendations(tempoChanges, rubatoPatterns) {
        const recommendations = [];
        
        if (tempoChanges.length === 0 && rubatoPatterns.length === 0) {
            recommendations.push({
                category: 'tempo_expression',
                priority: 'medium',
                message: 'No tempo flexibility detected - consider adding rubato or tempo changes for musical expression'
            });
        } else {
            // Check balance of accelerando vs ritardando
            const accelerandos = tempoChanges.filter(t => t.direction === 'accelerando');
            const ritardandos = tempoChanges.filter(t => t.direction === 'ritardando');
            
            if (accelerandos.length > 0 && ritardandos.length === 0) {
                recommendations.push({
                    category: 'tempo_balance',
                    priority: 'low',
                    message: 'Only accelerando detected - consider adding ritardando for phrase endings'
                });
            } else if (ritardandos.length > 0 && accelerandos.length === 0) {
                recommendations.push({
                    category: 'tempo_balance',
                    priority: 'low',
                    message: 'Only ritardando detected - consider adding accelerando for dramatic effect'
                });
            }
            
            // Check quality of tempo changes
            const poorQualityChanges = tempoChanges.filter(t => t.classification.quality === 'choppy');
            if (poorQualityChanges.length > 0) {
                recommendations.push({
                    category: 'tempo_quality',
                    priority: 'medium',
                    message: 'Some tempo changes lack smoothness - practice gradual tempo transitions'
                });
            }
        }
        
        return recommendations;
    }
    
    // Utility methods
    
    createEmptyTempoAnalysis(reason = 'No tempo analysis performed') {
        return {
            baseTempoEstimate: 0,
            tempoSequence: [],
            tempoChanges: [],
            rubatoPatterns: [],
            agogicAccents: [],
            contextualAnalysis: {
                phraseRelatedChanges: 0,
                expressiveChanges: 0,
                structuralChanges: 0,
                overallMusicalLogic: 'unknown'
            },
            summary: {
                totalTempoChanges: 0,
                accelerandoCount: 0,
                ritardandoCount: 0,
                rubatoSections: 0,
                agogicAccents: 0,
                overallFlexibility: 0,
                tempoCharacter: 'unknown'
            },
            recommendations: [{
                category: 'data_insufficient',
                priority: 'info',
                message: reason
            }],
            analysisMetadata: {
                totalNotes: 0,
                analysisSpan: 0,
                tempoStability: 0
            }
        };
    }
    
    calculateMedian(values) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        } else {
            return sorted[middle];
        }
    }
    
    calculateVariance(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    }
    
    mergeOverlappingRubato(rubatoPatterns) {
        if (rubatoPatterns.length <= 1) return rubatoPatterns;
        
        const merged = [];
        let current = rubatoPatterns[0];
        
        for (let i = 1; i < rubatoPatterns.length; i++) {
            const next = rubatoPatterns[i];
            
            // Check for overlap
            if (next.startTime <= current.endTime + 1.0) { // 1 second tolerance
                // Merge patterns
                current = {
                    hasRubato: true,
                    startTime: current.startTime,
                    endTime: Math.max(current.endTime, next.endTime),
                    duration: Math.max(current.endTime, next.endTime) - current.startTime,
                    flexibility: Math.max(current.flexibility, next.flexibility),
                    patterns: [...current.patterns, ...next.patterns],
                    quality: current.quality === 'excellent' || next.quality === 'excellent' ? 'excellent' : 'good'
                };
            } else {
                merged.push(current);
                current = next;
            }
        }
        
        merged.push(current);
        return merged;
    }
    
    assessRubatoQuality(tempoWindow, patterns) {
        // Assess quality based on smoothness and musical logic
        const smoothness = this.calculateTempoChangeSmoothness(tempoWindow);
        const patternCount = patterns.length;
        
        if (smoothness >= 0.8 && patternCount > 0) {
            return 'excellent';
        } else if (smoothness >= 0.6 || patternCount > 0) {
            return 'good';
        } else {
            return 'adequate';
        }
    }
    
    classifyRubatoType(analysis) {
        if (analysis.flexibility > 0.3) {
            return 'expressive';
        } else if (analysis.flexibility > 0.2) {
            return 'moderate';
        } else {
            return 'subtle';
        }
    }
}