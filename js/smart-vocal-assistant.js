/**
 * Smart Vocal Assistant - Lightweight AI Enhancement (Phase 9 Lite)
 * 
 * Practical AI features that provide real value without complexity:
 * - Smart style detection using heuristics (no ML models to load)
 * - Intelligent error vs embellishment detection
 * - Simple chord suggestion based on melody
 * - Performance pattern recognition
 * - Adaptive feedback based on user behavior
 * 
 * Fast, lightweight, and immediately useful.
 */

class SmartVocalAssistant {
    constructor() {
        // Lightweight pattern recognition
        this.performancePatterns = {
            userPreferences: new Map(),
            commonMistakes: new Map(),
            styleIndicators: new Map(),
            sessionHistory: []
        };
        
        // Simple but effective rule-based systems
        this.styleDetectionRules = this.initializeStyleRules();
        this.errorDetectionRules = this.initializeErrorRules();
        this.chordSuggestionRules = this.initializeChordRules();
        
        // Adaptive learning (simple counters, not ML)
        this.adaptiveCounters = {
            stylePreferences: new Map(),
            errorPatterns: new Map(),
            successPatterns: new Map()
        };
        
        console.log('🧠 Smart Vocal Assistant initialized (lightweight AI)');
    }

    /**
     * Analyze performance with smart heuristics
     * @param {Object} pitchData - Pitch analysis data
     * @param {Object} harmonicData - Harmonic analysis
     * @param {Object} transcriptionData - Transcription data
     */
    analyzePerformanceSmart(pitchData, harmonicData, transcriptionData) {
        const analysis = {
            detectedStyle: this.detectStyleSmart(pitchData, harmonicData, transcriptionData),
            performanceIssues: this.detectPerformanceIssues(pitchData, transcriptionData),
            chordSuggestions: this.suggestChords(pitchData, harmonicData),
            adaptiveInsights: this.generateAdaptiveInsights(),
            practiceRecommendations: [],
            confidence: 0
        };

        // Generate practical recommendations
        analysis.practiceRecommendations = this.generatePracticeRecommendations(analysis);
        
        // Update adaptive learning
        this.updateAdaptiveLearning(analysis);
        
        analysis.confidence = this.calculateSmartConfidence(analysis);
        
        return analysis;
    }

