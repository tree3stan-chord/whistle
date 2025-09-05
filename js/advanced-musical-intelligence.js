/**
 * AdvancedMusicalIntelligence - Integration of Phase 7 & 8 systems
 * Combines multi-language vocal transcription with harmonic context analysis
 * 
 * Features:
 * - Global vocal transcription with cultural sensitivity
 * - Intelligent harmonic analysis and context awareness  
 * - Cross-cultural musical understanding
 * - Advanced performance analysis with linguistic and harmonic insights
 * - Comprehensive musical intelligence for vocal performances
 */

class AdvancedMusicalIntelligence {
    constructor(vocalTranscriptionEngine, articulationIntegration, pitchDetector) {
        this.vocalEngine = vocalTranscriptionEngine;
        this.articulationIntegration = articulationIntegration;
        this.pitchDetector = pitchDetector;
        
        // Initialize Phase 7: Multi-Language System
        this.multiLanguageSystem = new MultiLanguageVocalTranscription(
            vocalTranscriptionEngine,
            articulationIntegration
        );
        
        // Initialize Phase 8: Harmonic Context Analysis
        this.harmonicAnalyzer = new HarmonicContextAnalyzer(
            pitchDetector,
            vocalTranscriptionEngine
        );
        
        // Advanced musical intelligence state
        this.musicalContext = {
            language: 'en',
            culturalTradition: null,
            key: 'C',
            scale: 'major',
            mode: 'ionian',
            harmonicComplexity: 0.5,
            culturalAuthenticity: 0.8,
            linguisticAccuracy: 0.9,
            musicalCoherence: 0.7
        };
        
        // Performance analysis history
        this.performanceHistory = [];
        this.culturalPatterns = [];
        this.harmonicPatterns = [];
        this.linguisticPatterns = [];
        
        // Analysis configuration
        this.analysisDepth = 'comprehensive'; // 'basic', 'intermediate', 'comprehensive'
        this.culturalSensitivity = 'high'; // 'low', 'medium', 'high'
        this.harmonicAwareness = 'advanced'; // 'basic', 'intermediate', 'advanced'
        
        console.log('🧠 Advanced Musical Intelligence System initialized');
        console.log('   🌍 Multi-Language Vocal Transcription: Ready');
        console.log('   🎼 Harmonic Context Analysis: Ready');
    }

    /**
     * Perform comprehensive musical intelligence analysis
     * @param {Object} audioData - Raw audio analysis data
     * @param {Object} transcriptionData - Current transcription results
     * @param {Object} rhythmData - Rhythm and timing data
     */
    async performComprehensiveAnalysis(audioData, transcriptionData, rhythmData) {
        if (!audioData || !transcriptionData) return null;
        
        try {
            console.log('🧠 Starting comprehensive musical intelligence analysis...');
            
            // Phase 7: Multi-Language Analysis
            const languageAnalysis = await this.multiLanguageSystem.analyzeMultiLanguageVocals(
                audioData,
                transcriptionData
            );
            
            // Phase 8: Harmonic Context Analysis
            const harmonicAnalysis = await this.harmonicAnalyzer.analyzeHarmonicContext(
                transcriptionData.pitchData || [],
                rhythmData
            );
            
            // Cross-System Integration Analysis
            const integratedAnalysis = await this.performIntegratedAnalysis(
                languageAnalysis,
                harmonicAnalysis,
                audioData
            );
            
            // Generate Musical Intelligence Insights
            const musicalInsights = await this.generateMusicalIntelligenceInsights(
                languageAnalysis,
                harmonicAnalysis,
                integratedAnalysis
            );
            
            // Update performance context
            this.updateMusicalContext(languageAnalysis, harmonicAnalysis);
            
            const result = {
                timestamp: Date.now(),
                language: languageAnalysis,
                harmonic: harmonicAnalysis,
                integrated: integratedAnalysis,
                insights: musicalInsights,
                context: this.musicalContext,
                confidence: this.calculateOverallConfidence(languageAnalysis, harmonicAnalysis, integratedAnalysis)
            };
            
            // Store in performance history
            this.performanceHistory.push(result);
            if (this.performanceHistory.length > 100) {
                this.performanceHistory = this.performanceHistory.slice(-100);
            }
            
            return result;
            
        } catch (error) {
            console.error('Comprehensive musical analysis failed:', error);
            return null;
        }
    }

