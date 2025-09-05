/**
 * Crescendo/Diminuendo Gradient Analyzer
 * Detects gradual dynamic changes (crescendo/diminuendo) with precise timing and intensity
 * Maps to standard musical notation markings and provides performance feedback
 */

class CrescendoDiminuendoAnalyzer {
    constructor() {
        // Analysis parameters
        this.gradientConfig = {
            detection: {
                minDuration: 1.0, // seconds - minimum duration for crescendo/diminuendo
                maxDuration: 30.0, // seconds - maximum reasonable duration
                minEnergyChange: 0.15, // minimum relative energy change
                consistencyThreshold: 0.7, // how consistent the gradient must be
                noiseThreshold: 0.1 // ignore small fluctuations
            },
            
            classification: {
                // Gradient strength categories
                subtle: { energyChangeRange: [0.15, 0.3], notation: 'hairpin' },
                moderate: { energyChangeRange: [0.3, 0.6], notation: 'standard' },
                dramatic: { energyChangeRange: [0.6, 1.0], notation: 'molto' },
                
                // Speed categories
                slow: { durationRange: [8, 30], marking: 'molto_gradual' },
                moderate_speed: { durationRange: [3, 8], marking: 'gradual' },
                fast: { durationRange: [1, 3], marking: 'quick' }
            },
            
            // Smoothing and analysis windows
            smoothing: {
                windowSize: 0.5, // seconds for gradient calculation
                overlapFactor: 0.5, // overlap between analysis windows
                trendWindow: 2.0 // seconds for trend analysis
            }
        };
        
        // Musical notation mapping
        this.notationMappings = {
            crescendo: {
                subtle: { symbol: '<', text: 'cresc.' },
                moderate: { symbol: '<', text: 'crescendo' },
                dramatic: { symbol: '<', text: 'molto cresc.' }
            },
            diminuendo: {
                subtle: { symbol: '>', text: 'dim.' },
                moderate: { symbol: '>', text: 'diminuendo' },
                dramatic: { symbol: '>', text: 'molto dim.' }
            }
        };
        
        // Analysis state
        this.gradientHistory = [];
        this.currentGradients = [];
    }
    
    async analyzeGradients(forensicData, dynamicLevels = null) {
        console.log('Analyzing crescendo/diminuendo gradients...');
        
        if (!forensicData || !forensicData.analysis) {
            return this.createEmptyGradientAnalysis();
        }
        
        // 1. Extract and smooth energy data
        const energyData = this.extractEnergyData(forensicData);
        
        if (energyData.length < 10) {
            return this.createEmptyGradientAnalysis();
        }
        
        // 2. Calculate energy gradients over time
        const energyGradients = this.calculateEnergyGradients(energyData);
        
        // 3. Detect gradient segments (crescendo/diminuendo)
        const gradientSegments = this.detectGradientSegments(energyGradients, energyData);
        
        // 4. Classify and validate gradients
        const classifiedGradients = this.classifyGradients(gradientSegments);
        
        // 5. Refine with musical context
        const refinedGradients = this.refineWithMusicalContext(classifiedGradients, dynamicLevels);
        
        // 6. Generate notation mappings
        const notationMappings = this.generateNotationMappings(refinedGradients);
        
        return {
            detectedGradients: refinedGradients,
            notationMappings,
            summary: this.generateGradientSummary(refinedGradients),
            recommendations: this.generateGradientRecommendations(refinedGradients),
            analysisMetadata: {
                totalDuration: energyData[energyData.length - 1].timestamp - energyData[0].timestamp,
                energyDataPoints: energyData.length,
                gradientSegments: gradientSegments.length
            }
        };
    }
    
    extractEnergyData(forensicData) {
        return forensicData.analysis
            .filter(frame => frame.dynamics && frame.dynamics.energy !== undefined)
            .map(frame => ({
                timestamp: frame.timestamp,
                energy: frame.dynamics.energy,
                velocity: frame.dynamics.velocity || 0,
                rms: frame.dynamics.rms || 0
            }));
    }
    
