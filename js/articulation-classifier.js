/**
 * Articulation Classifier - Vocal technique and articulation detection
 * Part of the Forensic Audio Analysis Engine
 */

class ArticulationClassifier {
    constructor(config = {}) {
        this.config = config;
        
        // Classification thresholds and parameters
        this.thresholds = {
            vibrato: {
                minRate: 3.0,    // Hz
                maxRate: 12.0,   // Hz
                minDepth: 5.0,   // cents
                confidenceThreshold: 0.7
            },
            legato: {
                maxGap: 50,      // ms
                smoothnessThreshold: 0.8
            },
            staccato: {
                minSeparation: 100, // ms
                maxConnection: 0.3
            },
            portamento: {
                minSemitoneChange: 0.5,
                minDuration: 50,     // ms
                smoothnessThreshold: 0.7
            },
            breath: {
                noiseThreshold: 0.3,
                amplitudeThreshold: 0.1,
                durationThreshold: 50 // ms
            }
        };
        
        // Previous analysis for context
        this.previousAnalysis = null;
        this.articulationHistory = [];
        
        console.log('Articulation Classifier initialized');
    }
    
    /**
     * Classify vocal articulation and technique
     */
    classify(audioBuffer, pitchAnalysis, dynamicsAnalysis, spectralAnalysis, analysisHistory) {
        try {
            // Update context
            this.updateContext(analysisHistory);
            
            // Classify attack type
            const attackType = this.classifyAttackType(dynamicsAnalysis.attack, spectralAnalysis);
            
            // Detect legato/staccato articulation
            const connectionAnalysis = this.analyzeConnection(pitchAnalysis, dynamicsAnalysis, analysisHistory);
            
            // Analyze breath patterns
            const breathAnalysis = this.analyzeBreathPatterns(audioBuffer, dynamicsAnalysis, spectralAnalysis);
            
            // Detect vocal register
            const vocalRegister = this.detectVocalRegister(pitchAnalysis, spectralAnalysis);
            
            // Identify vocal techniques
            const techniques = this.identifyVocalTechniques(pitchAnalysis, spectralAnalysis, dynamicsAnalysis);
            
            // Calculate overall articulation confidence
            const confidence = this.calculateArticulationConfidence(
                attackType, connectionAnalysis, breathAnalysis, vocalRegister, techniques
            );
            
            const result = {
                attackType: attackType.type,
                attackConfidence: attackType.confidence,
                legato: connectionAnalysis.legato,
                staccato: connectionAnalysis.staccato,
                breathAnalysis: breathAnalysis,
                vocalRegister: vocalRegister.register,
                registerConfidence: vocalRegister.confidence,
                technique: techniques,
                overallConfidence: confidence
            };
            
            // Store for next analysis
            this.previousAnalysis = result;
            this.articulationHistory.push({
                timestamp: Date.now(),
                articulation: result
            });
            
            return result;
            
        } catch (error) {
            console.error('Articulation classification failed:', error);
            return {
                attackType: 'soft',
                attackConfidence: 0.5,
                legato: { present: false },
                staccato: { present: false },
                breathAnalysis: { inhaleBefore: { present: false }, exhaleAfter: { present: false } },
                vocalRegister: 'mixed',
                registerConfidence: 0.5,
                technique: [],
                overallConfidence: 0.5
            };
        }
    }
    
    /**
     * Classify attack type based on dynamics and spectral characteristics
     */
    classifyAttackType(attackAnalysis, spectralAnalysis) {
        const attackTime = attackAnalysis.time;
        const overshoot = attackAnalysis.overshoot;
        const spectralCentroid = spectralAnalysis.spectralCentroid;
        const noiseRatio = spectralAnalysis.noiseRatio;
        
        let attackType = 'soft';
        let confidence = 0.7;
        
        // Hard attack: Fast attack time, high overshoot, bright spectral content
        if (attackTime < 20 && overshoot > 0.2 && spectralCentroid > 1500) {
            attackType = 'hard';
            confidence = 0.9;
        }
        // Percussive: Very fast attack, high overshoot, high noise content
        else if (attackTime < 10 && overshoot > 0.3 && noiseRatio > 0.2) {
            attackType = 'percussive';
            confidence = 0.85;
        }
        // Breathy: Moderate attack time, high noise ratio, lower spectral centroid
        else if (attackTime > 30 && noiseRatio > 0.3 && spectralCentroid < 1000) {
            attackType = 'breathy';
            confidence = 0.8;
        }
        // Glottal: Very fast attack, low overshoot, specific spectral signature
        else if (attackTime < 15 && overshoot < 0.1 && this.detectGlottalSignature(spectralAnalysis)) {
            attackType = 'glottal';
            confidence = 0.75;
        }
        // Aspirated: Slow attack, high initial noise, gradual buildup
        else if (attackTime > 50 && noiseRatio > 0.4) {
            attackType = 'aspirated';
            confidence = 0.8;
        }
        
        return {
            type: attackType,
            confidence: confidence,
            characteristics: {
                attackTime: attackTime,
                overshoot: overshoot,
                spectralBrightness: spectralCentroid,
                noiseContent: noiseRatio
            }
        };
    }
    