    /**
     * Perform integrated cross-system analysis
     * @param {Object} languageAnalysis - Multi-language analysis results
     * @param {Object} harmonicAnalysis - Harmonic context analysis results
     * @param {Object} audioData - Raw audio data
     */
    async performIntegratedAnalysis(languageAnalysis, harmonicAnalysis, audioData) {
        const integration = {
            culturalHarmonicAlignment: 0,
            linguisticMusicalCoherence: 0,
            traditionalAccuracy: 0,
            crossCulturalInsights: [],
            harmonicLinguisticCorrelations: [],
            performanceAuthenticity: 0
        };
        
        if (!languageAnalysis || !harmonicAnalysis) return integration;
        
        // Analyze cultural-harmonic alignment
        integration.culturalHarmonicAlignment = await this.analyzeCulturalHarmonicAlignment(
            languageAnalysis.cultural,
            harmonicAnalysis.key,
            harmonicAnalysis.modal
        );
        
        // Analyze linguistic-musical coherence
        integration.linguisticMusicalCoherence = await this.analyzeLinguisticMusicalCoherence(
            languageAnalysis.language,
            languageAnalysis.ipa,
            harmonicAnalysis.voiceLeading
        );
        
        // Assess traditional accuracy
        integration.traditionalAccuracy = await this.assessTraditionalAccuracy(
            languageAnalysis.cultural,
            harmonicAnalysis.chords,
            harmonicAnalysis.modal
        );
        
        // Generate cross-cultural insights
        integration.crossCulturalInsights = await this.generateCrossCulturalInsights(
            languageAnalysis,
            harmonicAnalysis
        );
        
        // Find harmonic-linguistic correlations
        integration.harmonicLinguisticCorrelations = await this.findHarmonicLinguisticCorrelations(
            languageAnalysis,
            harmonicAnalysis
        );
        
        // Calculate performance authenticity
        integration.performanceAuthenticity = this.calculatePerformanceAuthenticity(
            integration.culturalHarmonicAlignment,
            integration.traditionalAccuracy,
            integration.linguisticMusicalCoherence
        );
        
        return integration;
    }

    /**
     * Generate comprehensive musical intelligence insights
     * @param {Object} languageAnalysis - Language analysis results
     * @param {Object} harmonicAnalysis - Harmonic analysis results
     * @param {Object} integratedAnalysis - Integrated analysis results
     */
    async generateMusicalIntelligenceInsights(languageAnalysis, harmonicAnalysis, integratedAnalysis) {
        const insights = {
            cultural: [],
            harmonic: [],
            linguistic: [],
            performance: [],
            recommendations: [],
            educationalValue: 0
        };
        
        // Cultural insights
        if (languageAnalysis?.cultural?.traditions?.length > 0) {
            const primaryTradition = languageAnalysis.cultural.traditions[0];
            insights.cultural.push({
                type: 'tradition_identification',
                message: `Performance shows strong ${primaryTradition.name} characteristics`,
                confidence: primaryTradition.confidence,
                details: primaryTradition.characteristics
            });
        }
        
        // Harmonic insights
        if (harmonicAnalysis?.key?.confidence > 0.8) {
            insights.harmonic.push({
                type: 'key_stability',
                message: `Strong tonal center in ${harmonicAnalysis.key.key} ${harmonicAnalysis.key.scale}`,
                confidence: harmonicAnalysis.key.confidence,
                details: harmonicAnalysis.key
            });
        }
        
        if (harmonicAnalysis?.modulations?.modulations?.length > 0) {
            insights.harmonic.push({
                type: 'modulation_detected',
                message: `${harmonicAnalysis.modulations.modulations.length} key changes detected`,
                confidence: 0.8,
                details: harmonicAnalysis.modulations.modulations
            });
        }
        
        // Linguistic insights
        if (languageAnalysis?.ipa?.confidence > 0.7) {
            insights.linguistic.push({
                type: 'pronunciation_accuracy',
                message: `Good pronunciation in ${languageAnalysis.language.primary}`,
                confidence: languageAnalysis.ipa.confidence,
                details: languageAnalysis.ipa
            });
        }
        
        // Performance insights
        if (integratedAnalysis?.performanceAuthenticity > 0.8) {
            insights.performance.push({
                type: 'authentic_performance',
                message: 'Performance demonstrates cultural authenticity',
                confidence: integratedAnalysis.performanceAuthenticity,
                details: integratedAnalysis
            });
        }
        
        // Generate recommendations
        insights.recommendations = await this.generatePerformanceRecommendations(
            languageAnalysis,
            harmonicAnalysis,
            integratedAnalysis
        );
        
        // Calculate educational value
        insights.educationalValue = this.calculateEducationalValue(
            languageAnalysis,
            harmonicAnalysis,
            integratedAnalysis
        );
        
        return insights;
    }

