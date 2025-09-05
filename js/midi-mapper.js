/**
 * MIDI Mapper - Generate detailed MIDI with comprehensive CC data
 * Part of the Forensic Audio Analysis Engine
 */

class MidiMapper {
    constructor(config = {}) {
        this.config = config;
        
        // MIDI CC assignments for different expression types
        this.ccMapping = {
            // Standard MIDI CCs
            modulation: 1,           // Vibrato depth
            breathController: 2,     // Breath control
            expression: 11,          // Dynamic expression
            sustainPedal: 64,        // Legato connection
            brightness: 74,          // Spectral centroid
            
            // High-resolution CCs (14-bit)
            vibratoRate: 76,         // Vibrato rate
            vibratoDepth: 77,        // Vibrato depth (high-res)
            attackTime: 78,          // Attack envelope time
            releaseTime: 79,         // Release envelope time
            
            // Custom CCs for advanced expression
            harmonicContent: 80,     // Harmonic ratio
            spectralFlux: 81,        // Timbral change rate
            formantShift: 82,        // Vocal tract modification
            breathNoise: 83,         // Breath noise level
            portamentoTime: 84,      // Portamento duration
            microTiming: 85,         // Micro-timing variations
            
            // Advanced vocal techniques
            vocalRegister: 86,       // Vocal register (chest/mixed/head)
            articulationType: 87,    // Attack type encoding
            phrasingArc: 88,         // Phrase arc position
            resonanceShift: 89       // Head/chest resonance
        };
        
        // MPE (MIDI Polyphonic Expression) settings
        this.mpeEnabled = config.enableMPE || false;
        this.mpeChannels = config.mpeChannels || 15;
        
        console.log('MIDI Mapper initialized with', this.mpeEnabled ? 'MPE enabled' : 'standard MIDI');
    }
    
    /**
     * Generate comprehensive MIDI data from analysis results
     */
    generateMidiData(pitchAnalysis, dynamicsAnalysis, spectralAnalysis, articulationAnalysis) {
        try {
            // Basic MIDI note data
            const basicMidi = this.generateBasicMidiNote(pitchAnalysis, dynamicsAnalysis);
            
            // Continuous pitch bend data
            const pitchBend = this.generatePitchBendData(pitchAnalysis);
            
            // Control Change data for expression
            const controlChanges = this.generateControlChanges(
                pitchAnalysis, dynamicsAnalysis, spectralAnalysis, articulationAnalysis
            );
            
            // MPE data if enabled
            const mpeData = this.mpeEnabled ? this.generateMPEData(
                pitchAnalysis, dynamicsAnalysis, spectralAnalysis, articulationAnalysis
            ) : null;
            
            // Advanced timing data
            const timingData = this.generateTimingData(pitchAnalysis, dynamicsAnalysis);
            
            return {
                // Basic MIDI
                note: basicMidi.note,
                velocity: basicMidi.velocity,
                duration: basicMidi.duration,
                channel: basicMidi.channel,
                
                // Continuous data
                pitchBend: pitchBend,
                controlChanges: controlChanges,
                
                // MPE data
                mpe: mpeData,
                
                // Timing and micro-expression
                timing: timingData,
                
                // Metadata for advanced applications
                metadata: {
                    analysisConfidence: this.calculateMidiConfidence(pitchAnalysis, dynamicsAnalysis, spectralAnalysis),
                    expressionComplexity: this.calculateExpressionComplexity(controlChanges),
                    articulationTags: this.generateArticulationTags(articulationAnalysis)
                }
            };
            
        } catch (error) {
            console.error('MIDI generation failed:', error);
            return this.generateFallbackMidiData();
        }
    }
    
    /**
     * Generate basic MIDI note data
     */
    generateBasicMidiNote(pitchAnalysis, dynamicsAnalysis) {
        const frequency = pitchAnalysis.fundamental || 440;
        const midiNote = this.frequencyToMidiNote(frequency);
        const velocity = dynamicsAnalysis.attack?.peakVelocity || 64;
        
        // Calculate duration from dynamics analysis phases
        const duration = this.calculateNoteDuration(dynamicsAnalysis);
        
        return {
            note: midiNote,
            velocity: Math.max(1, Math.min(127, Math.round(velocity))),
            duration: duration,
            channel: 1 // Default channel, would be dynamic in MPE
        };
    }
    