    /**
     * Analyze connection between notes for legato/staccato detection
     */
    analyzeConnection(pitchAnalysis, dynamicsAnalysis, analysisHistory) {
        // Need previous note for connection analysis
        if (!analysisHistory || analysisHistory.length < 2) {
            return {
                legato: { present: false },
                staccato: { present: false }
            };
        }
        
        const previousNote = analysisHistory[analysisHistory.length - 2];
        
        if (!previousNote || !previousNote.pitch || !previousNote.dynamics) {
            return {
                legato: { present: false },
                staccato: { present: false }
            };
        }
        
        // Analyze pitch connection
        const pitchConnection = this.analyzePitchConnection(
            previousNote.pitch,
            pitchAnalysis
        );
        
        // Analyze dynamic connection
        const dynamicConnection = this.analyzeDynamicConnection(
            previousNote.dynamics,
            dynamicsAnalysis
        );
        
        // Determine articulation type
        const isLegato = pitchConnection.smooth && dynamicConnection.continuous;
        const isStaccato = !dynamicConnection.continuous && dynamicConnection.separation > this.thresholds.staccato.minSeparation;
        
        return {
            legato: {
                present: isLegato,
                smoothness: isLegato ? Math.min(pitchConnection.smoothness, dynamicConnection.continuity) : 0,
                gap: pitchConnection.gap
            },
            staccato: {
                present: isStaccato && !isLegato,
                separation: dynamicConnection.separation || null
            }
        };
    }
    
    /**
     * Analyze breath patterns in the audio
     */
    analyzeBreathPatterns(audioBuffer, dynamicsAnalysis, spectralAnalysis) {
        // Analyze pre-note region for inhalation
        const preNoteRegion = audioBuffer.slice(0, Math.min(2048, audioBuffer.length / 4));
        const inhalationAnalysis = this.detectInhalation(preNoteRegion);
        
        // Analyze post-note region for exhalation
        const postNoteRegion = audioBuffer.slice(Math.max(0, audioBuffer.length * 3/4));
        const exhalationAnalysis = this.detectExhalation(postNoteRegion);
        
        // Analyze breath support during sustain
        const breathSupport = this.analyzeBreathSupport(
            dynamicsAnalysis.sustain,
            spectralAnalysis
        );
        
        return {
            inhaleBefore: inhalationAnalysis,
            exhaleAfter: exhalationAnalysis,
            breathSupport: breathSupport
        };
    }
    
    /**
     * Detect vocal register (chest, mixed, head, falsetto, whistle)
     */
    detectVocalRegister(pitchAnalysis, spectralAnalysis) {
        const fundamental = pitchAnalysis.fundamental;
        const harmonicProfile = spectralAnalysis.harmonicProfile;
        const formants = spectralAnalysis.formants;
        
        if (!fundamental || !harmonicProfile || harmonicProfile.length === 0) {
            return { register: 'mixed', confidence: 0.5 };
        }
        
        // Frequency-based initial classification
        let register = 'mixed';
        let confidence = 0.6;
        
        if (fundamental < 200) {
            // Low frequencies - likely chest voice
            register = 'chest';
            confidence = 0.8;
            
            // Check for strong fundamental and lower harmonics
            if (harmonicProfile[0] && harmonicProfile[0].amplitude > 0.8) {
                confidence = 0.9;
            }
        } else if (fundamental > 800) {
            // High frequencies - head voice or above
            register = 'head';
            confidence = 0.7;
            
            // Check for whistle register characteristics
            if (fundamental > 1400 && this.detectWhistleCharacteristics(spectralAnalysis)) {
                register = 'whistle';
                confidence = 0.85;
            }
            // Check for falsetto characteristics
            else if (this.detectFalsettoCharacteristics(harmonicProfile, formants)) {
                register = 'falsetto';
                confidence = 0.8;
            }
        } else {
            // Mid frequencies - could be mixed or transitional
            const mixedCharacteristics = this.analyzeMixedVoiceCharacteristics(
                harmonicProfile, formants, fundamental
            );
            
            confidence = mixedCharacteristics.confidence;
        }
        
        return {
            register: register,
            confidence: confidence,
            characteristics: {
                fundamental: fundamental,
                harmonicStrength: harmonicProfile[0]?.amplitude || 0,
                spectralBalance: this.calculateSpectralBalance(harmonicProfile)
            }
        };
    }
    
