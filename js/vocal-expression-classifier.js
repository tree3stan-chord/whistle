/**
 * Vocal Expression Classifier Engine
 * Master classifier that combines all articulation analyses into comprehensive vocal performance assessment
 * Provides holistic evaluation of vocal technique, musicianship, and expression
 */

class VocalExpressionClassifier {
    constructor() {
        // Initialize component analyzers
        this.vibratoAnalyzer = new AdvancedVibratoAnalyzer();
        this.connectionDetector = new ArticulationConnectionDetector();
        this.breathingAnalyzer = new BreathingPatternAnalyzer();
        this.dynamicDetector = new DynamicAccentDetector();
        this.crescendoAnalyzer = new CrescendoDiminuendoAnalyzer();
        this.rubatoDetector = new RubatoTempoDetector();
        
        // Expression classification models
        this.expressionModels = {
            // Technical proficiency levels
            technical: {
                beginner: {
                    vibratoQuality: [0, 0.4],
                    breathControl: [0, 0.4],
                    articulationClarity: [0, 0.5],
                    dynamicControl: [0, 0.4],
                    tempoStability: [0.3, 1.0]
                },
                intermediate: {
                    vibratoQuality: [0.4, 0.7],
                    breathControl: [0.4, 0.7],
                    articulationClarity: [0.5, 0.8],
                    dynamicControl: [0.4, 0.7],
                    tempoStability: [0.5, 1.0]
                },
                advanced: {
                    vibratoQuality: [0.7, 0.9],
                    breathControl: [0.7, 0.9],
                    articulationClarity: [0.8, 0.95],
                    dynamicControl: [0.7, 0.9],
                    tempoStability: [0.6, 1.0]
                },
                professional: {
                    vibratoQuality: [0.85, 1.0],
                    breathControl: [0.85, 1.0],
                    articulationClarity: [0.9, 1.0],
                    dynamicControl: [0.85, 1.0],
                    tempoStability: [0.7, 1.0]
                }
            },
            
            // Musical expression levels
            musical: {
                mechanical: {
                    phrasingVariety: [0, 0.3],
                    dynamicExpression: [0, 0.3],
                    tempoFlexibility: [0, 0.2],
                    articulationVariety: [0, 0.4]
                },
                developing: {
                    phrasingVariety: [0.3, 0.6],
                    dynamicExpression: [0.3, 0.6],
                    tempoFlexibility: [0.2, 0.5],
                    articulationVariety: [0.4, 0.7]
                },
                expressive: {
                    phrasingVariety: [0.6, 0.85],
                    dynamicExpression: [0.6, 0.85],
                    tempoFlexibility: [0.5, 0.8],
                    articulationVariety: [0.7, 0.9]
                },
                artistic: {
                    phrasingVariety: [0.8, 1.0],
                    dynamicExpression: [0.8, 1.0],
                    tempoFlexibility: [0.7, 1.0],
                    articulationVariety: [0.85, 1.0]
                }
            },
            
            // Performance character types
            character: {
                lyrical: { legato: [0.6, 1.0], vibrato: [0.7, 1.0], dynamics: 'gentle' },
                dramatic: { accents: [0.5, 1.0], dynamics: 'wide', tempo: 'flexible' },
                coloratura: { agility: [0.8, 1.0], articulation: 'precise', vibrato: 'controlled' },
                folk: { naturalness: [0.6, 1.0], breathing: 'efficient', rubato: 'expressive' }
            }
        };
        
        // Weighting for overall assessment
        this.assessmentWeights = {
            technical: 0.35,
            musical: 0.40,
            consistency: 0.15,
            innovation: 0.10
        };
    }
    