    /**
     * Generate high-resolution pitch bend data
     */
    generatePitchBendData(pitchAnalysis) {
        if (!pitchAnalysis.trajectory || pitchAnalysis.trajectory.length < 2) {
            return [];
        }
        
        const baseMidiNote = this.frequencyToMidiNote(pitchAnalysis.fundamental);
        const pitchBendData = [];
        
        pitchAnalysis.trajectory.forEach((point, index) => {
            if (point.frequency > 0) {
                const currentMidiNote = this.frequencyToMidiNote(point.frequency);
                const semitoneOffset = currentMidiNote - baseMidiNote;
                
                // Convert to 14-bit pitch bend (±2 semitones range)
                const pitchBendValue = this.semitonesToPitchBend(semitoneOffset);
                
                pitchBendData.push({
                    time: point.time || (index * 10), // ms
                    value: pitchBendValue,
                    confidence: point.confidence || 1.0
                });
            }
        });
        
        return pitchBendData;
    }
    
    /**
     * Generate comprehensive Control Change data
     */
    generateControlChanges(pitchAnalysis, dynamicsAnalysis, spectralAnalysis, articulationAnalysis) {
        const controlChanges = {};
        
        // Vibrato control (CC1 - Modulation)
        if (pitchAnalysis.vibrato && pitchAnalysis.vibrato.present) {
            controlChanges[this.ccMapping.modulation] = this.generateVibratoCC(pitchAnalysis.vibrato);
            controlChanges[this.ccMapping.vibratoRate] = this.generateVibratoRateCC(pitchAnalysis.vibrato);
            controlChanges[this.ccMapping.vibratoDepth] = this.generateVibratoDepthCC(pitchAnalysis.vibrato);
        } else {
            // No vibrato - set modulation to zero
            controlChanges[this.ccMapping.modulation] = [{ time: 0, value: 0 }];
        }
        
        // Breath control (CC2)
        controlChanges[this.ccMapping.breathController] = this.generateBreathCC(
            articulationAnalysis.breathAnalysis
        );
        
        // Expression/dynamics (CC11)
        controlChanges[this.ccMapping.expression] = this.generateExpressionCC(
            dynamicsAnalysis
        );
        
        // Brightness/timbre (CC74)
        controlChanges[this.ccMapping.brightness] = this.generateBrightnessCC(
            spectralAnalysis
        );
        
        // Sustain/legato (CC64)
        controlChanges[this.ccMapping.sustainPedal] = this.generateSustainCC(
            articulationAnalysis.legato
        );
        
        // Attack envelope (CC78)
        controlChanges[this.ccMapping.attackTime] = this.generateAttackCC(
            dynamicsAnalysis.attack
        );
        
        // Release envelope (CC79)
        controlChanges[this.ccMapping.releaseTime] = this.generateReleaseCC(
            dynamicsAnalysis.release
        );
        
        // Advanced expression CCs
        controlChanges[this.ccMapping.harmonicContent] = this.generateHarmonicCC(
            spectralAnalysis
        );
        
        controlChanges[this.ccMapping.spectralFlux] = this.generateSpectralFluxCC(
            spectralAnalysis
        );
        
        controlChanges[this.ccMapping.formantShift] = this.generateFormantCC(
            spectralAnalysis.formants
        );
        
        // Portamento (CC84)
        if (pitchAnalysis.portamento && pitchAnalysis.portamento.present) {
            controlChanges[this.ccMapping.portamentoTime] = this.generatePortamentoCC(
                pitchAnalysis.portamento
            );
        }
        
        // Vocal-specific CCs
        controlChanges[this.ccMapping.vocalRegister] = this.generateVocalRegisterCC(
            articulationAnalysis.vocalRegister
        );
        
        controlChanges[this.ccMapping.articulationType] = this.generateArticulationTypeCC(
            articulationAnalysis.attackType
        );
        
        return controlChanges;
    }
    
