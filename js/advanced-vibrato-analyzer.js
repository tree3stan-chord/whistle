/**
 * Advanced Vibrato Analysis System
 * Sophisticated detection and classification of vibrato patterns in vocal performance
 * Goes beyond basic rate/depth to analyze vibrato quality, onset, and musical context
 */

class AdvancedVibratoAnalyzer {
    constructor() {
        // Vibrato analysis parameters
        this.analysisConfig = {
            // Detection thresholds
            detection: {
                minDepth: 8, // cents - minimum depth to consider vibrato
                maxDepth: 150, // cents - maximum reasonable vibrato depth
                minRate: 3.5, // Hz - minimum rate for vibrato
                maxRate: 8.5, // Hz - maximum rate for vibrato
                minDuration: 0.3, // seconds - minimum sustained time for vibrato
                consistencyThreshold: 0.6 // consistency required across time
            },
            
            // Classification parameters
            classification: {
                // Vibrato quality descriptors
                narrow: { depthRange: [8, 25] }, // cents
                moderate: { depthRange: [25, 60] },
                wide: { depthRange: [60, 150] },
                
                slow: { rateRange: [3.5, 5.0] }, // Hz
                moderate_rate: { rateRange: [5.0, 6.5] },
                fast: { rateRange: [6.5, 8.5] },
                
                // Onset characteristics
                immediate: { onsetDelay: [0, 0.1] }, // seconds
                delayed: { onsetDelay: [0.1, 0.5] },
                gradual: { onsetDelay: [0.5, 2.0] }
            },
            
            // Advanced analysis parameters
            advanced: {
                waveformAnalysis: true,
                symmetryAnalysis: true,
                modulationTracking: true,
                contextualAnalysis: true,
                breathCouplingDetection: true
            }
        };
        
        // Vibrato quality models based on classical vocal technique
        this.vibratoModels = {
            // Professional vibrato characteristics
            professional: {
                rateRange: [5.5, 7.0],
                depthRange: [30, 80],
                consistency: [0.8, 1.0],
                symmetry: [0.7, 1.0],
                onsetControl: [0.6, 1.0]
            },
            
            // Student/developing vibrato
            developing: {
                rateRange: [4.0, 8.0],
                depthRange: [15, 120],
                consistency: [0.4, 0.8],
                symmetry: [0.4, 0.8],
                onsetControl: [0.2, 0.7]
            },
            
            // Natural/untrained vibrato
            natural: {
                rateRange: [4.5, 7.5],
                depthRange: [20, 100],
                consistency: [0.3, 0.7],
                symmetry: [0.3, 0.7],
                onsetControl: [0.1, 0.5]
            },
            
            // Tremolo (often confused with vibrato)
            tremolo: {
                rateRange: [8.5, 15.0],
                depthRange: [10, 60],
                consistency: [0.6, 0.9],
                symmetry: [0.5, 0.8],
                onsetControl: [0.3, 0.8]
            }
        };
        
        // Analysis state
        this.analysisHistory = [];
        this.currentVibratoState = null;
        this.vibratoSegments = [];
    }
    
    async analyzeVibratoInDepth(forensicData, pitchTrajectory, timeWindow = null) {
        console.log('Performing advanced vibrato analysis...');
        
        // Extract vibrato candidates from forensic data
        const vibratoCandidates = this.extractVibratoCandidates(forensicData, timeWindow);
        
        if (vibratoCandidates.length === 0) {
            return this.createNoVibratoResult();
        }
        
        const analysisResults = [];
        
        for (const candidate of vibratoCandidates) {
            // Detailed analysis of each vibrato segment
            const detailedAnalysis = await this.analyzeVibratoSegment(candidate, pitchTrajectory);
            
            if (detailedAnalysis.isValidVibrato) {
                analysisResults.push(detailedAnalysis);
            }
        }
        
        // Combine results and generate comprehensive vibrato profile
        return this.generateVibratoProfile(analysisResults, forensicData);
    }
    