    async analyzeVocalExpression(forensicData, noteEvents, transcriptionData = null) {
        console.log('🎭 Performing comprehensive vocal expression analysis...');
        
        if (!forensicData || !noteEvents || noteEvents.length < 3) {
            return this.createEmptyExpressionAnalysis('Insufficient data for expression analysis');
        }
        
        // 1. Run all component analyses
        const componentAnalyses = await this.runComponentAnalyses(
            forensicData, 
            noteEvents, 
            transcriptionData
        );
        
        // 2. Extract key metrics from each analysis
        const expressionMetrics = this.extractExpressionMetrics(componentAnalyses);
        
        // 3. Classify technical proficiency
        const technicalAssessment = this.assessTechnicalProficiency(expressionMetrics);
        
        // 4. Classify musical expression
        const musicalAssessment = this.assessMusicalExpression(expressionMetrics);
        
        // 5. Identify performance character/style
        const performanceCharacter = this.identifyPerformanceCharacter(expressionMetrics);
        
        // 6. Analyze consistency across performance
        const consistencyAnalysis = this.analyzePerformanceConsistency(componentAnalyses);
        
        // 7. Generate comprehensive assessment
        const overallAssessment = this.generateOverallAssessment(
            technicalAssessment,
            musicalAssessment,
            performanceCharacter,
            consistencyAnalysis
        );
        
        // 8. Create detailed recommendations
        const recommendations = this.generateComprehensiveRecommendations(
            componentAnalyses,
            overallAssessment
        );
        
        return {
            componentAnalyses,
            expressionMetrics,
            technicalAssessment,
            musicalAssessment,
            performanceCharacter,
            consistencyAnalysis,
            overallAssessment,
            recommendations,
            summary: this.generateExpressionSummary(overallAssessment),
            analysisMetadata: {
                totalDuration: noteEvents[noteEvents.length - 1].timestamp - noteEvents[0].timestamp,
                noteCount: noteEvents.length,
                analysisCompleteness: this.calculateAnalysisCompleteness(componentAnalyses)
            }
        };
    }
    
    async runComponentAnalyses(forensicData, noteEvents, transcriptionData) {
        console.log('Running component analyses...');
        
        const analyses = {};
        
        try {
            // Run analyses in parallel where possible
            const [
                vibratoResults,
                connectionResults,
                breathingResults,
                dynamicResults,
                crescendoResults,
                rubatoResults
            ] = await Promise.all([
                this.vibratoAnalyzer.analyzeVibratoInDepth(forensicData, noteEvents),
                this.connectionDetector.analyzeNoteConnections(noteEvents, forensicData, transcriptionData),
                this.breathingAnalyzer.analyzeBreathingPatterns(forensicData, noteEvents, transcriptionData),
                this.dynamicDetector.analyzeDynamicRange(forensicData, noteEvents),
                this.crescendoAnalyzer.analyzeGradients(forensicData, null),
                this.rubatoDetector.analyzeRubatoAndTempo(forensicData, noteEvents, transcriptionData)
            ]);
            
            analyses.vibrato = vibratoResults;
            analyses.connections = connectionResults;
            analyses.breathing = breathingResults;
            analyses.dynamics = dynamicResults;
            analyses.crescendo = crescendoResults;
            analyses.rubato = rubatoResults;
            
        } catch (error) {
            console.error('Error in component analyses:', error);
            
            // Provide fallback empty analyses
            analyses.vibrato = { hasVibrato: false, segments: [] };
            analyses.connections = { connections: [], summary: { total: 0 } };
            analyses.breathing = this.breathingAnalyzer.createEmptyBreathingAnalysis ? 
                this.breathingAnalyzer.createEmptyBreathingAnalysis() : { detectedBreaths: [] };
            analyses.dynamics = this.dynamicDetector.createEmptyDynamicAnalysis ? 
                this.dynamicDetector.createEmptyDynamicAnalysis() : { dynamicLevels: [] };
            analyses.crescendo = this.crescendoAnalyzer.createEmptyGradientAnalysis ? 
                this.crescendoAnalyzer.createEmptyGradientAnalysis() : { detectedGradients: [] };
            analyses.rubato = this.rubatoDetector.createEmptyTempoAnalysis ? 
                this.rubatoDetector.createEmptyTempoAnalysis() : { tempoChanges: [] };
        }
        
        return analyses;
    }
    
    extractExpressionMetrics(componentAnalyses) {
        const metrics = {
            // Technical metrics
            vibratoQuality: this.extractVibratoQuality(componentAnalyses.vibrato),
            breathControl: this.extractBreathControl(componentAnalyses.breathing),
            articulationClarity: this.extractArticulationClarity(componentAnalyses.connections),
            dynamicControl: this.extractDynamicControl(componentAnalyses.dynamics),
            tempoStability: this.extractTempoStability(componentAnalyses.rubato),
            
            // Musical metrics
            phrasingVariety: this.extractPhrasingVariety(componentAnalyses.connections, componentAnalyses.breathing),
            dynamicExpression: this.extractDynamicExpression(componentAnalyses.dynamics, componentAnalyses.crescendo),
            tempoFlexibility: this.extractTempoFlexibility(componentAnalyses.rubato),
            articulationVariety: this.extractArticulationVariety(componentAnalyses.connections),
            
            // Expression characteristics
            expressiveRange: this.calculateExpressiveRange(componentAnalyses),
            technicalComplexity: this.calculateTechnicalComplexity(componentAnalyses),
            musicalSophistication: this.calculateMusicalSophistication(componentAnalyses)
        };
        
        return metrics;
    }
    