    /**
     * Generate MPE (MIDI Polyphonic Expression) data
     */
    generateMPEData(pitchAnalysis, dynamicsAnalysis, spectralAnalysis, articulationAnalysis) {
        return {
            // Per-note pitch bend (high resolution)
            pitchBend: this.generateHighResPitchBend(pitchAnalysis),
            
            // Channel pressure (dynamics)
            pressure: this.generateChannelPressure(dynamicsAnalysis),
            
            // Timbre control (CC74)
            timbre: this.generateTimbreControl(spectralAnalysis),
            
            // Third dimension (CC1 or custom)
            thirdDimension: this.generateThirdDimensionControl(articulationAnalysis)
        };
    }
    
    /**
     * Generate micro-timing data
     */
    generateTimingData(pitchAnalysis, dynamicsAnalysis) {
        return {
            // Attack timing variations
            attackOffset: this.calculateAttackOffset(dynamicsAnalysis.attack),
            
            // Note duration variations
            durationVariation: this.calculateDurationVariation(dynamicsAnalysis),
            
            // Rhythmic micro-timing
            microTiming: this.calculateMicroTiming(pitchAnalysis.trajectory),
            
            // Groove and feel
            humanization: this.calculateHumanization(dynamicsAnalysis)
        };
    }
    
    /**
     * CC Generation Methods
     */
    
    generateVibratoCC(vibrato) {
        // Map vibrato depth to CC1 (0-127)
        const depth = Math.min(50, vibrato.depth || 0); // Cap at 50 cents
        const ccValue = Math.round((depth / 50) * 127);
        
        // Generate vibrato curve based on rate and phase
        const vibratoData = [];
        const duration = 1000; // 1 second of data
        const sampleRate = 100; // 10ms resolution
        
        for (let t = 0; t < duration; t += 10) {
            const phase = (t / 1000) * vibrato.rate * 2 * Math.PI + (vibrato.phase || 0);
            const modulation = Math.sin(phase) * ccValue;
            const irregularity = (vibrato.irregularity || 0) * (Math.random() - 0.5) * ccValue * 0.2;
            
            vibratoData.push({
                time: t,
                value: Math.max(0, Math.min(127, Math.round(ccValue + modulation + irregularity)))
            });
        }
        
        return vibratoData;
    }
    
    generateBreathCC(breathAnalysis) {
        const breathSupport = (breathAnalysis.breathSupport + 1) / 2; // Convert -1,1 to 0,1
        const ccValue = Math.round(breathSupport * 127);
        
        return [{ time: 0, value: ccValue }];
    }
    
    generateExpressionCC(dynamicsAnalysis) {
        const expressionData = [];
        
        // Start with attack level
        expressionData.push({
            time: 0,
            value: dynamicsAnalysis.attack?.peakVelocity || 64
        });
        
        // Sustain level
        if (dynamicsAnalysis.sustain) {
            expressionData.push({
                time: dynamicsAnalysis.attack?.time || 50,
                value: dynamicsAnalysis.sustain.level
            });
            
            // Add micro-variations
            if (dynamicsAnalysis.sustain.microVariations) {
                dynamicsAnalysis.sustain.microVariations.forEach(variation => {
                    const time = variation.position * 1000; // Convert to ms
                    const value = Math.max(0, Math.min(127, 
                        dynamicsAnalysis.sustain.level + (variation.magnitude * 30)
                    ));
                    
                    expressionData.push({ time, value: Math.round(value) });
                });
            }
        }
        
        // Release
        if (dynamicsAnalysis.release) {
            expressionData.push({
                time: 800, // Approximate end time
                value: dynamicsAnalysis.release.tailLevel || 0
            });
        }
        
        return expressionData;
    }
    
    generateBrightnessCC(spectralAnalysis) {
        // Map spectral centroid to brightness CC (0-127)
        const centroid = spectralAnalysis.spectralCentroid || 1000;
        const minCentroid = 500;  // Dark sound
        const maxCentroid = 3000; // Bright sound
        
        const normalizedCentroid = (centroid - minCentroid) / (maxCentroid - minCentroid);
        const ccValue = Math.max(0, Math.min(127, Math.round(normalizedCentroid * 127)));
        
        return [{ time: 0, value: ccValue }];
    }
    