    extractVibratoCandidates(forensicData, timeWindow) {
        const candidates = [];
        let currentCandidate = null;
        
        if (!forensicData || !forensicData.analysis) {
            return candidates;
        }
        
        const relevantFrames = timeWindow ? 
            forensicData.analysis.filter(frame => 
                frame.timestamp >= timeWindow.start && frame.timestamp <= timeWindow.end
            ) : forensicData.analysis;
        
        relevantFrames.forEach((frame, index) => {
            if (frame.vibrato && frame.vibrato.present) {
                if (!currentCandidate) {
                    // Start new vibrato candidate
                    currentCandidate = {
                        startTime: frame.timestamp,
                        frames: [frame],
                        pitchPoints: [frame.pitch.fundamental],
                        timestamps: [frame.timestamp]
                    };
                } else {
                    // Continue existing candidate
                    currentCandidate.frames.push(frame);
                    currentCandidate.pitchPoints.push(frame.pitch.fundamental);
                    currentCandidate.timestamps.push(frame.timestamp);
                    currentCandidate.endTime = frame.timestamp;
                }
            } else if (currentCandidate) {
                // End current candidate
                currentCandidate.duration = currentCandidate.endTime - currentCandidate.startTime;
                
                if (currentCandidate.duration >= this.analysisConfig.detection.minDuration) {
                    candidates.push(currentCandidate);
                }
                currentCandidate = null;
            }
        });
        
        // Handle final candidate
        if (currentCandidate) {
            currentCandidate.endTime = currentCandidate.timestamps[currentCandidate.timestamps.length - 1];
            currentCandidate.duration = currentCandidate.endTime - currentCandidate.startTime;
            
            if (currentCandidate.duration >= this.analysisConfig.detection.minDuration) {
                candidates.push(currentCandidate);
            }
        }
        
        return candidates;
    }
    
    async analyzeVibratoSegment(candidate, pitchTrajectory) {
        const analysis = {
            startTime: candidate.startTime,
            endTime: candidate.endTime,
            duration: candidate.duration,
            isValidVibrato: false,
            rate: 0,
            depth: 0,
            consistency: 0,
            symmetry: 0,
            onset: {},
            waveform: {},
            quality: {},
            classification: null
        };
        
        // 1. Rate Analysis - More sophisticated than basic frequency counting
        const rateAnalysis = this.analyzeVibratoRate(candidate);
        analysis.rate = rateAnalysis.primaryRate;
        analysis.rateVariability = rateAnalysis.variability;
        analysis.rateStability = rateAnalysis.stability;
        
        // 2. Depth Analysis - Peak-to-peak and RMS depth
        const depthAnalysis = this.analyzeVibratoDepth(candidate);
        analysis.depth = depthAnalysis.averageDepth;
        analysis.depthVariability = depthAnalysis.variability;
        analysis.depthProfile = depthAnalysis.profile;
        
        // 3. Consistency Analysis - How regular is the vibrato?
        analysis.consistency = this.analyzeVibratoConsistency(candidate);
        
        // 4. Symmetry Analysis - Is the vibrato balanced above/below center pitch?
        analysis.symmetry = this.analyzeVibratoSymmetry(candidate);
        
        // 5. Onset Analysis - How does the vibrato begin?
        analysis.onset = this.analyzeVibratoOnset(candidate, pitchTrajectory);
        
        // 6. Waveform Analysis - Shape characteristics
        if (this.analysisConfig.advanced.waveformAnalysis) {
            analysis.waveform = this.analyzeVibratoWaveform(candidate);
        }
        
        // 7. Validate as true vibrato
        analysis.isValidVibrato = this.validateVibrato(analysis);
        
        if (analysis.isValidVibrato) {
            // 8. Classify vibrato quality and type
            analysis.classification = this.classifyVibrato(analysis);
            analysis.quality = this.assessVibratoQuality(analysis);
        }
        
        return analysis;
    }
    
    analyzeVibratoRate(candidate) {
        // Advanced rate analysis using multiple methods
        const pitchPoints = candidate.pitchPoints;
        const timestamps = candidate.timestamps;
        const duration = candidate.duration;
        
        if (pitchPoints.length < 10) {
            return { primaryRate: 0, variability: 0, stability: 0 };
        }
        
        // Method 1: Zero-crossing analysis
        const zeroCrossings = this.findZeroCrossings(pitchPoints, timestamps);
        const zeroCrossingRate = zeroCrossings.length / (2 * duration); // Half-cycles to full cycles
        
        // Method 2: Autocorrelation analysis
        const autocorrRate = this.calculateAutocorrelationRate(pitchPoints, timestamps);
        
        // Method 3: FFT-based periodicity detection
        const fftRate = this.calculateFFTBasedRate(pitchPoints, timestamps);
        
        // Combine methods with weighted average
        const rates = [zeroCrossingRate, autocorrRate, fftRate].filter(r => r > 0);
        const primaryRate = rates.length > 0 ? rates.reduce((sum, r) => sum + r, 0) / rates.length : 0;
        
        // Calculate rate variability over time
        const rateVariability = this.calculateRateVariability(candidate);
        
        // Rate stability (consistency over the vibrato duration)
        const rateStability = 1 - (rateVariability / primaryRate);
        
        return {
            primaryRate,
            variability: rateVariability,
            stability: Math.max(0, rateStability),
            methods: {
                zeroCrossing: zeroCrossingRate,
                autocorrelation: autocorrRate,
                fft: fftRate
            }
        };
    }
    