    // Technical metric extractors
    extractVibratoQuality(vibratoAnalysis) {
        if (!vibratoAnalysis.hasVibrato || vibratoAnalysis.segments.length === 0) {
            return 0.1; // Minimal score for no vibrato
        }
        
        const overallQuality = vibratoAnalysis.overallAssessment?.quality || 'developing';
        const qualityMap = { 'basic': 0.2, 'developing': 0.4, 'intermediate': 0.6, 'advanced': 0.8, 'professional': 1.0 };
        
        return qualityMap[overallQuality] || 0.5;
    }
    
    extractBreathControl(breathingAnalysis) {
        return breathingAnalysis.supportAnalysis?.overallSupport || 0.5;
    }
    
    extractArticulationClarity(connectionAnalysis) {
        if (!connectionAnalysis.summary || connectionAnalysis.summary.total === 0) {
            return 0.3; // Default for unclear articulations
        }
        
        return connectionAnalysis.summary.averageConfidence || 0.5;
    }
    
    extractDynamicControl(dynamicAnalysis) {
        const dynamicLevels = dynamicAnalysis.dynamicLevels || [];
        if (dynamicLevels.length === 0) return 0.3;
        
        const avgConfidence = dynamicLevels.reduce((sum, level) => sum + level.confidence, 0) / dynamicLevels.length;
        return avgConfidence;
    }
    
    extractTempoStability(rubatoAnalysis) {
        return rubatoAnalysis.analysisMetadata?.tempoStability || 0.7;
    }
    
    // Musical metric extractors
    extractPhrasingVariety(connectionAnalysis, breathingAnalysis) {
        let varietyScore = 0;
        
        // Articulation variety
        if (connectionAnalysis.summary) {
            const articulationTypes = Object.keys(connectionAnalysis.summary.types || {}).length;
            varietyScore += Math.min(1, articulationTypes / 4) * 0.6; // Up to 4 types
        }
        
        // Breath placement variety
        if (breathingAnalysis.musicalAnalysis) {
            const musicalBreathRatio = breathingAnalysis.musicalAnalysis.breathPlacementScore || 0;
            varietyScore += musicalBreathRatio * 0.4;
        }
        
        return Math.min(1, varietyScore);
    }
    
    extractDynamicExpression(dynamicAnalysis, crescendoAnalysis) {
        let expressionScore = 0;
        
        // Dynamic range
        if (dynamicAnalysis.summary) {
            const levelTypes = Object.keys(dynamicAnalysis.summary.levelDistribution || {}).length;
            expressionScore += Math.min(1, levelTypes / 6) * 0.5; // Up to 6 dynamic levels
        }
        
        // Gradient expression
        if (crescendoAnalysis.summary) {
            const gradientCount = crescendoAnalysis.summary.totalGradients || 0;
            expressionScore += Math.min(1, gradientCount / 5) * 0.5; // Up to 5 gradients expected
        }
        
        return Math.min(1, expressionScore);
    }
    
    extractTempoFlexibility(rubatoAnalysis) {
        if (!rubatoAnalysis.summary) return 0.1;
        
        return rubatoAnalysis.summary.overallFlexibility || 0.2;
    }
    
    extractArticulationVariety(connectionAnalysis) {
        if (!connectionAnalysis.summary) return 0.3;
        
        const articulationTypes = Object.keys(connectionAnalysis.summary.types || {}).length;
        return Math.min(1, articulationTypes / 5); // Normalize to 5 articulation types
    }
    
