/**
 * Syllable-to-Note Alignment System
 * Handles the complex task of aligning detected syllables with sung pitches
 * Accounts for vocal techniques: vibrato, portamento, melismas, sustained vowels
 */

class SyllableNoteAligner {
    constructor(forensicAnalyzer) {
        this.forensicAnalyzer = forensicAnalyzer;
        
        // Vocal-specific alignment parameters
        this.alignmentConfig = {
            // Melisma handling - multiple notes per syllable
            melismaDetection: {
                minNotesPerSyllable: 2,
                maxNotesPerSyllable: 20,
                pitchChangeThreshold: 50, // cents
                minNoteDistance: 0.1, // seconds
            },
            
            // Sustained vowel handling
            vowelSustain: {
                minDuration: 0.8, // seconds
                vowelPatterns: /[aeiouAEIOU]$/,
                vibratoTolerance: 30, // cents
                breathCompensation: 0.1 // seconds
            },
            
            // Portamento and pitch slides
            portamento: {
                maxSlideTime: 0.5, // seconds
                pitchSlideTolerance: 100, // cents
                syllableBoundaryGrace: 0.05 // seconds
            },
            
            // Vocal register transitions
            registerTransitions: {
                chestToMixed: { freqRange: [200, 400], transitionTime: 0.2 },
                mixedToHead: { freqRange: [400, 800], transitionTime: 0.15 },
                headToFalsetto: { freqRange: [600, 1200], transitionTime: 0.1 }
            },
            
            // Rhythm and timing flexibility
            rhythmicFlexibility: {
                tempoVariance: 0.15, // ±15% tempo flexibility
                rubato: true, // Allow expressive timing
                breathPauseThreshold: 0.3, // seconds
                anacrusis: true // Handle pickup notes
            }
        };
        
        // Phoneme-to-pitch mapping preferences
        this.phonemePitchAffinities = {
            'a': { preferredRange: [300, 600], resonantFreqs: [730, 1090] },
            'e': { preferredRange: [400, 700], resonantFreqs: [530, 1840] },
            'i': { preferredRange: [500, 900], resonantFreqs: [270, 2290] },
            'o': { preferredRange: [200, 500], resonantFreqs: [570, 840] },
            'u': { preferredRange: [200, 400], resonantFreqs: [300, 870] }
        };
        
        // Current alignment state
        this.alignmentHistory = [];
        this.confidenceThresholds = {
            excellent: 0.9,
            good: 0.7,
            acceptable: 0.5,
            poor: 0.3
        };
    }
    
    async alignSyllablesToNotes(syllables, pitchEvents, forensicData) {
        console.log(`Aligning ${syllables.length} syllables to ${pitchEvents.length} pitch events`);
        
        // Pre-process vocal data for alignment
        const vocalFeatures = this.extractVocalFeatures(forensicData);
        const pitchSegments = this.segmentPitchEvents(pitchEvents, vocalFeatures);
        const syllableFeatures = this.analyzeSyllableFeatures(syllables);
        
        // Perform multi-stage alignment
        let alignment = this.performInitialAlignment(syllables, pitchSegments, vocalFeatures);
        alignment = this.refineMelismaAlignment(alignment, vocalFeatures);
        alignment = this.adjustForVocalTechniques(alignment, vocalFeatures);
        alignment = this.validateAndCorrectAlignment(alignment, syllableFeatures, vocalFeatures);
        
        return {
            alignedSyllables: alignment,
            confidence: this.calculateOverallConfidence(alignment),
            vocalFeatures,
            alignmentMetrics: this.generateAlignmentMetrics(alignment),
            warnings: this.generateAlignmentWarnings(alignment)
        };
    }
    