    findZeroCrossings(pitchPoints, timestamps) {
        // Find zero crossings relative to the mean pitch
        const meanPitch = pitchPoints.reduce((sum, p) => sum + p, 0) / pitchPoints.length;
        const deviations = pitchPoints.map(p => p - meanPitch);
        
        const crossings = [];
        for (let i = 1; i < deviations.length; i++) {
            if ((deviations[i - 1] >= 0) !== (deviations[i] >= 0)) {
                // Zero crossing detected
                crossings.push({
                    index: i,
                    timestamp: timestamps[i],
                    direction: deviations[i] > deviations[i - 1] ? 'rising' : 'falling'
                });
            }
        }
        
        return crossings;
    }
    
    calculateAutocorrelationRate(pitchPoints, timestamps) {
        // Autocorrelation-based rate calculation
        const sampleRate = 1 / ((timestamps[timestamps.length - 1] - timestamps[0]) / timestamps.length);
        const autocorr = this.computeAutocorrelation(pitchPoints);
        
        // Find the first significant peak after lag 0
        let maxCorr = 0;
        let bestLag = 0;
        
        const minLag = Math.floor(sampleRate / this.analysisConfig.detection.maxRate);
        const maxLag = Math.floor(sampleRate / this.analysisConfig.detection.minRate);
        
        for (let lag = minLag; lag < Math.min(maxLag, autocorr.length); lag++) {
            if (autocorr[lag] > maxCorr) {
                maxCorr = autocorr[lag];
                bestLag = lag;
            }
        }
        
        return bestLag > 0 ? sampleRate / bestLag : 0;
    }
    
    calculateFFTBasedRate(pitchPoints, timestamps) {
        // FFT-based periodicity detection
        if (pitchPoints.length < 16) return 0;
        
        // Detrend the signal
        const detrended = this.detrendSignal(pitchPoints);
        
        // Apply window and compute FFT
        const windowed = this.applyWindow(detrended, 'hanning');
        const fft = this.computeFFT(windowed);
        const magnitude = fft.map(complex => Math.sqrt(complex.real ** 2 + complex.imag ** 2));
        
        // Find peak in the vibrato frequency range
        const duration = timestamps[timestamps.length - 1] - timestamps[0];
        const freqResolution = 1 / duration;
        
        let maxMagnitude = 0;
        let peakFreq = 0;
        
        const minBin = Math.floor(this.analysisConfig.detection.minRate / freqResolution);
        const maxBin = Math.floor(this.analysisConfig.detection.maxRate / freqResolution);
        
        for (let bin = minBin; bin <= maxBin && bin < magnitude.length; bin++) {
            if (magnitude[bin] > maxMagnitude) {
                maxMagnitude = magnitude[bin];
                peakFreq = bin * freqResolution;
            }
        }
        
        return peakFreq;
    }
    
    analyzeVibratoDepth(candidate) {
        const pitchPoints = candidate.pitchPoints;
        if (pitchPoints.length === 0) {
            return { averageDepth: 0, variability: 0, profile: [] };
        }
        
        const meanPitch = pitchPoints.reduce((sum, p) => sum + p, 0) / pitchPoints.length;
        
        // Calculate instantaneous depths (peak-to-peak in sliding windows)
        const windowSize = Math.max(3, Math.floor(pitchPoints.length / 10));
        const depths = [];
        
        for (let i = 0; i <= pitchPoints.length - windowSize; i++) {
            const window = pitchPoints.slice(i, i + windowSize);
            const min = Math.min(...window);
            const max = Math.max(...window);
            const depth = this.frequencyToCents(max, min); // Convert to cents
            depths.push(depth);
        }
        
        // Calculate depth statistics
        const averageDepth = depths.reduce((sum, d) => sum + d, 0) / depths.length;
        const depthVariability = this.calculateVariance(depths);
        
        // Create depth profile over time
        const profile = depths.map((depth, index) => ({
            timestamp: candidate.timestamps[index],
            depth,
            relativeMagnitude: depth / averageDepth
        }));
        
        return {
            averageDepth,
            variability: Math.sqrt(depthVariability),
            profile,
            statistics: {
                min: Math.min(...depths),
                max: Math.max(...depths),
                median: this.calculateMedian(depths)
            }
        };
    }
    