    // Complex metric calculators
    calculateExpressiveRange(componentAnalyses) {
        let rangeScore = 0;
        let componentCount = 0;
        
        // Vibrato range
        if (componentAnalyses.vibrato.hasVibrato) {
            const vibratoVariety = componentAnalyses.vibrato.segments?.length || 0;
            rangeScore += Math.min(1, vibratoVariety / 3);
            componentCount++;
        }
        
        // Dynamic range
        const dynamicRange = componentAnalyses.dynamics.summary?.dynamicRange;
        if (dynamicRange === 'wide') rangeScore += 1;
        else if (dynamicRange === 'moderate') rangeScore += 0.6;
        else rangeScore += 0.3;
        componentCount++;
        
        // Tempo range
        const tempoChanges = componentAnalyses.rubato.summary?.totalTempoChanges || 0;
        rangeScore += Math.min(1, tempoChanges / 4);
        componentCount++;
        
        return componentCount > 0 ? rangeScore / componentCount : 0.5;
    }
    
    calculateTechnicalComplexity(componentAnalyses) {
        let complexityScore = 0;
        
        // Vibrato complexity
        if (componentAnalyses.vibrato.hasVibrato) {
            const vibratoQuality = componentAnalyses.vibrato.overallAssessment?.quality;
            complexityScore += vibratoQuality === 'professional' ? 1 : 0.7;
        }
        
        // Articulation complexity
        const articulationCount = Object.keys(componentAnalyses.connections.summary?.types || {}).length;
        complexityScore += Math.min(1, articulationCount / 4);
        
        // Dynamic complexity
        const dynamicComplexity = componentAnalyses.dynamics.summary?.levelDistribution;
        const dynamicVariety = Object.keys(dynamicComplexity || {}).length;
        complexityScore += Math.min(1, dynamicVariety / 5);
        
        return complexityScore / 3;
    }
    
    calculateMusicalSophistication(componentAnalyses) {
        let sophisticationScore = 0;
        
        // Musical breath placement
        const breathPlacementScore = componentAnalyses.breathing.musicalAnalysis?.breathPlacementScore || 0.3;
        sophisticationScore += breathPlacementScore;
        
        // Rubato sophistication
        const rubatoQuality = componentAnalyses.rubato.contextualAnalysis?.overallMusicalLogic;
        if (rubatoQuality === 'highly_expressive') sophisticationScore += 1;
        else if (rubatoQuality === 'moderately_expressive') sophisticationScore += 0.7;
        else sophisticationScore += 0.4;
        
        // Crescendo/diminuendo sophistication
        const crescendoCharacter = componentAnalyses.crescendo.summary?.overallGradientCharacter;
        if (crescendoCharacter === 'balanced') sophisticationScore += 0.8;
        else if (crescendoCharacter === 'dramatic' || crescendoCharacter === 'subtle') sophisticationScore += 0.6;
        else sophisticationScore += 0.4;
        
        return sophisticationScore / 3;
    }
    
    assessTechnicalProficiency(metrics) {
        const technicalScores = {
            vibratoQuality: metrics.vibratoQuality,
            breathControl: metrics.breathControl,
            articulationClarity: metrics.articulationClarity,
            dynamicControl: metrics.dynamicControl,
            tempoStability: metrics.tempoStability
        };
        
        // Calculate overall technical score
        const technicalScore = Object.values(technicalScores).reduce((sum, score) => sum + score, 0) / 5;
        
        // Classify proficiency level
        let proficiencyLevel = 'beginner';
        let bestMatch = 0;
        
        Object.entries(this.expressionModels.technical).forEach(([level, criteria]) => {
            let matchScore = 0;
            let criteriaCount = 0;
            
            Object.entries(criteria).forEach(([metric, range]) => {
                if (technicalScores[metric] !== undefined) {
                    if (technicalScores[metric] >= range[0] && technicalScores[metric] <= range[1]) {
                        matchScore++;
                    }
                    criteriaCount++;
                }
            });
            
            const normalizedMatch = matchScore / criteriaCount;
            if (normalizedMatch > bestMatch) {
                bestMatch = normalizedMatch;
                proficiencyLevel = level;
            }
        });
        
        return {
            level: proficiencyLevel,
            overallScore: technicalScore,
            scores: technicalScores,
            confidence: bestMatch,
            strengths: this.identifyTechnicalStrengths(technicalScores),
            weaknesses: this.identifyTechnicalWeaknesses(technicalScores)
        };
    }
    