    extractVocalFeatures(forensicData) {
        const features = {
            vibrato: [],
            portamento: [],
            melismas: [],
            breathPauses: [],
            registerTransitions: [],
            sustainedVowels: [],
            articulations: [],
            dynamicCurves: []
        };
        
        if (!forensicData || !forensicData.analysis) {
            return features;
        }
        
        // Extract vibrato patterns
        forensicData.analysis.forEach((frame, index) => {
            if (frame.vibrato && frame.vibrato.present) {
                features.vibrato.push({
                    timestamp: frame.timestamp,
                    rate: frame.vibrato.rate,
                    depth: frame.vibrato.depth,
                    phase: frame.vibrato.phase,
                    irregularity: frame.vibrato.irregularity
                });
            }
            
            // Detect portamento (pitch slides)
            if (index > 0) {
                const prevFrame = forensicData.analysis[index - 1];
                const pitchDelta = Math.abs(frame.pitch.fundamental - prevFrame.pitch.fundamental);
                const timeDelta = frame.timestamp - prevFrame.timestamp;
                
                if (pitchDelta > this.alignmentConfig.portamento.pitchSlideTolerance && 
                    timeDelta < this.alignmentConfig.portamento.maxSlideTime) {
                    features.portamento.push({
                        startTime: prevFrame.timestamp,
                        endTime: frame.timestamp,
                        startPitch: prevFrame.pitch.fundamental,
                        endPitch: frame.pitch.fundamental,
                        pitchDelta,
                        duration: timeDelta
                    });
                }
            }
            
            // Identify sustained vowels
            if (frame.articulation && frame.articulation.vowelCharacteristics) {
                const vowel = frame.articulation.vowelCharacteristics;
                if (vowel.sustainDuration > this.alignmentConfig.vowelSustain.minDuration) {
                    features.sustainedVowels.push({
                        timestamp: frame.timestamp,
                        duration: vowel.sustainDuration,
                        vowelType: vowel.detectedVowel,
                        formants: vowel.formants,
                        stability: vowel.stability
                    });
                }
            }
            
            // Extract breath pauses
            if (frame.articulation && frame.articulation.breathAnalysis) {
                const breath = frame.articulation.breathAnalysis;
                if (breath.pauseDuration > this.alignmentConfig.rhythmicFlexibility.breathPauseThreshold) {
                    features.breathPauses.push({
                        timestamp: frame.timestamp,
                        duration: breath.pauseDuration,
                        type: breath.type // 'inhalation', 'exhalation', 'pause'
                    });
                }
            }
        });
        
        // Detect melismas (multiple notes per syllable)
        features.melismas = this.detectMelismas(forensicData.analysis);
        
        return features;
    }
    
    detectMelismas(analysisFrames) {
        const melismas = [];
        let currentMelisma = null;
        let noteCount = 0;
        let lastPitch = null;
        
        analysisFrames.forEach((frame, index) => {
            const currentPitch = frame.pitch.fundamental;
            
            if (lastPitch !== null) {
                const pitchDiff = Math.abs(currentPitch - lastPitch);
                
                // Start of new note within melisma
                if (pitchDiff > this.alignmentConfig.melismaDetection.pitchChangeThreshold) {
                    if (!currentMelisma) {
                        currentMelisma = {
                            startTime: frame.timestamp,
                            notes: [{ pitch: lastPitch, time: frame.timestamp - 0.1 }],
                            noteCount: 1
                        };
                    }
                    
                    currentMelisma.notes.push({ pitch: currentPitch, time: frame.timestamp });
                    currentMelisma.noteCount++;
                    currentMelisma.endTime = frame.timestamp;
                    
                } else if (currentMelisma && 
                          (frame.timestamp - currentMelisma.endTime) > this.alignmentConfig.melismaDetection.minNoteDistance * 2) {
                    // End of melisma
                    if (currentMelisma.noteCount >= this.alignmentConfig.melismaDetection.minNotesPerSyllable) {
                        melismas.push({
                            ...currentMelisma,
                            duration: currentMelisma.endTime - currentMelisma.startTime,
                            avgPitch: currentMelisma.notes.reduce((sum, note) => sum + note.pitch, 0) / currentMelisma.notes.length
                        });
                    }
                    currentMelisma = null;
                }
            }
            
            lastPitch = currentPitch;
        });
        
        // Handle final melisma
        if (currentMelisma && currentMelisma.noteCount >= this.alignmentConfig.melismaDetection.minNotesPerSyllable) {
            melismas.push({
                ...currentMelisma,
                duration: currentMelisma.endTime - currentMelisma.startTime,
                avgPitch: currentMelisma.notes.reduce((sum, note) => sum + note.pitch, 0) / currentMelisma.notes.length
            });
        }
        
        return melismas;
    }
    