    calculateEnergyGradients(energyData) {
        const windowSize = this.gradientConfig.smoothing.windowSize;
        const overlap = this.gradientConfig.smoothing.overlapFactor;
        const stepSize = windowSize * (1 - overlap);
        
        const gradients = [];
        
        for (let start = 0; start < energyData.length; start += Math.floor(stepSize * 10)) {
            const windowEnd = Math.min(start + Math.floor(windowSize * 10), energyData.length);
            
            if (windowEnd - start < 3) break; // Need minimum points for gradient
            
            const windowData = energyData.slice(start, windowEnd);
            const gradient = this.calculateWindowGradient(windowData);
            
            gradients.push({
                startTime: windowData[0].timestamp,
                endTime: windowData[windowData.length - 1].timestamp,
                centerTime: (windowData[0].timestamp + windowData[windowData.length - 1].timestamp) / 2,
                gradient: gradient.slope,
                r_squared: gradient.r_squared,
                energyChange: gradient.energyChange,
                confidence: gradient.confidence,
                dataPoints: windowData.length
            });
        }
        
        return gradients;
    }
    
    calculateWindowGradient(windowData) {
        if (windowData.length < 2) {
            return { slope: 0, r_squared: 0, energyChange: 0, confidence: 0 };
        }
        
        // Linear regression to find energy trend
        const n = windowData.length;
        const times = windowData.map((d, i) => i); // Use indices for X values
        const energies = windowData.map(d => d.energy);
        
        const meanTime = times.reduce((sum, t) => sum + t, 0) / n;
        const meanEnergy = energies.reduce((sum, e) => sum + e, 0) / n;
        
        let numerator = 0;
        let denominator = 0;
        let totalSumSquares = 0;
        
        for (let i = 0; i < n; i++) {
            const timeDiff = times[i] - meanTime;
            const energyDiff = energies[i] - meanEnergy;
            numerator += timeDiff * energyDiff;
            denominator += timeDiff * timeDiff;
            totalSumSquares += energyDiff * energyDiff;
        }
        
        const slope = denominator !== 0 ? numerator / denominator : 0;
        
        // Calculate R-squared for trend strength
        let residualSumSquares = 0;
        for (let i = 0; i < n; i++) {
            const predicted = meanEnergy + slope * (times[i] - meanTime);
            residualSumSquares += Math.pow(energies[i] - predicted, 2);
        }
        
        const r_squared = totalSumSquares !== 0 ? 
            1 - (residualSumSquares / totalSumSquares) : 0;
        
        // Calculate actual energy change
        const energyChange = energies[energies.length - 1] - energies[0];
        
        // Confidence based on R-squared and data consistency
        const confidence = Math.min(1, r_squared * Math.sqrt(n / 3));
        
        return {
            slope,
            r_squared,
            energyChange,
            confidence
        };
    }
    
    detectGradientSegments(energyGradients, energyData) {
        const segments = [];
        let currentSegment = null;
        
        energyGradients.forEach((gradient, index) => {
            const isSignificantGradient = 
                Math.abs(gradient.gradient) > this.gradientConfig.detection.minEnergyChange / 10 &&
                gradient.confidence > this.gradientConfig.detection.consistencyThreshold;
            
            if (isSignificantGradient) {
                if (!currentSegment || 
                    this.hasGradientDirectionChanged(currentSegment, gradient)) {
                    
                    // End previous segment
                    if (currentSegment) {
                        this.finalizeSegment(currentSegment, energyData);
                        if (this.validateSegment(currentSegment)) {
                            segments.push(currentSegment);
                        }
                    }
                    
                    // Start new segment
                    currentSegment = {
                        startTime: gradient.startTime,
                        direction: gradient.gradient > 0 ? 'crescendo' : 'diminuendo',
                        gradients: [gradient],
                        totalEnergyChange: gradient.energyChange,
                        avgConfidence: gradient.confidence
                    };
                } else {
                    // Continue current segment
                    currentSegment.gradients.push(gradient);
                    currentSegment.totalEnergyChange += gradient.energyChange;
                    currentSegment.avgConfidence = 
                        (currentSegment.avgConfidence * (currentSegment.gradients.length - 1) + gradient.confidence) / 
                        currentSegment.gradients.length;
                    currentSegment.endTime = gradient.endTime;
                }
            } else {
                // End current segment if gradient becomes insignificant
                if (currentSegment) {
                    this.finalizeSegment(currentSegment, energyData);
                    if (this.validateSegment(currentSegment)) {
                        segments.push(currentSegment);
                    }
                    currentSegment = null;
                }
            }
        });
        
        // Handle final segment
        if (currentSegment) {
            this.finalizeSegment(currentSegment, energyData);
            if (this.validateSegment(currentSegment)) {
                segments.push(currentSegment);
            }
        }
        
        return segments;
    }
    