    frequencyToCents(freq1, freq2) {
        // Convert frequency difference to cents
        if (freq1 <= 0 || freq2 <= 0) return 0;
        return 1200 * Math.log2(Math.max(freq1, freq2) / Math.min(freq1, freq2));
    }
    
    analyzeVibratoConsistency(candidate) {
        // Measure how regular/consistent the vibrato is
        const pitchPoints = candidate.pitchPoints;
        const timestamps = candidate.timestamps;
        
        if (pitchPoints.length < 10) return 0;
        
        // Find cycles in the vibrato
        const cycles = this.extractVibratoCycles(pitchPoints, timestamps);
        
        if (cycles.length < 2) return 0;
        
        // Calculate consistency metrics
        const cycleLengths = cycles.map(cycle => cycle.duration);
        const cycleAmplitudes = cycles.map(cycle => cycle.amplitude);
        
        // Coefficient of variation (lower = more consistent)
        const lengthCV = this.calculateCV(cycleLengths);
        const amplitudeCV = this.calculateCV(cycleAmplitudes);
        
        // Consistency score (0-1, higher = more consistent)
        const lengthConsistency = Math.max(0, 1 - lengthCV);
        const amplitudeConsistency = Math.max(0, 1 - amplitudeCV);
        
        return (lengthConsistency + amplitudeConsistency) / 2;
    }
    
    extractVibratoCycles(pitchPoints, timestamps) {
        const meanPitch = pitchPoints.reduce((sum, p) => sum + p, 0) / pitchPoints.length;
        const deviations = pitchPoints.map(p => p - meanPitch);
        
        const cycles = [];
        let cycleStart = null;
        let lastCrossing = null;
        
        // Find cycles based on zero crossings
        for (let i = 1; i < deviations.length; i++) {
            if ((deviations[i - 1] >= 0) !== (deviations[i] >= 0)) {
                const crossing = {
                    index: i,
                    timestamp: timestamps[i],
                    direction: deviations[i] > deviations[i - 1] ? 'rising' : 'falling'
                };
                
                if (cycleStart && crossing.direction === cycleStart.direction) {
                    // Complete cycle
                    const cycleData = {
                        start: cycleStart,
                        end: crossing,
                        duration: crossing.timestamp - cycleStart.timestamp,
                        amplitude: this.calculateCycleAmplitude(pitchPoints, cycleStart.index, crossing.index),
                        pitchPoints: pitchPoints.slice(cycleStart.index, crossing.index + 1)
                    };
                    cycles.push(cycleData);
                    cycleStart = crossing;
                } else if (!cycleStart) {
                    cycleStart = crossing;
                }
                
                lastCrossing = crossing;
            }
        }
        
        return cycles;
    }
    
    calculateCycleAmplitude(pitchPoints, startIndex, endIndex) {
        const cyclePoints = pitchPoints.slice(startIndex, endIndex + 1);
        const min = Math.min(...cyclePoints);
        const max = Math.max(...cyclePoints);
        return max - min;
    }
    
    analyzeVibratoSymmetry(candidate) {
        // Analyze whether vibrato is symmetric around the center pitch
        const pitchPoints = candidate.pitchPoints;
        const meanPitch = pitchPoints.reduce((sum, p) => sum + p, 0) / pitchPoints.length;
        
        const deviations = pitchPoints.map(p => p - meanPitch);
        const positiveDeviations = deviations.filter(d => d > 0);
        const negativeDeviations = deviations.filter(d => d < 0).map(d => Math.abs(d));
        
        if (positiveDeviations.length === 0 || negativeDeviations.length === 0) {
            return 0; // No symmetry if vibrato only goes in one direction
        }
        
        const avgPositive = positiveDeviations.reduce((sum, d) => sum + d, 0) / positiveDeviations.length;
        const avgNegative = negativeDeviations.reduce((sum, d) => sum + d, 0) / negativeDeviations.length;
        
        // Symmetry score (1 = perfect symmetry, 0 = completely asymmetric)
        const symmetryRatio = Math.min(avgPositive, avgNegative) / Math.max(avgPositive, avgNegative);
        
        return symmetryRatio;
    }
    