    segmentPitchEvents(pitchEvents, vocalFeatures) {
        // Segment pitch events based on vocal techniques
        const segments = [];
        let currentSegment = null;
        
        pitchEvents.forEach((event, index) => {
            // Check if this event is part of a melisma
            const inMelisma = vocalFeatures.melismas.find(m => 
                event.timestamp >= m.startTime && event.timestamp <= m.endTime
            );
            
            // Check if this is a breath pause boundary
            const nearBreathPause = vocalFeatures.breathPauses.find(b =>
                Math.abs(event.timestamp - b.timestamp) < 0.1
            );
            
            // Check for portamento
            const inPortamento = vocalFeatures.portamento.find(p =>
                event.timestamp >= p.startTime && event.timestamp <= p.endTime
            );
            
            if (nearBreathPause && currentSegment) {
                // End current segment at breath pause
                segments.push(currentSegment);
                currentSegment = null;
            }
            
            if (!currentSegment) {
                currentSegment = {
                    startTime: event.timestamp,
                    events: [],
                    features: {
                        hasMelisma: !!inMelisma,
                        hasPortamento: !!inPortamento,
                        hasVibrato: false // Will be determined by vibrato analysis
                    }
                };
            }
            
            currentSegment.events.push({
                ...event,
                inMelisma: !!inMelisma,
                inPortamento: !!inPortamento,
                melismaRef: inMelisma,
                portamentoRef: inPortamento
            });
            
            currentSegment.endTime = event.timestamp;
            
            // Check for vibrato in this segment
            const hasVibrato = vocalFeatures.vibrato.some(v =>
                v.timestamp >= currentSegment.startTime && v.timestamp <= currentSegment.endTime
            );
            currentSegment.features.hasVibrato = currentSegment.features.hasVibrato || hasVibrato;
        });
        
        if (currentSegment) {
            segments.push(currentSegment);
        }
        
        return segments;
    }
    