    hasGradientDirectionChanged(currentSegment, newGradient) {
        const currentDirection = currentSegment.direction;
        const newDirection = newGradient.gradient > 0 ? 'crescendo' : 'diminuendo';
        
        return currentDirection !== newDirection;
    }
    
    finalizeSegment(segment, energyData) {
        if (segment.gradients.length === 0) return;
        
        // Set timing if not already set
        if (!segment.endTime) {
            segment.endTime = segment.gradients[segment.gradients.length - 1].endTime;
        }
        segment.duration = segment.endTime - segment.startTime;
        
        // Calculate overall energy change for the segment
        const startEnergy = this.getEnergyAtTime(segment.startTime, energyData);
        const endEnergy = this.getEnergyAtTime(segment.endTime, energyData);
        segment.overallEnergyChange = endEnergy - startEnergy;
        segment.relativeEnergyChange = startEnergy > 0 ? 
            Math.abs(segment.overallEnergyChange) / startEnergy : 0;
        
        // Calculate gradient consistency
        segment.consistency = this.calculateSegmentConsistency(segment);
    }
    
    validateSegment(segment) {
        const config = this.gradientConfig.detection;
        
        // Check duration requirements
        if (segment.duration < config.minDuration || segment.duration > config.maxDuration) {
            return false;
        }
        
        // Check energy change requirements
        if (segment.relativeEnergyChange < config.minEnergyChange) {
            return false;
        }
        
        // Check consistency requirements
        if (segment.consistency < config.consistencyThreshold) {
            return false;
        }
        
        return true;
    }
    
    calculateSegmentConsistency(segment) {
        if (segment.gradients.length < 2) return 1;
        
        const gradientValues = segment.gradients.map(g => g.gradient);
        const expectedDirection = segment.direction === 'crescendo' ? 1 : -1;
        
        // Count gradients that go in the expected direction
        const consistentGradients = gradientValues.filter(g => 
            (expectedDirection > 0 && g > 0) || (expectedDirection < 0 && g < 0)
        );
        
        return consistentGradients.length / gradientValues.length;
    }
    
    getEnergyAtTime(timestamp, energyData) {
        // Find closest energy data point to timestamp
        let closest = energyData[0];
        let minDistance = Math.abs(timestamp - closest.timestamp);
        
        for (const data of energyData) {
            const distance = Math.abs(timestamp - data.timestamp);
            if (distance < minDistance) {
                minDistance = distance;
                closest = data;
            }
        }
        
        return closest.energy;
    }
    
    classifyGradients(gradientSegments) {
        return gradientSegments.map(segment => {
            const classification = this.classifySegment(segment);
            
            return {
                ...segment,
                classification
            };
        });
    }
    
    classifySegment(segment) {
        const classification = {
            strength: 'moderate',
            speed: 'moderate_speed',
            quality: 'good',
            musicalCharacter: 'balanced'
        };
        
        // Classify strength based on energy change
        const change = segment.relativeEnergyChange;
        if (change <= 0.3) {
            classification.strength = 'subtle';
        } else if (change <= 0.6) {
            classification.strength = 'moderate';
        } else {
            classification.strength = 'dramatic';
        }
        
        // Classify speed based on duration
        const duration = segment.duration;
        if (duration >= 8) {
            classification.speed = 'slow';
        } else if (duration >= 3) {
            classification.speed = 'moderate_speed';
        } else {
            classification.speed = 'fast';
        }
        
        // Assess quality based on consistency and confidence
        const qualityScore = (segment.consistency + segment.avgConfidence) / 2;
        if (qualityScore >= 0.8) {
            classification.quality = 'excellent';
        } else if (qualityScore >= 0.6) {
            classification.quality = 'good';
        } else if (qualityScore >= 0.4) {
            classification.quality = 'adequate';
        } else {
            classification.quality = 'poor';
        }
        
        // Determine musical character
        if (classification.strength === 'dramatic' && classification.speed === 'fast') {
            classification.musicalCharacter = 'dramatic';
        } else if (classification.strength === 'subtle' && classification.speed === 'slow') {
            classification.musicalCharacter = 'expressive';
        } else {
            classification.musicalCharacter = 'balanced';
        }
        
        return classification;
    }
    