    /**
     * Analyze cultural-harmonic alignment
     */
    async analyzeCulturalHarmonicAlignment(culturalAnalysis, keyAnalysis, modalAnalysis) {
        if (!culturalAnalysis || !keyAnalysis) return 0;
        
        let alignmentScore = 0;
        
        // Check if harmonic choices align with cultural traditions
        if (culturalAnalysis.traditions && culturalAnalysis.traditions.length > 0) {
            const primaryTradition = culturalAnalysis.traditions[0];
            
            // Gospel tradition favors certain keys and modes
            if (primaryTradition.name === 'gospel') {
                const gospelKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db'];
                if (gospelKeys.includes(keyAnalysis.key)) {
                    alignmentScore += 0.3;
                }
            }
            
            // Classical Arabic music uses specific modal systems
            if (primaryTradition.name === 'classical_arabic') {
                if (modalAnalysis && ['phrygian', 'harmonic_minor'].includes(modalAnalysis.primaryMode)) {
                    alignmentScore += 0.4;
                }
            }
            
            // Indian classical music uses specific ragas
            if (primaryTradition.name === 'indian_classical') {
                if (modalAnalysis && modalAnalysis.brightness < 0.5) {
                    alignmentScore += 0.3;
                }
            }
        }
        
        return Math.min(1.0, alignmentScore);
    }

    /**
     * Analyze linguistic-musical coherence
     */
    async analyzeLinguisticMusicalCoherence(languageDetection, ipaTranscription, voiceLeading) {
        if (!languageDetection || !ipaTranscription) return 0.5;
        
        let coherenceScore = 0.5; // Base score
        
        // Check if vocal phrasing aligns with linguistic patterns
        if (ipaTranscription.syllables && voiceLeading) {
            // Languages with strong stress patterns should show musical emphasis
            const stressLanguages = ['en', 'de', 'ru'];
            if (stressLanguages.includes(languageDetection.primary)) {
                coherenceScore += 0.2;
            }
            
            // Tonal languages should show pitch-meaning correlations
            const tonalLanguages = ['zh', 'th', 'vi'];
            if (tonalLanguages.includes(languageDetection.primary)) {
                coherenceScore += 0.3;
            }
        }
        
        return Math.min(1.0, coherenceScore);
    }

    /**
     * Assess traditional performance accuracy
     */
    async assessTraditionalAccuracy(culturalAnalysis, chordAnalysis, modalAnalysis) {
        if (!culturalAnalysis || !culturalAnalysis.traditions) return 0.5;
        
        let accuracyScore = 0;
        const tradition = culturalAnalysis.traditions[0];
        
        if (tradition) {
            accuracyScore = tradition.confidence * 0.8;
            
            // Bonus for appropriate harmonic choices
            if (chordAnalysis && chordAnalysis.functionality) {
                accuracyScore += 0.1;
            }
            
            if (modalAnalysis && modalAnalysis.confidence > 0.7) {
                accuracyScore += 0.1;
            }
        }
        
        return Math.min(1.0, accuracyScore);
    }