    /**
     * Identify vocal techniques present in the audio
     */
    identifyVocalTechniques(pitchAnalysis, spectralAnalysis, dynamicsAnalysis) {
        const techniques = [];
        
        // Vibrato detection
        if (pitchAnalysis.vibrato && pitchAnalysis.vibrato.present) {
            const vibrato = pitchAnalysis.vibrato;
            if (vibrato.rate >= this.thresholds.vibrato.minRate && 
                vibrato.rate <= this.thresholds.vibrato.maxRate &&
                vibrato.depth >= this.thresholds.vibrato.minDepth) {
                techniques.push({
                    name: 'vibrato',
                    confidence: 0.9,
                    parameters: {
                        rate: vibrato.rate,
                        depth: vibrato.depth,
                        regularity: 1 - vibrato.irregularity
                    }
                });
            }
        }
        
        // Straight tone (absence of vibrato)
        else if (pitchAnalysis.trajectory && pitchAnalysis.trajectory.length > 10) {
            const pitchStability = this.calculatePitchStability(pitchAnalysis.trajectory);
            if (pitchStability > 0.9) {
                techniques.push({
                    name: 'straight_tone',
                    confidence: 0.8,
                    parameters: {
                        stability: pitchStability
                    }
                });
            }
        }
        
        // Portamento detection
        if (pitchAnalysis.portamento && pitchAnalysis.portamento.present) {
            const portamento = pitchAnalysis.portamento;
            techniques.push({
                name: 'portamento',
                confidence: 0.85,
                parameters: {
                    startFreq: portamento.startFreq,
                    endFreq: portamento.endFreq,
                    duration: portamento.duration,
                    smoothness: portamento.smoothness
                }
            });
        }
        
        // Vocal fry detection
        if (this.detectVocalFry(spectralAnalysis, dynamicsAnalysis)) {
            techniques.push({
                name: 'vocal_fry',
                confidence: 0.75,
                parameters: {
                    intensity: this.calculateVocalFryIntensity(spectralAnalysis)
                }
            });
        }
        
        // Head resonance detection
        if (this.detectHeadResonance(spectralAnalysis)) {
            techniques.push({
                name: 'head_resonance',
                confidence: 0.7,
                parameters: {
                    formantShift: this.calculateFormantShift(spectralAnalysis.formants)
                }
            });
        }
        
        return techniques;
    }
    
    /**
     * Calculate overall articulation confidence
     */
    calculateArticulationConfidence(attackType, connectionAnalysis, breathAnalysis, vocalRegister, techniques) {
        const weights = {
            attack: 0.25,
            connection: 0.2,
            breath: 0.15,
            register: 0.2,
            techniques: 0.2
        };
        
        const attackConf = attackType.confidence;
        const connectionConf = Math.max(
            connectionAnalysis.legato.present ? 0.8 : 0.5,
            connectionAnalysis.staccato.present ? 0.8 : 0.5
        );
        const breathConf = (breathAnalysis.breathSupport + 1) / 2; // Convert -1,1 to 0,1
        const registerConf = vocalRegister.confidence;
        const techniqueConf = techniques.length > 0 ? 
            techniques.reduce((sum, t) => sum + t.confidence, 0) / techniques.length : 0.6;
        
        return (
            attackConf * weights.attack +
            connectionConf * weights.connection +
            breathConf * weights.breath +
            registerConf * weights.register +
            techniqueConf * weights.techniques
        );
    }
    
    /**
     * Utility methods for classification
     */
    
    updateContext(analysisHistory) {
        // Keep recent history for context-aware classification
        this.articulationHistory = this.articulationHistory.filter(
            item => Date.now() - item.timestamp < 10000 // Keep 10 seconds
        );
    }
    
    detectGlottalSignature(spectralAnalysis) {
        // Glottal stops have characteristic spectral signatures
        const harmonicProfile = spectralAnalysis.harmonicProfile;
        if (!harmonicProfile || harmonicProfile.length < 3) return false;
        
        // Look for strong odd harmonics, weaker even harmonics
        const oddStrength = (harmonicProfile[0]?.amplitude || 0) + (harmonicProfile[2]?.amplitude || 0);
        const evenStrength = harmonicProfile[1]?.amplitude || 0;
        
        return oddStrength > evenStrength * 1.5;
    }
    