    analyzeSyllableFeatures(syllables) {
        return syllables.map(syllable => {
            const vowelMatch = syllable.text.match(/[aeiouAEIOU]/g);
            const consonantMatch = syllable.text.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g);
            
            return {
                ...syllable,
                features: {
                    vowelCount: vowelMatch ? vowelMatch.length : 0,
                    consonantCount: consonantMatch ? consonantMatch.length : 0,
                    primaryVowel: vowelMatch ? vowelMatch[0].toLowerCase() : null,
                    syllableComplexity: syllable.text.length,
                    likelyMelismatic: vowelMatch && vowelMatch.length > 0 && syllable.text.length <= 3,
                    expectedDuration: this.estimateSyllableDuration(syllable.text),
                    phonemeAffinities: this.getPhonemeAffinities(syllable.text)
                }
            };
        });
    }
    
    estimateSyllableDuration(syllableText) {
        // Estimate duration based on phoneme complexity and typical singing patterns
        const baseVowelTime = 0.4;
        const baseConsonantTime = 0.15;
        
        let estimatedDuration = 0;
        const vowels = syllableText.match(/[aeiouAEIOU]/g) || [];
        const consonants = syllableText.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || [];
        
        estimatedDuration += vowels.length * baseVowelTime;
        estimatedDuration += consonants.length * baseConsonantTime;
        
        // Adjustment for diphthongs and complex vowels
        if (vowels.length > 1) {
            estimatedDuration += 0.2; // Additional time for vowel transitions
        }
        
        return Math.max(0.2, estimatedDuration);
    }
    
    getPhonemeAffinities(syllableText) {
        const primaryVowel = syllableText.match(/[aeiou]/i);
        if (primaryVowel) {
            return this.phonemePitchAffinities[primaryVowel[0].toLowerCase()] || {};
        }
        return {};
    }
    
    performInitialAlignment(syllables, pitchSegments, vocalFeatures) {
        const alignment = [];
        let syllableIndex = 0;
        
        pitchSegments.forEach((segment, segmentIndex) => {
            if (syllableIndex >= syllables.length) return;
            
            const currentSyllable = syllables[syllableIndex];
            
            if (segment.features.hasMelisma) {
                // Handle melismatic passages - one syllable to multiple notes
                const melisma = vocalFeatures.melismas.find(m =>
                    m.startTime <= segment.startTime && m.endTime >= segment.endTime
                );
                
                if (melisma) {
                    alignment.push({
                        syllable: currentSyllable,
                        noteEvents: segment.events,
                        alignmentType: 'melisma',
                        confidence: 0.8,
                        melismaRef: melisma,
                        timing: {
                            startTime: segment.startTime,
                            endTime: segment.endTime,
                            duration: segment.endTime - segment.startTime
                        }
                    });
                    syllableIndex++;
                }
            } else {
                // Standard alignment - try to match syllable to note(s)
                const notesToAlign = segment.events.filter(e => !e.inPortamento);
                
                if (notesToAlign.length === 1) {
                    // Simple 1:1 syllable to note alignment
                    alignment.push({
                        syllable: currentSyllable,
                        noteEvents: notesToAlign,
                        alignmentType: 'simple',
                        confidence: 0.9,
                        timing: {
                            startTime: notesToAlign[0].timestamp,
                            endTime: notesToAlign[0].timestamp + (currentSyllable.features?.expectedDuration || 0.5),
                            duration: currentSyllable.features?.expectedDuration || 0.5
                        }
                    });
                    syllableIndex++;
                } else if (notesToAlign.length > 1) {
                    // Multiple notes - check if we should split across syllables
                    const totalDuration = segment.endTime - segment.startTime;
                    const avgNoteTime = totalDuration / notesToAlign.length;
                    
                    if (avgNoteTime > 0.3 && syllableIndex + 1 < syllables.length) {
                        // Split across multiple syllables
                        const notesPerSyllable = Math.ceil(notesToAlign.length / 2);
                        
                        alignment.push({
                            syllable: currentSyllable,
                            noteEvents: notesToAlign.slice(0, notesPerSyllable),
                            alignmentType: 'split',
                            confidence: 0.6,
                            timing: {
                                startTime: segment.startTime,
                                endTime: segment.startTime + (totalDuration * 0.5),
                                duration: totalDuration * 0.5
                            }
                        });
                        syllableIndex++;
                        
                        if (syllableIndex < syllables.length) {
                            alignment.push({
                                syllable: syllables[syllableIndex],
                                noteEvents: notesToAlign.slice(notesPerSyllable),
                                alignmentType: 'split',
                                confidence: 0.6,
                                timing: {
                                    startTime: segment.startTime + (totalDuration * 0.5),
                                    endTime: segment.endTime,
                                    duration: totalDuration * 0.5
                                }
                            });
                            syllableIndex++;
                        }
                    } else {
                        // Assign all notes to current syllable
                        alignment.push({
                            syllable: currentSyllable,
                            noteEvents: notesToAlign,
                            alignmentType: 'multi_note',
                            confidence: 0.7,
                            timing: {
                                startTime: segment.startTime,
                                endTime: segment.endTime,
                                duration: totalDuration
                            }
                        });
                        syllableIndex++;
                    }
                }
            }
        });
        
        return alignment;
    }
    
    refineMelismaAlignment(alignment, vocalFeatures) {
        // Refine melismatic alignments with better note-to-syllable mapping
        return alignment.map(align => {
            if (align.alignmentType === 'melisma' && align.melismaRef) {
                const melisma = align.melismaRef;
                const syllable = align.syllable;
                
                // Distribute notes across syllable based on vowel content
                if (syllable.features.primaryVowel) {
                    const vowelAffinities = syllable.features.phonemeAffinities;
                    if (vowelAffinities.preferredRange) {
                        // Score notes based on pitch affinity to vowel
                        const scoredNotes = align.noteEvents.map(note => ({
                            ...note,
                            vowelAffinityScore: this.calculateVowelAffinityScore(
                                note.frequency, vowelAffinities.preferredRange
                            )
                        }));
                        
                        return {
                            ...align,
                            noteEvents: scoredNotes,
                            confidence: Math.min(0.95, align.confidence + 0.1),
                            refinements: ['vowel_affinity_scoring']
                        };
                    }
                }
            }
            return align;
        });
    }
    
    calculateVowelAffinityScore(frequency, preferredRange) {
        const [minFreq, maxFreq] = preferredRange;
        if (frequency >= minFreq && frequency <= maxFreq) {
            return 1.0;
        } else if (frequency < minFreq) {
            return Math.max(0, 1 - (minFreq - frequency) / minFreq);
        } else {
            return Math.max(0, 1 - (frequency - maxFreq) / maxFreq);
        }
    }
    
    adjustForVocalTechniques(alignment, vocalFeatures) {
        // Adjust alignment based on detected vocal techniques
        return alignment.map(align => {
            let adjustedAlign = { ...align };
            
            // Adjust for vibrato
            const vibratoInRange = vocalFeatures.vibrato.filter(v =>
                v.timestamp >= align.timing.startTime && v.timestamp <= align.timing.endTime
            );
            
            if (vibratoInRange.length > 0) {
                const avgVibratoDepth = vibratoInRange.reduce((sum, v) => sum + v.depth, 0) / vibratoInRange.length;
                adjustedAlign.vocalTechniques = adjustedAlign.vocalTechniques || {};
                adjustedAlign.vocalTechniques.vibrato = {
                    present: true,
                    avgDepth: avgVibratoDepth,
                    confidence: Math.min(adjustedAlign.confidence + 0.05, 1.0)
                };
            }
            
            // Adjust for portamento
            const portamentoInRange = vocalFeatures.portamento.filter(p =>
                (p.startTime >= align.timing.startTime && p.startTime <= align.timing.endTime) ||
                (p.endTime >= align.timing.startTime && p.endTime <= align.timing.endTime)
            );
            
            if (portamentoInRange.length > 0) {
                adjustedAlign.vocalTechniques = adjustedAlign.vocalTechniques || {};
                adjustedAlign.vocalTechniques.portamento = {
                    present: true,
                    transitions: portamentoInRange.length,
                    timingAdjustment: -0.05 // Slight timing adjustment for slides
                };
                
                // Adjust timing to account for portamento
                if (adjustedAlign.vocalTechniques.portamento.timingAdjustment) {
                    adjustedAlign.timing.startTime += adjustedAlign.vocalTechniques.portamento.timingAdjustment;
                }
            }
            
            return adjustedAlign;
        });
    }
    
    validateAndCorrectAlignment(alignment, syllableFeatures, vocalFeatures) {
        // Final validation and correction pass
        return alignment.map((align, index) => {
            let validatedAlign = { ...align };
            
            // Check timing consistency
            if (index > 0) {
                const prevAlign = alignment[index - 1];
                const timingGap = align.timing.startTime - prevAlign.timing.endTime;
                
                if (timingGap < -0.1) {
                    // Overlapping alignment - adjust
                    validatedAlign.timing.startTime = prevAlign.timing.endTime + 0.05;
                    validatedAlign.corrections = validatedAlign.corrections || [];
                    validatedAlign.corrections.push('timing_overlap_fixed');
                    validatedAlign.confidence *= 0.9;
                }
            }
            
            // Validate syllable-note count ratio
            const noteCount = align.noteEvents.length;
            const syllableComplexity = align.syllable.features?.syllableComplexity || 1;
            
            if (noteCount > syllableComplexity * 3) {
                // Too many notes for syllable - might be mis-aligned
                validatedAlign.warnings = validatedAlign.warnings || [];
                validatedAlign.warnings.push('excessive_notes_per_syllable');
                validatedAlign.confidence *= 0.8;
            }
            
            // Final confidence adjustment
            validatedAlign.finalConfidence = this.calculateFinalConfidence(validatedAlign);
            
            return validatedAlign;
        });
    }
    
    calculateFinalConfidence(alignment) {
        let confidence = alignment.confidence;
        
        // Boost confidence for good vocal technique detection
        if (alignment.vocalTechniques?.vibrato?.present) {
            confidence += 0.05;
        }
        
        // Reduce confidence for corrections and warnings
        if (alignment.corrections) {
            confidence -= alignment.corrections.length * 0.05;
        }
        if (alignment.warnings) {
            confidence -= alignment.warnings.length * 0.03;
        }
        
        // Ensure confidence stays in valid range
        return Math.max(0.1, Math.min(1.0, confidence));
    }
    
    calculateOverallConfidence(alignment) {
        if (alignment.length === 0) return 0;
        
        const totalConfidence = alignment.reduce((sum, align) => sum + (align.finalConfidence || align.confidence), 0);
        return totalConfidence / alignment.length;
    }
    
    generateAlignmentMetrics(alignment) {
        return {
            totalSyllables: alignment.length,
            totalNotes: alignment.reduce((sum, align) => sum + align.noteEvents.length, 0),
            averageNotesPerSyllable: alignment.length > 0 ? 
                alignment.reduce((sum, align) => sum + align.noteEvents.length, 0) / alignment.length : 0,
            melismaCount: alignment.filter(a => a.alignmentType === 'melisma').length,
            alignmentTypes: alignment.reduce((counts, align) => {
                counts[align.alignmentType] = (counts[align.alignmentType] || 0) + 1;
                return counts;
            }, {}),
            averageConfidence: this.calculateOverallConfidence(alignment)
        };
    }
    
    generateAlignmentWarnings(alignment) {
        const warnings = [];
        
        if (this.calculateOverallConfidence(alignment) < 0.5) {
            warnings.push('Low overall alignment confidence - consider manual review');
        }
        
        const melismaCount = alignment.filter(a => a.alignmentType === 'melisma').length;
        if (melismaCount > alignment.length * 0.5) {
            warnings.push('High proportion of melismatic passages detected');
        }
        
        const correctionCount = alignment.filter(a => a.corrections).length;
        if (correctionCount > alignment.length * 0.3) {
            warnings.push('Multiple timing corrections applied - timing may be unstable');
        }
        
        return warnings;
    }
}