    refineWithMusicalContext(classifiedGradients, dynamicLevels) {
        if (!dynamicLevels || dynamicLevels.length === 0) {
            return classifiedGradients;
        }
        
        return classifiedGradients.map(gradient => {
            // Find dynamic levels that overlap with this gradient
            const overlappingLevels = dynamicLevels.filter(level =>
                (level.startTime < gradient.endTime && level.endTime > gradient.startTime)
            );
            
            let refinedGradient = { ...gradient };
            
            if (overlappingLevels.length > 0) {
                // Analyze context with dynamic levels
                const contextAnalysis = this.analyzeGradientContext(gradient, overlappingLevels);
                refinedGradient.musicalContext = contextAnalysis;
                
                // Adjust confidence based on musical context
                if (contextAnalysis.supportsGradient) {
                    refinedGradient.avgConfidence *= 1.2;
                } else if (contextAnalysis.contradictsGradient) {
                    refinedGradient.avgConfidence *= 0.8;
                }
                
                refinedGradient.avgConfidence = Math.min(1, refinedGradient.avgConfidence);
            }
            
            return refinedGradient;
        });
    }
    
    analyzeGradientContext(gradient, dynamicLevels) {
        const context = {
            levelTransitions: dynamicLevels.length,
            supportsGradient: false,
            contradictsGradient: false,
            musicalLogic: 'neutral'
        };
        
        if (dynamicLevels.length >= 2) {
            // Check if dynamic levels support the gradient direction
            const firstLevel = dynamicLevels[0];
            const lastLevel = dynamicLevels[dynamicLevels.length - 1];
            
            const levelOrder = ['pp', 'p', 'mp', 'mf', 'f', 'ff'];
            const firstIndex = levelOrder.indexOf(firstLevel.level);
            const lastIndex = levelOrder.indexOf(lastLevel.level);
            
            if (firstIndex !== -1 && lastIndex !== -1) {
                const levelDirection = lastIndex > firstIndex ? 'crescendo' : 'diminuendo';
                
                if (levelDirection === gradient.direction) {
                    context.supportsGradient = true;
                    context.musicalLogic = 'supportive';
                } else {
                    context.contradictsGradient = true;
                    context.musicalLogic = 'contradictory';
                }
            }
        }
        
        return context;
    }
    
    generateNotationMappings(refinedGradients) {
        const mappings = {
            crescendoMarkings: [],
            diminuendoMarkings: [],
            combinedMarkings: []
        };
        
        refinedGradients.forEach(gradient => {
            const notation = this.getNotationForGradient(gradient);
            
            const marking = {
                startTime: gradient.startTime,
                endTime: gradient.endTime,
                duration: gradient.duration,
                direction: gradient.direction,
                strength: gradient.classification.strength,
                symbol: notation.symbol,
                text: notation.text,
                confidence: gradient.avgConfidence
            };
            
            if (gradient.direction === 'crescendo') {
                mappings.crescendoMarkings.push(marking);
            } else {
                mappings.diminuendoMarkings.push(marking);
            }
            
            mappings.combinedMarkings.push(marking);
        });
        
        return mappings;
    }
    
    getNotationForGradient(gradient) {
        const direction = gradient.direction;
        const strength = gradient.classification.strength;
        
        return this.notationMappings[direction][strength];
    }
    