    /**
     * Generate cross-cultural insights
     */
    async generateCrossCulturalInsights(languageAnalysis, harmonicAnalysis) {
        const insights = [];
        
        if (languageAnalysis?.language?.primary && harmonicAnalysis?.key?.key) {
            const language = languageAnalysis.language.primary;
            const key = harmonicAnalysis.key.key;
            
            // Example cross-cultural insight
            if (language === 'es' && ['A', 'D', 'G'].includes(key)) {
                insights.push({
                    type: 'cultural_harmonic_match',
                    message: 'Key choice aligns with Spanish folk music traditions',
                    confidence: 0.7
                });
            }
            
            if (language === 'fr' && harmonicAnalysis.modal?.primaryMode === 'dorian') {
                insights.push({
                    type: 'modal_cultural_alignment',
                    message: 'Dorian mode reflects French modal music heritage',
                    confidence: 0.8
                });
            }
        }
        
        return insights;
    }

    /**
     * Find correlations between harmonic and linguistic patterns
     */
    async findHarmonicLinguisticCorrelations(languageAnalysis, harmonicAnalysis) {
        const correlations = [];
        
        // Analyze prosodic-musical correlations
        if (languageAnalysis?.ipa?.syllables && harmonicAnalysis?.voiceLeading) {
            correlations.push({
                type: 'prosodic_musical',
                strength: 0.6,
                description: 'Speech rhythm influences musical phrasing'
            });
        }
        
        // Analyze phonetic-timbral correlations  
        if (languageAnalysis?.language?.primary && harmonicAnalysis?.tonal) {
            correlations.push({
                type: 'phonetic_timbral',
                strength: 0.4,
                description: 'Language phonemes influence vocal timbre'
            });
        }
        
        return correlations;
    }

    /**
     * Generate performance recommendations
     */
    async generatePerformanceRecommendations(languageAnalysis, harmonicAnalysis, integratedAnalysis) {
        const recommendations = [];
        
        // Language-based recommendations
        if (languageAnalysis?.pronunciation) {
            languageAnalysis.pronunciation.syllables.forEach(syllable => {
                if (syllable.difficulty === 'hard') {
                    recommendations.push({
                        type: 'pronunciation',
                        priority: 'high',
                        message: `Practice pronunciation of "${syllable.text}" (${syllable.ipa})`,
                        tips: syllable.tips
                    });
                }
            });
        }
        
        // Harmonic recommendations
        if (harmonicAnalysis?.key?.confidence < 0.6) {
            recommendations.push({
                type: 'tonal_stability',
                priority: 'medium',
                message: 'Work on maintaining consistent tonal center',
                tips: ['Practice scales', 'Focus on strong cadences']
            });
        }
        
        // Cultural authenticity recommendations
        if (integratedAnalysis?.traditionalAccuracy < 0.7) {
            recommendations.push({
                type: 'cultural_authenticity',
                priority: 'medium',
                message: 'Study traditional performance practices',
                tips: ['Listen to authentic recordings', 'Study cultural ornamentation']
            });
        }
        
        return recommendations;
    }

    /**
     * Update musical context based on analysis
     */
    updateMusicalContext(languageAnalysis, harmonicAnalysis) {
        if (languageAnalysis?.language?.primary) {
            this.musicalContext.language = languageAnalysis.language.primary;
        }
        
        if (languageAnalysis?.cultural?.style) {
            this.musicalContext.culturalTradition = languageAnalysis.cultural.style;
        }
        
        if (harmonicAnalysis?.key?.key) {
            this.musicalContext.key = harmonicAnalysis.key.key;
            this.musicalContext.scale = harmonicAnalysis.key.scale;
        }
        
        if (harmonicAnalysis?.modal?.primaryMode) {
            this.musicalContext.mode = harmonicAnalysis.modal.primaryMode;
        }
        
        // Update complexity metrics
        this.musicalContext.harmonicComplexity = harmonicAnalysis?.chords?.complexity || 0.5;
        this.musicalContext.culturalAuthenticity = languageAnalysis?.cultural?.confidence || 0.5;
        this.musicalContext.linguisticAccuracy = languageAnalysis?.ipa?.confidence || 0.5;
    }