    assessMusicalExpression(metrics) {
        const musicalScores = {
            phrasingVariety: metrics.phrasingVariety,
            dynamicExpression: metrics.dynamicExpression,
            tempoFlexibility: metrics.tempoFlexibility,
            articulationVariety: metrics.articulationVariety
        };
        
        const musicalScore = Object.values(musicalScores).reduce((sum, score) => sum + score, 0) / 4;
        
        // Classify musical expression level
        let expressionLevel = 'mechanical';
        let bestMatch = 0;
        
        Object.entries(this.expressionModels.musical).forEach(([level, criteria]) => {
            let matchScore = 0;
            let criteriaCount = 0;
            
            Object.entries(criteria).forEach(([metric, range]) => {
                if (musicalScores[metric] !== undefined) {
                    if (musicalScores[metric] >= range[0] && musicalScores[metric] <= range[1]) {
                        matchScore++;
                    }
                    criteriaCount++;
                }
            });
            
            const normalizedMatch = matchScore / criteriaCount;
            if (normalizedMatch > bestMatch) {
                bestMatch = normalizedMatch;
                expressionLevel = level;
            }
        });
        
        return {
            level: expressionLevel,
            overallScore: musicalScore,
            scores: musicalScores,
            confidence: bestMatch,
            expressiveElements: this.identifyExpressiveElements(musicalScores),
            areas: this.identifyMusicalAreas(musicalScores)
        };
    }
    
    identifyPerformanceCharacter(metrics) {
        const characterScores = {};
        
        // Calculate scores for each character type
        Object.entries(this.expressionModels.character).forEach(([character, criteria]) => {
            let score = 0.5; // Base score
            let criteriaEvaluated = 0;
            
            // Evaluate each criterion for this character
            Object.entries(criteria).forEach(([criterion, requirement]) => {
                switch (criterion) {
                    case 'legato':
                        // High legato usage suggests lyrical character
                        // This would need connection analysis data
                        break;
                    case 'vibrato':
                        if (requirement[0] <= metrics.vibratoQuality && metrics.vibratoQuality <= requirement[1]) {
                            score += 0.3;
                        }
                        criteriaEvaluated++;
                        break;
                    case 'accents':
                        // High accent usage suggests dramatic character
                        // This would need dynamic analysis data
                        break;
                    case 'dynamics':
                        if (requirement === 'wide' && metrics.expressiveRange > 0.7) {
                            score += 0.3;
                        } else if (requirement === 'gentle' && metrics.expressiveRange < 0.5) {
                            score += 0.3;
                        }
                        criteriaEvaluated++;
                        break;
                    case 'tempo':
                        if (requirement === 'flexible' && metrics.tempoFlexibility > 0.6) {
                            score += 0.3;
                        }
                        criteriaEvaluated++;
                        break;
                }
            });
            
            characterScores[character] = criteriaEvaluated > 0 ? score / Math.max(1, criteriaEvaluated) : 0.5;
        });
        
        // Find dominant character
        const dominantCharacter = Object.entries(characterScores)
            .sort(([,a], [,b]) => b - a)[0];
        
        return {
            dominantCharacter: dominantCharacter[0],
            characterScores,
            confidence: dominantCharacter[1],
            characteristics: this.describePerformanceCharacter(dominantCharacter[0], characterScores)
        };
    }
    
    analyzePerformanceConsistency(componentAnalyses) {
        const consistencyMetrics = {
            vibratoConsistency: this.analyzeVibratoConsistency(componentAnalyses.vibrato),
            breathingConsistency: this.analyzeBreathingConsistency(componentAnalyses.breathing),
            articulationConsistency: this.analyzeArticulationConsistency(componentAnalyses.connections),
            dynamicConsistency: this.analyzeDynamicConsistency(componentAnalyses.dynamics)
        };
        
        const overallConsistency = Object.values(consistencyMetrics)
            .reduce((sum, metric) => sum + metric, 0) / 4;
        
        return {
            overallConsistency,
            metrics: consistencyMetrics,
            level: this.classifyConsistencyLevel(overallConsistency),
            variabilityAreas: this.identifyVariabilityAreas(consistencyMetrics)
        };
    }
    