    analyzeVibratoOnset(candidate, pitchTrajectory) {
        // Analyze how the vibrato begins
        const onsetAnalysis = {
            delay: 0,
            type: 'immediate',
            gradualness: 0,
            control: 0
        };
        
        // Find the note start before this vibrato
        const vibratoStart = candidate.startTime;
        let noteStartTime = vibratoStart;
        
        if (pitchTrajectory) {
            // Look for the beginning of the sustained note
            const relevantTrajectory = pitchTrajectory.filter(point => point.timestamp <= vibratoStart);
            
            if (relevantTrajectory.length > 0) {
                // Find where pitch stabilizes before vibrato
                for (let i = relevantTrajectory.length - 1; i >= 0; i--) {
                    const point = relevantTrajectory[i];
                    if (Math.abs(point.frequency - candidate.pitchPoints[0]) > 50) { // 50 cents difference
                        noteStartTime = i < relevantTrajectory.length - 1 ? relevantTrajectory[i + 1].timestamp : vibratoStart;
                        break;
                    }
                }
            }
        }
        
        onsetAnalysis.delay = vibratoStart - noteStartTime;
        
        // Classify onset type
        if (onsetAnalysis.delay < 0.1) {
            onsetAnalysis.type = 'immediate';
        } else if (onsetAnalysis.delay < 0.5) {
            onsetAnalysis.type = 'delayed';
        } else {
            onsetAnalysis.type = 'gradual';
        }
        
        // Analyze gradualness - how smoothly does vibrato develop?
        if (candidate.frames.length > 5) {
            const earlyFrames = candidate.frames.slice(0, Math.min(5, candidate.frames.length));
            const vibratoDepths = earlyFrames.map(frame => frame.vibrato.depth || 0);
            
            // Check if vibrato grows gradually
            let isGradual = true;
            for (let i = 1; i < vibratoDepths.length; i++) {
                if (vibratoDepths[i] < vibratoDepths[i - 1]) {
                    isGradual = false;
                    break;
                }
            }
            
            onsetAnalysis.gradualness = isGradual ? 1 : 0.5;
        }
        
        // Control assessment (smoother onset = better control)
        onsetAnalysis.control = onsetAnalysis.gradualness * (onsetAnalysis.delay > 0.1 ? 1 : 0.7);
        
        return onsetAnalysis;
    }
    
    analyzeVibratoWaveform(candidate) {
        // Analyze the shape characteristics of the vibrato waveform
        const pitchPoints = candidate.pitchPoints;
        const timestamps = candidate.timestamps;
        
        if (pitchPoints.length < 10) {
            return { shape: 'insufficient_data', characteristics: {} };
        }
        
        const waveformAnalysis = {
            shape: 'sinusoidal', // Default assumption
            characteristics: {
                smoothness: 0,
                peakSharpness: 0,
                asymmetry: 0,
                harmonics: []
            }
        };
        
        // Detrend and normalize
        const meanPitch = pitchPoints.reduce((sum, p) => sum + p, 0) / pitchPoints.length;
        const detrended = pitchPoints.map(p => p - meanPitch);
        const maxAbs = Math.max(...detrended.map(Math.abs));
        const normalized = detrended.map(d => d / maxAbs);
        
        // Analyze smoothness (low high-frequency content = smoother)
        waveformAnalysis.characteristics.smoothness = this.calculateSmoothness(normalized);
        
        // Analyze peak sharpness
        waveformAnalysis.characteristics.peakSharpness = this.calculatePeakSharpness(normalized);
        
        // Classify waveform shape
        if (waveformAnalysis.characteristics.smoothness > 0.8) {
            waveformAnalysis.shape = 'sinusoidal';
        } else if (waveformAnalysis.characteristics.peakSharpness > 0.7) {
            waveformAnalysis.shape = 'triangular';
        } else if (waveformAnalysis.characteristics.smoothness < 0.3) {
            waveformAnalysis.shape = 'irregular';
        } else {
            waveformAnalysis.shape = 'mixed';
        }
        
        return waveformAnalysis;
    }
    
    validateVibrato(analysis) {
        // Validate that this is actually vibrato, not tremolo or other artifacts
        const config = this.analysisConfig.detection;
        
        // Check basic requirements
        if (analysis.rate < config.minRate || analysis.rate > config.maxRate) {
            return false;
        }
        
        if (analysis.depth < config.minDepth || analysis.depth > config.maxDepth) {
            return false;
        }
        
        if (analysis.consistency < config.consistencyThreshold) {
            return false;
        }
        
        if (analysis.duration < config.minDuration) {
            return false;
        }
        
        // Additional validation criteria
        if (analysis.symmetry < 0.3) {
            return false; // Too asymmetric
        }
        
        return true;
    }
    