    analyzePitchConnection(prevPitch, currentPitch) {
        if (!prevPitch.trajectory || !currentPitch.trajectory) {
            return { smooth: false, gap: 0, smoothness: 0 };
        }
        
        // Check frequency continuity
        const prevEndFreq = prevPitch.trajectory[prevPitch.trajectory.length - 1]?.frequency;
        const currentStartFreq = currentPitch.trajectory[0]?.frequency;
        
        if (!prevEndFreq || !currentStartFreq) {
            return { smooth: false, gap: 0, smoothness: 0 };
        }
        
        const frequencyGap = Math.abs(currentStartFreq - prevEndFreq);
        const semitoneGap = 12 * Math.log2(Math.max(currentStartFreq, prevEndFreq) / Math.min(currentStartFreq, prevEndFreq));
        
        const isSmooth = semitoneGap < 0.5; // Less than half semitone
        const smoothness = Math.max(0, 1 - semitoneGap / 2);
        
        return {
            smooth: isSmooth,
            gap: frequencyGap,
            smoothness: smoothness
        };
    }
    
    analyzeDynamicConnection(prevDynamics, currentDynamics) {
        const prevReleaseLevel = prevDynamics.release?.tailLevel || 0;
        const currentAttackLevel = currentDynamics.attack?.peakVelocity || 64;
        
        const levelDifference = Math.abs(currentAttackLevel - prevReleaseLevel);
        const isContinuous = levelDifference < 20; // MIDI velocity units
        
        return {
            continuous: isContinuous,
            continuity: Math.max(0, 1 - levelDifference / 127),
            separation: isContinuous ? 0 : levelDifference * 2 // Rough ms estimate
        };
    }
    
    detectInhalation(audioRegion) {
        // Look for characteristic inhalation noise pattern
        const avgAmplitude = audioRegion.reduce((sum, val) => sum + Math.abs(val), 0) / audioRegion.length;
        const noiseLevel = this.calculateNoiseLevel(audioRegion);
        
        const hasInhalation = avgAmplitude > 0.05 && noiseLevel > 0.3;
        
        return {
            present: hasInhalation,
            duration: hasInhalation ? audioRegion.length / 44100 * 1000 : 0, // ms
            intensity: avgAmplitude
        };
    }
    
    detectExhalation(audioRegion) {
        // Similar to inhalation but often longer and softer
        const avgAmplitude = audioRegion.reduce((sum, val) => sum + Math.abs(val), 0) / audioRegion.length;
        const noiseLevel = this.calculateNoiseLevel(audioRegion);
        
        const hasExhalation = avgAmplitude > 0.03 && noiseLevel > 0.2;
        
        return {
            present: hasExhalation,
            duration: hasExhalation ? audioRegion.length / 44100 * 1000 : 0, // ms
            intensity: avgAmplitude
        };
    }
    
    analyzeBreathSupport(sustainAnalysis, spectralAnalysis) {
        // Breath support affects sustain stability and spectral consistency
        const stability = sustainAnalysis.stability;
        const spectralVariation = spectralAnalysis.spectralFlux || 0;
        
        // Good breath support = stable sustain + consistent spectrum
        const breathSupport = (stability * 0.7) + ((1 - Math.min(1, spectralVariation)) * 0.3);
        
        return Math.max(-1, Math.min(1, (breathSupport - 0.5) * 2)); // Scale to -1,1
    }
    
    detectWhistleCharacteristics(spectralAnalysis) {
        // Whistle register has very pure tone, few harmonics
        const harmonicProfile = spectralAnalysis.harmonicProfile;
        if (!harmonicProfile || harmonicProfile.length < 3) return false;
        
        const fundamentalStrength = harmonicProfile[0]?.amplitude || 0;
        const harmonicStrength = harmonicProfile.slice(1, 4).reduce((sum, h) => sum + (h?.amplitude || 0), 0);
        
        return fundamentalStrength > 0.9 && harmonicStrength < 0.3;
    }
    
    detectFalsettoCharacteristics(harmonicProfile, formants) {
        // Falsetto often has weaker fundamental, specific formant patterns
        if (!harmonicProfile || harmonicProfile.length < 3) return false;
        
        const fundamentalStrength = harmonicProfile[0]?.amplitude || 0;
        const secondHarmonicStrength = harmonicProfile[1]?.amplitude || 0;
        
        // Falsetto often has relatively strong second harmonic
        return fundamentalStrength < 0.8 && secondHarmonicStrength > 0.4;
    }
    