    generateOverallAssessment(technical, musical, character, consistency) {
        // Calculate weighted overall score
        const overallScore = 
            technical.overallScore * this.assessmentWeights.technical +
            musical.overallScore * this.assessmentWeights.musical +
            consistency.overallConsistency * this.assessmentWeights.consistency +
            (musical.overallScore * 0.5 + technical.overallScore * 0.5) * this.assessmentWeights.innovation;
        
        return {
            overallScore,
            level: this.classifyOverallLevel(overallScore),
            technicalLevel: technical.level,
            musicalLevel: musical.level,
            dominantCharacter: character.dominantCharacter,
            consistencyLevel: consistency.level,
            
            keyStrengths: this.identifyKeyStrengths(technical, musical, character),
            developmentAreas: this.identifyDevelopmentAreas(technical, musical, consistency),
            
            performanceProfile: {
                technical: technical.overallScore,
                musical: musical.overallScore,
                consistency: consistency.overallConsistency,
                character: character.confidence
            }
        };
    }
    
    generateComprehensiveRecommendations(componentAnalyses, overallAssessment) {
        const recommendations = {
            priority: [],
            technical: [],
            musical: [],
            performance: []
        };
        
        // Priority recommendations based on overall assessment
        if (overallAssessment.overallScore < 0.4) {
            recommendations.priority.push({
                category: 'fundamental_technique',
                message: 'Focus on fundamental vocal technique - breath support, pitch accuracy, and basic articulation',
                urgency: 'high'
            });
        } else if (overallAssessment.overallScore < 0.7) {
            recommendations.priority.push({
                category: 'musical_development',
                message: 'Develop musical expression while maintaining technical foundation',
                urgency: 'medium'
            });
        }
        
        // Technical recommendations
        Object.entries(componentAnalyses).forEach(([component, analysis]) => {
            if (analysis.recommendations) {
                analysis.recommendations.forEach(rec => {
                    recommendations.technical.push({
                        ...rec,
                        source: component
                    });
                });
            }
        });
        
        // Musical recommendations based on expression level
        if (overallAssessment.musicalLevel === 'mechanical') {
            recommendations.musical.push({
                category: 'expression_development',
                message: 'Work on musical phrasing and dynamic expression to bring music to life',
                exercises: ['Phrase analysis', 'Dynamic exercises', 'Tempo flexibility work']
            });
        }
        
        return recommendations;
    }
    
    generateExpressionSummary(overallAssessment) {
        return {
            level: overallAssessment.level,
            technicalProficiency: overallAssessment.technicalLevel,
            musicalExpression: overallAssessment.musicalLevel,
            performanceCharacter: overallAssessment.dominantCharacter,
            overallScore: Math.round(overallAssessment.overallScore * 100),
            keyStrengths: overallAssessment.keyStrengths.slice(0, 3),
            primaryFocusAreas: overallAssessment.developmentAreas.slice(0, 2)
        };
    }
    
    // Helper methods for assessment
    
    identifyTechnicalStrengths(scores) {
        return Object.entries(scores)
            .filter(([, score]) => score > 0.7)
            .map(([metric]) => metric)
            .sort();
    }
    
    identifyTechnicalWeaknesses(scores) {
        return Object.entries(scores)
            .filter(([, score]) => score < 0.5)
            .map(([metric]) => metric)
            .sort();
    }
    
    identifyExpressiveElements(scores) {
        return Object.entries(scores)
            .filter(([, score]) => score > 0.6)
            .map(([element]) => element);
    }
    
    identifyMusicalAreas(scores) {
        return Object.entries(scores)
            .filter(([, score]) => score < 0.5)
            .map(([area]) => area);
    }
    
    describePerformanceCharacter(character, scores) {
        const descriptions = {
            lyrical: 'Smooth, flowing vocal style with emphasis on legato phrasing',
            dramatic: 'Powerful, expressive style with strong dynamic contrasts',
            coloratura: 'Agile, precise style suited for elaborate vocal passages',
            folk: 'Natural, authentic style with expressive timing flexibility'
        };
        
        return descriptions[character] || 'Balanced vocal approach';
    }
    
    analyzeVibratoConsistency(vibratoAnalysis) {
        if (!vibratoAnalysis.hasVibrato) return 0.5;
        
        // Analyze consistency across vibrato segments
        const segments = vibratoAnalysis.segments || [];
        if (segments.length < 2) return 0.8;
        
        const rates = segments.map(s => s.rate);
        const depths = segments.map(s => s.depth);
        
        const rateCV = this.calculateCV(rates);
        const depthCV = this.calculateCV(depths);
        
        return Math.max(0, 1 - (rateCV + depthCV) / 2);
    }
    