    /**
     * Smart style detection using musical heuristics
     */
    detectStyleSmart(pitchData, harmonicData, transcriptionData) {
        const indicators = {
            hasRuns: this.detectVocalRuns(pitchData),
            hasVibrato: this.detectVibrato(pitchData),
            rhythmicComplexity: this.calculateRhythmicComplexity(transcriptionData),
            melodicRange: this.calculateMelodicRange(pitchData),
            harmonicComplexity: harmonicData?.complexity || 0
        };

        // Rule-based style detection (fast and accurate)
        let styleScores = {};

        // Gospel: lots of runs + vibrato + complex rhythm
        if (indicators.hasRuns && indicators.rhythmicComplexity > 0.6) {
            styleScores.gospel = 0.8;
        }

        // Classical: controlled vibrato + wide range + formal harmony
        if (indicators.hasVibrato && indicators.melodicRange > 2 && indicators.harmonicComplexity > 0.5) {
            styleScores.classical = 0.7;
        }

        // Pop: moderate complexity + accessible range
        if (indicators.rhythmicComplexity < 0.5 && indicators.melodicRange < 2) {
            styleScores.pop = 0.6;
        }

        // Jazz: complex harmony + moderate runs
        if (indicators.harmonicComplexity > 0.7) {
            styleScores.jazz = 0.8;
        }

        // Find best match
        const bestStyle = Object.entries(styleScores).reduce((best, [style, score]) => 
            score > best.score ? { style, score } : best, { style: 'pop', score: 0.5 });

        return {
            primaryStyle: bestStyle.style,
            confidence: bestStyle.score,
            indicators: indicators,
            alternatives: Object.entries(styleScores)
                .filter(([style]) => style !== bestStyle.style)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 2)
                .map(([style, score]) => ({ style, score }))
        };
    }

    /**
     * Intelligent error vs embellishment detection
     */
    detectPerformanceIssues(pitchData, transcriptionData) {
        const issues = {
            errors: [],
            embellishments: [],
            needsAttention: [],
            strengths: []
        };

        // Analyze pitch deviations
        for (let i = 1; i < pitchData.length; i++) {
            const prev = pitchData[i-1];
            const curr = pitchData[i];
            
            if (!prev.midiNote || !curr.midiNote) continue;
            
            const interval = Math.abs(curr.midiNote - prev.midiNote);
            const timeBetween = curr.timestamp - prev.timestamp;

            // Smart heuristics for error detection
            if (interval > 7 && timeBetween < 200) {
                // Large jump in short time - likely error unless it's intentional
                if (curr.confidence < 0.6) {
                    issues.errors.push({
                        type: 'pitch_error',
                        location: i,
                        severity: 'medium',
                        suggestion: 'Practice pitch accuracy with slower scales'
                    });
                } else {
                    // High confidence large jump - likely embellishment
                    issues.embellishments.push({
                        type: 'leap',
                        location: i,
                        quality: 'intentional_leap'
                    });
                }
            }

            // Detect runs vs errors
            if (interval <= 2 && timeBetween < 150) {
                // Fast stepwise motion - could be runs
                const runLength = this.detectRunLength(pitchData, i);
                if (runLength >= 4) {
                    issues.embellishments.push({
                        type: 'vocal_run',
                        location: i,
                        length: runLength,
                        quality: 'good'
                    });
                }
            }

            // Detect pitch instability
            if (Math.abs(interval) < 1 && curr.confidence < 0.5) {
                issues.needsAttention.push({
                    type: 'pitch_instability',
                    location: i,
                    suggestion: 'Focus on breath support for steadier pitch'
                });
            }
        }

        // Identify strengths
        if (issues.embellishments.length > 2) {
            issues.strengths.push('Good use of vocal embellishments');
        }
        
        const avgConfidence = pitchData.reduce((sum, p) => sum + (p.confidence || 0), 0) / pitchData.length;
        if (avgConfidence > 0.8) {
            issues.strengths.push('Consistent pitch accuracy');
        }

        return issues;
    }

    /**
     * Simple chord suggestions based on melody
     */
    suggestChords(pitchData, harmonicData) {
        // If we already have good harmonic analysis, use it
        if (harmonicData?.chords?.progression && harmonicData.chords.progression.length > 0) {
            return {
                source: 'harmonic_analysis',
                suggestions: harmonicData.chords.progression,
                confidence: 0.9
            };
        }

        // Simple chord suggestion based on melody notes
        const melodyNotes = pitchData
            .filter(p => p.midiNote && p.confidence > 0.6)
            .map(p => p.midiNote % 12); // Convert to pitch classes

        const chordSuggestions = [];
        const key = harmonicData?.key?.key || 'C';

        // Simple heuristic: suggest chords that contain the melody notes
        const commonProgressions = {
            'C': [
                { chord: 'C', notes: [0, 4, 7], function: 'tonic' },
                { chord: 'F', notes: [5, 9, 0], function: 'subdominant' },
                { chord: 'G', notes: [7, 11, 2], function: 'dominant' },
                { chord: 'Am', notes: [9, 0, 4], function: 'relative_minor' }
            ]
        };

        const keyChords = commonProgressions[key] || commonProgressions['C'];
        
        for (const chordInfo of keyChords) {
            const matches = melodyNotes.filter(note => chordInfo.notes.includes(note)).length;
            const score = matches / Math.max(chordInfo.notes.length, 1);
            
            if (score > 0.3) {
                chordSuggestions.push({
                    chord: chordInfo.chord,
                    function: chordInfo.function,
                    score: score,
                    reason: `Contains ${matches} melody notes`
                });
            }
        }

        return {
            source: 'melody_analysis',
            suggestions: chordSuggestions.sort((a, b) => b.score - a.score),
            confidence: 0.6
        };
    }

    /**
     * Generate adaptive insights based on user patterns
     */
    generateAdaptiveInsights() {
        const insights = [];
        
        // Check user preferences
        const preferredStyle = this.getMostFrequentStyle();
        if (preferredStyle) {
            insights.push({
                type: 'style_preference',
                message: `You often sing ${preferredStyle} style - optimizing analysis for this genre`,
                confidence: 0.8
            });
        }

        // Check common error patterns
        const commonError = this.getMostCommonError();
        if (commonError) {
            insights.push({
                type: 'improvement_opportunity',
                message: `Focus on ${commonError} - this is a recurring area for improvement`,
                confidence: 0.7
            });
        }

        // Check improvement patterns
        const improvements = this.getRecentImprovements();
        if (improvements.length > 0) {
            insights.push({
                type: 'progress',
                message: `Great progress in ${improvements.join(', ')}!`,
                confidence: 0.9
            });
        }

        return insights;
    }

    /**
     * Generate practical practice recommendations
     */
    generatePracticeRecommendations(analysis) {
        const recommendations = [];

        // Style-specific recommendations
        if (analysis.detectedStyle.primaryStyle === 'gospel') {
            recommendations.push({
                type: 'technique',
                priority: 'medium',
                message: 'Practice scales for smoother runs',
                exercises: ['Major scales', 'Pentatonic runs', 'Chromatic exercises']
            });
        } else if (analysis.detectedStyle.primaryStyle === 'classical') {
            recommendations.push({
                type: 'technique',
                priority: 'high',
                message: 'Focus on breath support for sustained phrases',
                exercises: ['Long tones', 'Messa di voce', 'Lip trills']
            });
        }

        // Error-based recommendations
        if (analysis.performanceIssues.errors.length > 0) {
            const errorTypes = analysis.performanceIssues.errors.map(e => e.type);
            const mostCommon = this.findMostCommon(errorTypes);
            
            if (mostCommon === 'pitch_error') {
                recommendations.push({
                    type: 'accuracy',
                    priority: 'high',
                    message: 'Improve pitch accuracy with interval training',
                    exercises: ['Perfect 5ths', 'Octave jumps', 'Chromatic scales']
                });
            }
        }

        // Strength-based encouragement
        if (analysis.performanceIssues.strengths.length > 0) {
            recommendations.push({
                type: 'encouragement',
                priority: 'low',
                message: `Keep up the great work: ${analysis.performanceIssues.strengths.join(', ')}`,
                exercises: ['Continue current practice routine']
            });
        }

        return recommendations;
    }

    /**
     * Update simple adaptive learning
     */
    updateAdaptiveLearning(analysis) {
        // Update style preferences
        const style = analysis.detectedStyle.primaryStyle;
        this.adaptiveCounters.stylePreferences.set(
            style,
            (this.adaptiveCounters.stylePreferences.get(style) || 0) + 1
        );

        // Update error patterns
        analysis.performanceIssues.errors.forEach(error => {
            this.adaptiveCounters.errorPatterns.set(
                error.type,
                (this.adaptiveCounters.errorPatterns.get(error.type) || 0) + 1
            );
        });

        // Update success patterns
        analysis.performanceIssues.strengths.forEach(strength => {
            this.adaptiveCounters.successPatterns.set(
                strength,
                (this.adaptiveCounters.successPatterns.get(strength) || 0) + 1
            );
        });

        // Keep session history lightweight (last 20 sessions)
        this.performancePatterns.sessionHistory.push({
            timestamp: Date.now(),
            style: style,
            errorCount: analysis.performanceIssues.errors.length,
            strengthCount: analysis.performanceIssues.strengths.length
        });

        if (this.performancePatterns.sessionHistory.length > 20) {
            this.performancePatterns.sessionHistory.shift();
        }
    }

    // Utility methods for smart analysis (lightweight and fast)
    
    detectVocalRuns(pitchData) {
        let runCount = 0;
        for (let i = 3; i < pitchData.length; i++) {
            const isRun = this.detectRunLength(pitchData, i) >= 4;
            if (isRun) runCount++;
        }
        return runCount > 2; // Has multiple runs
    }

    detectRunLength(pitchData, startIndex) {
        let length = 1;
        for (let i = startIndex + 1; i < pitchData.length; i++) {
            const prev = pitchData[i-1];
            const curr = pitchData[i];
            
            if (prev.midiNote && curr.midiNote) {
                const interval = Math.abs(curr.midiNote - prev.midiNote);
                const timeBetween = curr.timestamp - prev.timestamp;
                
                if (interval <= 2 && timeBetween < 200) {
                    length++;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        return length;
    }

    detectVibrato(pitchData) {
        // Simple vibrato detection - look for regular pitch oscillations
        let oscillations = 0;
        for (let i = 2; i < pitchData.length - 2; i++) {
            const prev = pitchData[i-1];
            const curr = pitchData[i];
            const next = pitchData[i+1];
            
            if (prev.midiNote && curr.midiNote && next.midiNote) {
                // Check for oscillation pattern
                const up = curr.midiNote > prev.midiNote;
                const down = next.midiNote < curr.midiNote;
                if ((up && down) || (!up && !down)) {
                    oscillations++;
                }
            }
        }
        return oscillations > pitchData.length * 0.1; // 10% oscillation rate
    }

    calculateRhythmicComplexity(transcriptionData) {
        // Simple rhythmic complexity based on syllable timing
        if (!transcriptionData?.syllables || transcriptionData.syllables.length < 2) return 0;
        
        const intervals = [];
        for (let i = 1; i < transcriptionData.syllables.length; i++) {
            const prev = transcriptionData.syllables[i-1];
            const curr = transcriptionData.syllables[i];
            if (prev.timing && curr.timing) {
                intervals.push(curr.timing - prev.timing);
            }
        }
        
        if (intervals.length === 0) return 0;
        
        // Calculate variance in timing intervals
        const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
        
        return Math.min(1.0, variance / 10000); // Normalize to 0-1
    }

    calculateMelodicRange(pitchData) {
        const midiNotes = pitchData
            .filter(p => p.midiNote && p.confidence > 0.5)
            .map(p => p.midiNote);
        
        if (midiNotes.length === 0) return 0;
        
        const lowest = Math.min(...midiNotes);
        const highest = Math.max(...midiNotes);
        
        return (highest - lowest) / 12; // Range in octaves
    }

    calculateSmartConfidence(analysis) {
        let confidence = 0;
        let factors = 0;

        if (analysis.detectedStyle.confidence > 0) {
            confidence += analysis.detectedStyle.confidence;
            factors++;
        }

        if (analysis.chordSuggestions.confidence > 0) {
            confidence += analysis.chordSuggestions.confidence;
            factors++;
        }

        if (analysis.performanceIssues.strengths.length > 0) {
            confidence += 0.8;
            factors++;
        }

        return factors > 0 ? confidence / factors : 0.5;
    }

    getMostFrequentStyle() {
        let mostFrequent = null;
        let maxCount = 0;
        
        for (const [style, count] of this.adaptiveCounters.stylePreferences) {
            if (count > maxCount) {
                maxCount = count;
                mostFrequent = style;
            }
        }
        
        return maxCount > 2 ? mostFrequent : null; // Need at least 3 occurrences
    }

    getMostCommonError() {
        let mostCommon = null;
        let maxCount = 0;
        
        for (const [error, count] of this.adaptiveCounters.errorPatterns) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = error;
            }
        }
        
        return maxCount > 2 ? mostCommon : null;
    }

    getRecentImprovements() {
        // Look at recent sessions vs earlier ones
        if (this.performancePatterns.sessionHistory.length < 6) return [];
        
        const recent = this.performancePatterns.sessionHistory.slice(-3);
        const earlier = this.performancePatterns.sessionHistory.slice(0, 3);
        
        const improvements = [];
        
        const recentAvgErrors = recent.reduce((sum, s) => sum + s.errorCount, 0) / recent.length;
        const earlierAvgErrors = earlier.reduce((sum, s) => sum + s.errorCount, 0) / earlier.length;
        
        if (earlierAvgErrors > recentAvgErrors + 0.5) {
            improvements.push('pitch accuracy');
        }
        
        const recentAvgStrengths = recent.reduce((sum, s) => sum + s.strengthCount, 0) / recent.length;
        const earlierAvgStrengths = earlier.reduce((sum, s) => sum + s.strengthCount, 0) / earlier.length;
        
        if (recentAvgStrengths > earlierAvgStrengths + 0.5) {
            improvements.push('overall technique');
        }
        
        return improvements;
    }

    findMostCommon(array) {
        const counts = {};
        let mostCommon = null;
        let maxCount = 0;
        
        for (const item of array) {
            counts[item] = (counts[item] || 0) + 1;
            if (counts[item] > maxCount) {
                maxCount = counts[item];
                mostCommon = item;
            }
        }
        
        return mostCommon;
    }

    // Initialize simple rule sets
    initializeStyleRules() {
        return {
            gospel: { runs: true, rhythmComplexity: '>0.6', vibrato: true },
            classical: { vibrato: true, range: '>2', harmony: '>0.5' },
            pop: { rhythmComplexity: '<0.5', range: '<2', accessibility: true },
            jazz: { harmonyComplexity: '>0.7', syncopation: true }
        };
    }

    initializeErrorRules() {
        return {
            pitch_error: { interval: '>7', time: '<200', confidence: '<0.6' },
            rhythm_error: { timing_deviation: '>100', pattern: 'inconsistent' }
        };
    }

    initializeChordRules() {
        return {
            tonic_indicators: [0, 4, 7], // C major triad
            dominant_indicators: [7, 11, 2], // G major triad
            subdominant_indicators: [5, 9, 0] // F major triad
        };
    }

    /**
     * Get smart assistant status
     */
    getSmartAssistantStatus() {
        return {
            systemType: 'lightweight_ai',
            loadTime: 'instant',
            memoryUsage: 'minimal',
            features: {
                styleDetection: 'heuristic_based',
                errorDetection: 'rule_based',
                chordSuggestion: 'melody_analysis',
                adaptiveLearning: 'simple_counters'
            },
            performanceData: {
                sessionHistory: this.performancePatterns.sessionHistory.length,
                stylePreferences: this.adaptiveCounters.stylePreferences.size,
                learningData: this.adaptiveCounters.errorPatterns.size
            },
            advantages: [
                'Instant loading',
                'Low memory usage', 
                'Fast analysis',
                'Practical insights',
                'No model downloads'
            ]
        };
    }
}