    classifyVibrato(analysis) {
        // Classify vibrato type and quality
        const classification = {
            type: 'unknown',
            quality: 'developing',
            confidence: 0,
            characteristics: []
        };
        
        // Rate classification
        const rateClassification = this.classifyByRate(analysis.rate);
        const depthClassification = this.classifyByDepth(analysis.depth);
        
        classification.characteristics.push(rateClassification, depthClassification);
        
        // Quality assessment based on multiple factors
        let qualityScore = 0;
        
        // Rate quality (ideal range 5.5-7.0 Hz)
        if (analysis.rate >= 5.5 && analysis.rate <= 7.0) {
            qualityScore += 0.3;
        } else if (analysis.rate >= 4.5 && analysis.rate <= 8.0) {
            qualityScore += 0.2;
        } else {
            qualityScore += 0.1;
        }
        
        // Depth quality (ideal range 30-80 cents)
        if (analysis.depth >= 30 && analysis.depth <= 80) {
            qualityScore += 0.25;
        } else if (analysis.depth >= 20 && analysis.depth <= 100) {
            qualityScore += 0.15;
        } else {
            qualityScore += 0.05;
        }
        
        // Consistency quality
        qualityScore += analysis.consistency * 0.25;
        
        // Symmetry quality
        qualityScore += analysis.symmetry * 0.1;
        
        // Control quality (onset characteristics)
        qualityScore += analysis.onset.control * 0.1;
        
        // Classify quality level
        if (qualityScore >= 0.8) {
            classification.quality = 'professional';
        } else if (qualityScore >= 0.6) {
            classification.quality = 'advanced';
        } else if (qualityScore >= 0.4) {
            classification.quality = 'intermediate';
        } else if (qualityScore >= 0.2) {
            classification.quality = 'developing';
        } else {
            classification.quality = 'basic';
        }
        
        classification.confidence = qualityScore;
        
        // Type classification (professional, developing, etc.)
        classification.type = this.determineVibratoType(analysis);
        
        return classification;
    }
    
    classifyByRate(rate) {
        if (rate < 5.0) return 'slow';
        if (rate <= 6.5) return 'moderate';
        if (rate <= 8.5) return 'fast';
        return 'very_fast';
    }
    
    classifyByDepth(depth) {
        if (depth < 25) return 'narrow';
        if (depth <= 60) return 'moderate';
        if (depth <= 100) return 'wide';
        return 'very_wide';
    }
    
    determineVibratoType(analysis) {
        // Match against vibrato models
        let bestMatch = 'natural';
        let bestScore = -1;
        
        for (const [type, model] of Object.entries(this.vibratoModels)) {
            let score = 0;
            let criteria = 0;
            
            // Rate matching
            if (analysis.rate >= model.rateRange[0] && analysis.rate <= model.rateRange[1]) {
                score += 1;
            }
            criteria += 1;
            
            // Depth matching
            if (analysis.depth >= model.depthRange[0] && analysis.depth <= model.depthRange[1]) {
                score += 1;
            }
            criteria += 1;
            
            // Consistency matching
            if (analysis.consistency >= model.consistency[0] && analysis.consistency <= model.consistency[1]) {
                score += 1;
            }
            criteria += 1;
            
            // Symmetry matching
            if (analysis.symmetry >= model.symmetry[0] && analysis.symmetry <= model.symmetry[1]) {
                score += 1;
            }
            criteria += 1;
            
            // Onset control matching
            if (analysis.onset.control >= model.onsetControl[0] && analysis.onset.control <= model.onsetControl[1]) {
                score += 1;
            }
            criteria += 1;
            
            const normalizedScore = score / criteria;
            if (normalizedScore > bestScore) {
                bestScore = normalizedScore;
                bestMatch = type;
            }
        }
        
        return bestMatch;
    }
    
    assessVibratoQuality(analysis) {
        // Comprehensive quality assessment
        return {
            overall: analysis.classification.confidence,
            technical: {
                rate: this.assessRateQuality(analysis.rate),
                depth: this.assessDepthQuality(analysis.depth),
                consistency: analysis.consistency,
                symmetry: analysis.symmetry
            },
            musical: {
                control: analysis.onset.control,
                expression: this.calculateExpressiveValue(analysis),
                appropriateness: this.assessContextualFit(analysis)
            },
            recommendations: this.generateRecommendations(analysis)
        };
    }
    
    assessRateQuality(rate) {
        // Rate quality based on vocal pedagogy standards
        if (rate >= 5.5 && rate <= 7.0) return 1.0; // Ideal
        if (rate >= 5.0 && rate <= 8.0) return 0.8; // Good
        if (rate >= 4.0 && rate <= 8.5) return 0.6; // Acceptable
        return 0.3; // Needs work
    }
    
    assessDepthQuality(depth) {
        // Depth quality assessment
        if (depth >= 30 && depth <= 80) return 1.0; // Ideal
        if (depth >= 20 && depth <= 100) return 0.8; // Good
        if (depth >= 15 && depth <= 120) return 0.6; // Acceptable
        return 0.3; // Needs work
    }
    