    analyzeBreathingConsistency(breathingAnalysis) {
        const detectedBreaths = breathingAnalysis.detectedBreaths || [];
        if (detectedBreaths.length < 3) return 0.7;
        
        const durations = detectedBreaths.map(b => b.duration);
        const qualityScores = detectedBreaths.map(b => this.getBreathQualityScore(b.classification?.quality || 'adequate'));
        
        const durationCV = this.calculateCV(durations);
        const qualityCV = this.calculateCV(qualityScores);
        
        return Math.max(0, 1 - (durationCV + qualityCV) / 2);
    }
    
    analyzeArticulationConsistency(connectionAnalysis) {
        const connections = connectionAnalysis.connections || [];
        if (connections.length < 3) return 0.7;
        
        const confidences = connections.map(c => c.articulation.confidence);
        const cv = this.calculateCV(confidences);
        
        return Math.max(0, 1 - cv);
    }
    
    analyzeDynamicConsistency(dynamicAnalysis) {
        const levels = dynamicAnalysis.dynamicLevels || [];
        if (levels.length < 3) return 0.7;
        
        const confidences = levels.map(l => l.confidence);
        const cv = this.calculateCV(confidences);
        
        return Math.max(0, 1 - cv);
    }
    
    classifyConsistencyLevel(overallConsistency) {
        if (overallConsistency >= 0.8) return 'very_consistent';
        if (overallConsistency >= 0.6) return 'consistent';
        if (overallConsistency >= 0.4) return 'somewhat_variable';
        return 'inconsistent';
    }
    
    classifyOverallLevel(overallScore) {
        if (overallScore >= 0.85) return 'professional';
        if (overallScore >= 0.7) return 'advanced';
        if (overallScore >= 0.55) return 'intermediate';
        if (overallScore >= 0.4) return 'developing';
        return 'beginner';
    }
    
    identifyKeyStrengths(technical, musical, character) {
        const strengths = [];
        
        if (technical.overallScore > 0.7) {
            strengths.push('Strong technical foundation');
        }
        if (musical.overallScore > 0.7) {
            strengths.push('Excellent musical expression');
        }
        if (character.confidence > 0.7) {
            strengths.push(`Clear ${character.dominantCharacter} character`);
        }
        
        return strengths.length > 0 ? strengths : ['Developing performance skills'];
    }
    
    identifyDevelopmentAreas(technical, musical, consistency) {
        const areas = [];
        
        if (technical.overallScore < 0.6) {
            areas.push('Technical precision');
        }
        if (musical.overallScore < 0.6) {
            areas.push('Musical expression');
        }
        if (consistency.overallConsistency < 0.6) {
            areas.push('Performance consistency');
        }
        
        return areas.length > 0 ? areas : ['Refinement and polish'];
    }
    
    identifyVariabilityAreas(consistencyMetrics) {
        return Object.entries(consistencyMetrics)
            .filter(([, score]) => score < 0.6)
            .map(([area]) => area);
    }
    
    calculateAnalysisCompleteness(componentAnalyses) {
        const expectedComponents = ['vibrato', 'connections', 'breathing', 'dynamics', 'crescendo', 'rubato'];
        const completedComponents = expectedComponents.filter(component => 
            componentAnalyses[component] && Object.keys(componentAnalyses[component]).length > 0
        );
        
        return completedComponents.length / expectedComponents.length;
    }
    
    // Utility methods
    
    createEmptyExpressionAnalysis(reason) {
        return {
            componentAnalyses: {},
            expressionMetrics: {},
            technicalAssessment: { level: 'unknown', overallScore: 0 },
            musicalAssessment: { level: 'unknown', overallScore: 0 },
            performanceCharacter: { dominantCharacter: 'unknown', confidence: 0 },
            consistencyAnalysis: { overallConsistency: 0, level: 'unknown' },
            overallAssessment: { overallScore: 0, level: 'unknown' },
            recommendations: { priority: [{ category: 'insufficient_data', message: reason }] },
            summary: { level: 'unknown', overallScore: 0 },
            analysisMetadata: { totalDuration: 0, noteCount: 0, analysisCompleteness: 0 }
        };
    }
    
    calculateCV(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
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
}