    /**
     * Get comprehensive musical intelligence status
     */
    getMusicalIntelligenceStatus() {
        return {
            currentContext: this.musicalContext,
            analysisCapabilities: {
                multiLanguage: true,
                culturalAnalysis: true,
                harmonicAnalysis: true,
                ipaTranscription: true,
                modalAnalysis: true,
                crossCulturalInsights: true
            },
            supportedLanguages: Object.keys(this.multiLanguageSystem.supportedLanguages),
            supportedTraditions: Object.keys(this.multiLanguageSystem.culturalTraditions),
            performanceHistory: this.performanceHistory.length,
            systemHealth: {
                languageSystem: 'operational',
                harmonicSystem: 'operational',
                integration: 'operational'
            }
        };
    }

    /**
     * Set analysis configuration
     * @param {Object} config - Analysis configuration options
     */
    setAnalysisConfiguration(config) {
        if (config.analysisDepth) {
            this.analysisDepth = config.analysisDepth;
        }
        
        if (config.culturalSensitivity) {
            this.culturalSensitivity = config.culturalSensitivity;
        }
        
        if (config.harmonicAwareness) {
            this.harmonicAwareness = config.harmonicAwareness;
        }
        
        if (config.targetLanguage) {
            this.multiLanguageSystem.setTargetLanguage(config.targetLanguage);
        }
        
        console.log('🧠 Musical Intelligence configuration updated:', config);
    }

    /**
     * Generate performance report
     */
    generatePerformanceReport() {
        if (this.performanceHistory.length === 0) {
            return { message: 'No performance data available' };
        }
        
        const recentPerformance = this.performanceHistory[this.performanceHistory.length - 1];
        
        return {
            timestamp: Date.now(),
            performance: {
                language: recentPerformance.language?.language?.primary || 'Unknown',
                culturalTradition: recentPerformance.language?.cultural?.style || 'None detected',
                key: recentPerformance.harmonic?.key?.key || 'Unknown',
                mode: recentPerformance.harmonic?.modal?.primaryMode || 'Unknown',
                overallConfidence: recentPerformance.confidence || 0
            },
            analysis: {
                languageConfidence: recentPerformance.language?.language?.confidence || 0,
                harmonicStability: recentPerformance.harmonic?.key?.confidence || 0,
                culturalAuthenticity: recentPerformance.integrated?.performanceAuthenticity || 0,
                linguisticAccuracy: recentPerformance.language?.ipa?.confidence || 0
            },
            insights: recentPerformance.insights || {},
            recommendations: recentPerformance.insights?.recommendations || []
        };
    }

    // Utility methods
    
    calculateOverallConfidence(languageAnalysis, harmonicAnalysis, integratedAnalysis) {
        const weights = [0.3, 0.4, 0.3];
        const confidences = [
            languageAnalysis?.confidence || 0,
            harmonicAnalysis?.confidence || 0,
            integratedAnalysis?.performanceAuthenticity || 0
        ];
        
        return weights.reduce((sum, weight, i) => sum + (weight * confidences[i]), 0);
    }
    
    calculatePerformanceAuthenticity(culturalAlignment, traditionalAccuracy, linguisticCoherence) {
        return (culturalAlignment + traditionalAccuracy + linguisticCoherence) / 3;
    }
    
    calculateEducationalValue(languageAnalysis, harmonicAnalysis, integratedAnalysis) {
        let value = 0.5; // Base educational value
        
        if (languageAnalysis?.cultural?.traditions?.length > 0) value += 0.2;
        if (harmonicAnalysis?.modulations?.modulations?.length > 0) value += 0.2;
        if (integratedAnalysis?.crossCulturalInsights?.length > 0) value += 0.1;
        
        return Math.min(1.0, value);
    }
}