    calculateExpressiveValue(analysis) {
        // How expressive/musical is this vibrato?
        let expressiveScore = 0;
        
        // Controlled onset adds expression
        expressiveScore += analysis.onset.control * 0.4;
        
        // Moderate depth variations can add expression
        if (analysis.depthVariability && analysis.depthVariability < analysis.depth * 0.3) {
            expressiveScore += 0.3;
        }
        
        // Good waveform shape adds expression
        if (analysis.waveform && analysis.waveform.characteristics.smoothness > 0.7) {
            expressiveScore += 0.3;
        }
        
        return Math.min(1.0, expressiveScore);
    }
    
    assessContextualFit(analysis) {
        // This would assess if the vibrato fits the musical context
        // For now, return a neutral score
        return 0.7;
    }
    
    generateRecommendations(analysis) {
        const recommendations = [];
        
        if (analysis.rate < 5.0) {
            recommendations.push('Consider increasing vibrato rate - current rate is slower than typical');
        } else if (analysis.rate > 8.0) {
            recommendations.push('Consider slowing vibrato rate - current rate may sound rushed');
        }
        
        if (analysis.depth < 20) {
            recommendations.push('Vibrato depth could be increased for more expressiveness');
        } else if (analysis.depth > 100) {
            recommendations.push('Vibrato depth is quite wide - consider moderating for more control');
        }
        
        if (analysis.consistency < 0.6) {
            recommendations.push('Focus on vibrato consistency - practice maintaining steady rate and depth');
        }
        
        if (analysis.symmetry < 0.6) {
            recommendations.push('Work on vibrato symmetry - ensure equal excursion above and below center pitch');
        }
        
        if (analysis.onset.delay < 0.1 && analysis.onset.control < 0.6) {
            recommendations.push('Practice delayed vibrato onset for better musical control');
        }
        
        return recommendations;
    }
    
    // Utility methods
    
    createNoVibratoResult() {
        return {
            hasVibrato: false,
            segments: [],
            overallAssessment: {
                averageRate: 0,
                averageDepth: 0,
                consistency: 0,
                quality: 'none'
            }
        };
    }
    
    generateVibratoProfile(analysisResults, forensicData) {
        if (analysisResults.length === 0) {
            return this.createNoVibratoResult();
        }
        
        // Combine all analysis results into comprehensive profile
        const profile = {
            hasVibrato: true,
            segments: analysisResults,
            overallAssessment: {
                averageRate: analysisResults.reduce((sum, r) => sum + r.rate, 0) / analysisResults.length,
                averageDepth: analysisResults.reduce((sum, r) => sum + r.depth, 0) / analysisResults.length,
                consistency: analysisResults.reduce((sum, r) => sum + r.consistency, 0) / analysisResults.length,
                quality: this.determineOverallQuality(analysisResults)
            },
            musicalAnalysis: {
                totalVibratoTime: analysisResults.reduce((sum, r) => sum + r.duration, 0),
                vibratoPercentage: this.calculateVibratoPercentage(analysisResults, forensicData),
                qualityDistribution: this.analyzeQualityDistribution(analysisResults)
            },
            recommendations: this.generateOverallRecommendations(analysisResults)
        };
        
        return profile;
    }
    
    determineOverallQuality(analysisResults) {
        const qualityLevels = ['basic', 'developing', 'intermediate', 'advanced', 'professional'];
        const qualityScores = analysisResults.map(r => qualityLevels.indexOf(r.classification.quality));
        const averageQualityScore = qualityScores.reduce((sum, s) => sum + s, 0) / qualityScores.length;
        
        return qualityLevels[Math.round(averageQualityScore)];
    }
    
    calculateVibratoPercentage(analysisResults, forensicData) {
        const totalVibratoTime = analysisResults.reduce((sum, r) => sum + r.duration, 0);
        const totalAnalysisTime = forensicData.analysis ? 
            forensicData.analysis[forensicData.analysis.length - 1].timestamp - forensicData.analysis[0].timestamp : 1;
        
        return (totalVibratoTime / totalAnalysisTime) * 100;
    }
    
    analyzeQualityDistribution(analysisResults) {
        const distribution = {};
        analysisResults.forEach(result => {
            const quality = result.classification.quality;
            distribution[quality] = (distribution[quality] || 0) + 1;
        });
        
        return distribution;
    }
    