    generateSustainCC(legatoAnalysis) {
        const isLegato = legatoAnalysis && legatoAnalysis.present;
        const ccValue = isLegato ? 127 : 0;
        
        return [{ time: 0, value: ccValue }];
    }
    
    generateAttackCC(attackAnalysis) {
        // Map attack time to CC (0-127, where 0 = instant, 127 = slow)
        const attackTime = attackAnalysis?.time || 50;
        const maxAttackTime = 300; // ms
        
        const ccValue = Math.max(0, Math.min(127, Math.round((attackTime / maxAttackTime) * 127)));
        
        return [{ time: 0, value: ccValue }];
    }
    
    generateReleaseCC(releaseAnalysis) {
        // Map release time to CC
        const releaseTime = releaseAnalysis?.time || 100;
        const maxReleaseTime = 1000; // ms
        
        const ccValue = Math.max(0, Math.min(127, Math.round((releaseTime / maxReleaseTime) * 127)));
        
        return [{ time: 800, value: ccValue }]; // Apply at note end
    }
    
    generateHarmonicCC(spectralAnalysis) {
        const harmonicRatio = spectralAnalysis.harmonicRatio || 0.5;
        const ccValue = Math.round(harmonicRatio * 127);
        
        return [{ time: 0, value: ccValue }];
    }
    
    generateSpectralFluxCC(spectralAnalysis) {
        const spectralFlux = Math.min(1, spectralAnalysis.spectralFlux || 0);
        const ccValue = Math.round(spectralFlux * 127);
        
        return [{ time: 0, value: ccValue }];
    }
    
    generateFormantCC(formants) {
        if (!formants || formants.length === 0) {
            return [{ time: 0, value: 64 }]; // Neutral
        }
        
        // Use F2 frequency as proxy for vowel modification
        const f2 = formants.find(f => f.name === 'F2');
        if (!f2) {
            return [{ time: 0, value: 64 }];
        }
        
        const normalF2 = 1500; // Neutral F2
        const deviation = (f2.frequency - normalF2) / normalF2;
        const ccValue = Math.max(0, Math.min(127, Math.round(64 + (deviation * 32))));
        
        return [{ time: 0, value: ccValue }];
    }
    
    generatePortamentoCC(portamento) {
        const duration = portamento.duration || 100;
        const maxDuration = 500; // ms
        
        const ccValue = Math.max(0, Math.min(127, Math.round((duration / maxDuration) * 127)));
        
        return [{ time: 0, value: ccValue }];
    }
    
    generateVocalRegisterCC(vocalRegister) {
        // Map vocal registers to CC values
        const registerMap = {
            chest: 20,
            mixed: 64,
            head: 100,
            falsetto: 110,
            whistle: 127
        };
        
        const ccValue = registerMap[vocalRegister] || 64;
        
        return [{ time: 0, value: ccValue }];
    }
    
    generateArticulationTypeCC(attackType) {
        // Map attack types to CC values
        const attackMap = {
            soft: 30,
            hard: 80,
            breathy: 40,
            glottal: 90,
            aspirated: 50,
            percussive: 100
        };
        
        const ccValue = attackMap[attackType] || 64;
        
        return [{ time: 0, value: ccValue }];
    }
    
    /**
     * MPE-specific generation methods
     */
    
    generateHighResPitchBend(pitchAnalysis) {
        // Higher resolution pitch bend for MPE
        return this.generatePitchBendData(pitchAnalysis); // Reuse existing method
    }
    
    generateChannelPressure(dynamicsAnalysis) {
        // Map dynamics to channel pressure
        const pressureData = [];
        
        if (dynamicsAnalysis.sustain && dynamicsAnalysis.sustain.microVariations) {
            dynamicsAnalysis.sustain.microVariations.forEach(variation => {
                const pressure = Math.max(0, Math.min(127, 
                    Math.round(variation.magnitude * 127)
                ));
                
                pressureData.push({
                    time: variation.position * 1000,
                    value: pressure
                });
            });
        }
        
        return pressureData;
    }
    
    generateTimbreControl(spectralAnalysis) {
        // Use spectral centroid for timbre in MPE
        return this.generateBrightnessCC(spectralAnalysis);
    }
    