    generateGradientSummary(refinedGradients) {
        const summary = {
            totalGradients: refinedGradients.length,
            crescendoCount: 0,
            diminuendoCount: 0,
            averageDuration: 0,
            strengthDistribution: {},
            qualityDistribution: {},
            overallGradientCharacter: 'moderate'
        };
        
        if (refinedGradients.length === 0) return summary;
        
        // Count directions
        refinedGradients.forEach(gradient => {
            if (gradient.direction === 'crescendo') {
                summary.crescendoCount++;
            } else {
                summary.diminuendoCount++;
            }
            
            // Count strength and quality distributions
            const strength = gradient.classification.strength;
            const quality = gradient.classification.quality;
            
            summary.strengthDistribution[strength] = (summary.strengthDistribution[strength] || 0) + 1;
            summary.qualityDistribution[quality] = (summary.qualityDistribution[quality] || 0) + 1;
        });
        
        // Calculate average duration
        summary.averageDuration = refinedGradients.reduce((sum, g) => sum + g.duration, 0) / refinedGradients.length;
        
        // Determine overall character
        const dramaticGradients = (summary.strengthDistribution.dramatic || 0);
        const subtleGradients = (summary.strengthDistribution.subtle || 0);
        const total = refinedGradients.length;
        
        if (dramaticGradients / total > 0.5) {
            summary.overallGradientCharacter = 'dramatic';
        } else if (subtleGradients / total > 0.5) {
            summary.overallGradientCharacter = 'subtle';
        } else {
            summary.overallGradientCharacter = 'balanced';
        }
        
        return summary;
    }
    
    generateGradientRecommendations(refinedGradients) {
        const recommendations = [];
        
        if (refinedGradients.length === 0) {
            recommendations.push({
                category: 'dynamic_expression',
                priority: 'medium',
                message: 'No crescendo or diminuendo detected - try incorporating gradual volume changes for musical expression'
            });
            return recommendations;
        }
        
        const summary = this.generateGradientSummary(refinedGradients);
        
        // Check for balance between crescendo and diminuendo
        const crescendoRatio = summary.crescendoCount / summary.totalGradients;
        if (crescendoRatio > 0.8) {
            recommendations.push({
                category: 'dynamic_balance',
                priority: 'low',
                message: 'Mostly crescendo detected - consider adding some diminuendo for dynamic variety'
            });
        } else if (crescendoRatio < 0.2) {
            recommendations.push({
                category: 'dynamic_balance',
                priority: 'low',
                message: 'Mostly diminuendo detected - consider adding some crescendo for dynamic variety'
            });
        }
        
        // Check gradient quality
        const poorQualityCount = summary.qualityDistribution.poor || 0;
        if (poorQualityCount > summary.totalGradients * 0.3) {
            recommendations.push({
                category: 'gradient_quality',
                priority: 'medium',
                message: 'Some gradual dynamics lack consistency - practice smooth, controlled volume changes'
            });
        }
        
        // Check gradient variety
        const strengthTypes = Object.keys(summary.strengthDistribution).length;
        if (strengthTypes < 2) {
            recommendations.push({
                category: 'dynamic_variety',
                priority: 'low',
                message: 'Limited variety in gradient strength - try incorporating both subtle and dramatic volume changes'
            });
        }
        
        // Check duration appropriateness
        if (summary.averageDuration < 2.0) {
            recommendations.push({
                category: 'gradient_duration',
                priority: 'low',
                message: 'Gradual dynamics are quite quick - consider extending some crescendo/diminuendo for greater effect'
            });
        } else if (summary.averageDuration > 10.0) {
            recommendations.push({
                category: 'gradient_duration',
                priority: 'low',
                message: 'Very long gradual dynamics detected - ensure they maintain listener interest throughout'
            });
        }
        
        return recommendations;
    }
    
    // Utility methods
    
    createEmptyGradientAnalysis() {
        return {
            detectedGradients: [],
            notationMappings: {
                crescendoMarkings: [],
                diminuendoMarkings: [],
                combinedMarkings: []
            },
            summary: {
                totalGradients: 0,
                crescendoCount: 0,
                diminuendoCount: 0,
                averageDuration: 0,
                strengthDistribution: {},
                qualityDistribution: {},
                overallGradientCharacter: 'none'
            },
            recommendations: [{
                category: 'data_insufficient',
                priority: 'info',
                message: 'Insufficient audio data for crescendo/diminuendo analysis'
            }],
            analysisMetadata: {
                totalDuration: 0,
                energyDataPoints: 0,
                gradientSegments: 0
            }
        };
    }
}