    analyzeMixedVoiceCharacteristics(harmonicProfile, formants, fundamental) {
        // Mixed voice has balanced harmonic content
        if (!harmonicProfile || harmonicProfile.length < 4) {
            return { confidence: 0.5 };
        }
        
        const harmonicBalance = this.calculateHarmonicBalance(harmonicProfile);
        const confidence = 0.5 + (harmonicBalance * 0.4);
        
        return { confidence: Math.min(0.9, confidence) };
    }
    
    calculateSpectralBalance(harmonicProfile) {
        if (!harmonicProfile || harmonicProfile.length < 2) return 0;
        
        const lowHarmonics = harmonicProfile.slice(0, 3).reduce((sum, h) => sum + (h?.amplitude || 0), 0);
        const highHarmonics = harmonicProfile.slice(3).reduce((sum, h) => sum + (h?.amplitude || 0), 0);
        const total = lowHarmonics + highHarmonics;
        
        return total > 0 ? lowHarmonics / total : 0.5;
    }
    
    calculatePitchStability(trajectory) {
        if (!trajectory || trajectory.length < 5) return 0;
        
        const frequencies = trajectory.map(p => p.frequency).filter(f => f > 0);
        if (frequencies.length < 5) return 0;
        
        const mean = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
        const variance = frequencies.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / frequencies.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Convert to stability measure (0-1)
        const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 1;
        return Math.max(0, 1 - coefficientOfVariation * 100);
    }
    
    detectVocalFry(spectralAnalysis, dynamicsAnalysis) {
        // Vocal fry has characteristic low-frequency irregularities
        const lowFreqEnergy = spectralAnalysis.harmonicProfile?.slice(0, 2).reduce((sum, h) => sum + (h?.amplitude || 0), 0) || 0;
        const irregularity = dynamicsAnalysis.sustain?.microVariations?.length || 0;
        
        return lowFreqEnergy > 0.6 && irregularity > 3;
    }
    
    calculateVocalFryIntensity(spectralAnalysis) {
        // Intensity based on low-frequency dominance
        const fundamentalStrength = spectralAnalysis.harmonicProfile?.[0]?.amplitude || 0;
        return Math.min(1, fundamentalStrength * 1.2);
    }
    
    detectHeadResonance(spectralAnalysis) {
        // Head resonance affects upper formants
        const formants = spectralAnalysis.formants;
        if (!formants || formants.length < 3) return false;
        
        // Look for elevated F2 and F3
        const f2 = formants.find(f => f.name === 'F2')?.frequency || 0;
        const f3 = formants.find(f => f.name === 'F3')?.frequency || 0;
        
        return f2 > 1800 && f3 > 2800;
    }
    
    calculateFormantShift(formants) {
        // Calculate overall formant frequency shift from typical values
        const typicalFormants = { F1: 500, F2: 1500, F3: 2500, F4: 3500 };
        let totalShift = 0;
        let count = 0;
        
        formants.forEach(formant => {
            if (typicalFormants[formant.name]) {
                const shift = Math.abs(formant.frequency - typicalFormants[formant.name]) / typicalFormants[formant.name];
                totalShift += shift;
                count++;
            }
        });
        
        return count > 0 ? totalShift / count : 0;
    }
    
    calculateHarmonicBalance(harmonicProfile) {
        if (!harmonicProfile || harmonicProfile.length < 3) return 0.5;
        
        // Balance between fundamental and harmonics
        const fundamental = harmonicProfile[0]?.amplitude || 0;
        const harmonics = harmonicProfile.slice(1).reduce((sum, h) => sum + (h?.amplitude || 0), 0);
        const total = fundamental + harmonics;
        
        if (total === 0) return 0.5;
        
        // Optimal balance is around 60% fundamental, 40% harmonics
        const ratio = fundamental / total;
        const optimalRatio = 0.6;
        const deviation = Math.abs(ratio - optimalRatio);
        
        return Math.max(0, 1 - deviation * 2);
    }
    
    calculateNoiseLevel(audioRegion) {
        // Simple noise estimation using high-frequency content
        let highFreqEnergy = 0;
        let totalEnergy = 0;
        
        for (let i = 1; i < audioRegion.length - 1; i++) {
            const highFreqComponent = Math.abs(audioRegion[i] - (audioRegion[i-1] + audioRegion[i+1]) / 2);
            highFreqEnergy += highFreqComponent;
            totalEnergy += Math.abs(audioRegion[i]);
        }
        
        return totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArticulationClassifier;
}