    generateOverallRecommendations(analysisResults) {
        // Generate overall recommendations based on all vibrato segments
        const allRecommendations = analysisResults.flatMap(r => r.quality.recommendations);
        
        // Count frequency of each recommendation type
        const recommendationCounts = {};
        allRecommendations.forEach(rec => {
            const key = rec.substring(0, 20); // First 20 chars as key
            recommendationCounts[key] = (recommendationCounts[key] || 0) + 1;
        });
        
        // Return most common recommendations
        return Object.entries(recommendationCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([key]) => allRecommendations.find(rec => rec.startsWith(key)));
    }
    
    // Mathematical utility methods
    
    computeAutocorrelation(signal) {
        const N = signal.length;
        const result = new Float32Array(N);
        
        for (let lag = 0; lag < N; lag++) {
            let correlation = 0;
            for (let i = 0; i < N - lag; i++) {
                correlation += signal[i] * signal[i + lag];
            }
            result[lag] = correlation;
        }
        
        return result;
    }
    
    detrendSignal(signal) {
        // Remove linear trend
        const N = signal.length;
        const indices = Array.from({ length: N }, (_, i) => i);
        
        // Simple linear regression
        const meanX = (N - 1) / 2;
        const meanY = signal.reduce((sum, y) => sum + y, 0) / N;
        
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < N; i++) {
            numerator += (i - meanX) * (signal[i] - meanY);
            denominator += (i - meanX) ** 2;
        }
        
        const slope = denominator !== 0 ? numerator / denominator : 0;
        const intercept = meanY - slope * meanX;
        
        return signal.map((y, i) => y - (slope * i + intercept));
    }
    
    applyWindow(signal, windowType) {
        const N = signal.length;
        const windowed = new Float32Array(N);
        
        for (let i = 0; i < N; i++) {
            let windowValue = 1;
            
            if (windowType === 'hanning') {
                windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
            }
            
            windowed[i] = signal[i] * windowValue;
        }
        
        return windowed;
    }
    
    computeFFT(signal) {
        // Simplified FFT implementation
        const N = signal.length;
        const fft = new Array(N);
        
        for (let k = 0; k < N; k++) {
            let real = 0;
            let imag = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = -2 * Math.PI * k * n / N;
                real += signal[n] * Math.cos(angle);
                imag += signal[n] * Math.sin(angle);
            }
            
            fft[k] = { real, imag };
        }
        
        return fft;
    }
    
    calculateVariance(values) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    }
    
    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            return sorted[mid];
        }
    }
    
    calculateCV(values) {
        // Coefficient of variation
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = this.calculateVariance(values);
        return mean !== 0 ? Math.sqrt(variance) / mean : 0;
    }
    
    calculateRateVariability(candidate) {
        // Calculate how much the vibrato rate varies over time
        const cycles = this.extractVibratoCycles(candidate.pitchPoints, candidate.timestamps);
        
        if (cycles.length < 2) return 0;
        
        const rates = [];
        for (let i = 0; i < cycles.length; i++) {
            const rate = 1 / cycles[i].duration; // Cycles per second
            rates.push(rate);
        }
        
        return this.calculateVariance(rates);
    }
    
    calculateSmoothness(signal) {
        // Measure smoothness based on high-frequency content
        if (signal.length < 4) return 0;
        
        // Calculate second derivative approximation
        let roughness = 0;
        for (let i = 1; i < signal.length - 1; i++) {
            const secondDerivative = signal[i + 1] - 2 * signal[i] + signal[i - 1];
            roughness += Math.abs(secondDerivative);
        }
        
        // Normalize and convert to smoothness (0-1, higher = smoother)
        const maxPossibleRoughness = 4 * signal.length; // Theoretical maximum
        return Math.max(0, 1 - (roughness / maxPossibleRoughness));
    }
    
    calculatePeakSharpness(signal) {
        // Measure how sharp the peaks are
        const peaks = [];
        
        for (let i = 1; i < signal.length - 1; i++) {
            if ((signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) ||
                (signal[i] < signal[i - 1] && signal[i] < signal[i + 1])) {
                peaks.push(i);
            }
        }
        
        if (peaks.length === 0) return 0;
        
        // Calculate average sharpness of peaks
        let totalSharpness = 0;
        
        peaks.forEach(peakIndex => {
            const peakValue = Math.abs(signal[peakIndex]);
            const leftValue = Math.abs(signal[peakIndex - 1]);
            const rightValue = Math.abs(signal[peakIndex + 1]);
            const avgNeighbor = (leftValue + rightValue) / 2;
            
            if (avgNeighbor > 0) {
                totalSharpness += peakValue / avgNeighbor - 1; // Sharpness ratio
            }
        });
        
        return Math.min(1, totalSharpness / peaks.length);
    }
}