    generateThirdDimensionControl(articulationAnalysis) {
        // Use breath support as third dimension
        return this.generateBreathCC(articulationAnalysis.breathAnalysis);
    }
    
    /**
     * Utility methods
     */
    
    frequencyToMidiNote(frequency) {
        return Math.round(69 + 12 * Math.log2(frequency / 440));
    }
    
    semitonesToPitchBend(semitones) {
        // Convert semitones to 14-bit pitch bend (±2 semitone range)
        const bendRange = 2; // semitones
        const normalizedBend = Math.max(-1, Math.min(1, semitones / bendRange));
        return Math.round((normalizedBend + 1) * 8192); // 0-16383
    }
    
    calculateNoteDuration(dynamicsAnalysis) {
        // Estimate duration from attack + sustain + release
        const attackTime = dynamicsAnalysis.attack?.time || 50;
        const releaseTime = dynamicsAnalysis.release?.time || 100;
        const sustainTime = 500; // Default sustain time
        
        return attackTime + sustainTime + releaseTime;
    }
    
    calculateMidiConfidence(pitchAnalysis, dynamicsAnalysis, spectralAnalysis) {
        return (
            (pitchAnalysis.confidence || 0.5) * 0.4 +
            (spectralAnalysis.confidence || 0.5) * 0.3 +
            0.3 // Dynamics confidence (not yet implemented)
        );
    }
    
    calculateExpressionComplexity(controlChanges) {
        // Measure how much expression data we have
        let totalPoints = 0;
        Object.values(controlChanges).forEach(ccData => {
            totalPoints += ccData.length;
        });
        
        // Normalize to 0-1 scale
        return Math.min(1, totalPoints / 100);
    }
    
    generateArticulationTags(articulationAnalysis) {
        const tags = [];
        
        if (articulationAnalysis.legato && articulationAnalysis.legato.present) {
            tags.push('legato');
        }
        if (articulationAnalysis.staccato && articulationAnalysis.staccato.present) {
            tags.push('staccato');
        }
        
        articulationAnalysis.technique?.forEach(tech => {
            tags.push(tech.name);
        });
        
        return tags;
    }
    
    generateFallbackMidiData() {
        return {
            note: 60,
            velocity: 64,
            duration: 500,
            channel: 1,
            pitchBend: [],
            controlChanges: {},
            mpe: null,
            timing: {},
            metadata: {
                analysisConfidence: 0.1,
                expressionComplexity: 0,
                articulationTags: []
            }
        };
    }
    
    calculateAttackOffset(attackAnalysis) {
        // Calculate timing offset for attack (for humanization)
        const attackTime = attackAnalysis?.time || 50;
        return attackTime > 30 ? Math.random() * 10 - 5 : 0; // ±5ms variation
    }
    
    calculateDurationVariation(dynamicsAnalysis) {
        // Calculate note duration variation for expression
        const sustainStability = dynamicsAnalysis.sustain?.stability || 0.8;
        return (1 - sustainStability) * 50; // Up to 50ms variation
    }
    
    calculateMicroTiming(trajectory) {
        if (!trajectory || trajectory.length < 5) return 0;
        
        // Calculate timing irregularity from pitch trajectory
        const timeDeltas = [];
        for (let i = 1; i < trajectory.length; i++) {
            const delta = trajectory[i].time - trajectory[i-1].time;
            timeDeltas.push(delta);
        }
        
        const avgDelta = timeDeltas.reduce((sum, d) => sum + d, 0) / timeDeltas.length;
        const variance = timeDeltas.reduce((sum, d) => sum + Math.pow(d - avgDelta, 2), 0) / timeDeltas.length;
        
        return Math.sqrt(variance) / avgDelta; // Coefficient of variation
    }
    
    calculateHumanization(dynamicsAnalysis) {
        // Calculate overall humanization factor
        const microVars = dynamicsAnalysis.sustain?.microVariations?.length || 0;
        const stability = dynamicsAnalysis.sustain?.stability || 0.8;
        
        return Math.min(1, (microVars / 10) + (1 - stability));
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiMapper;
}