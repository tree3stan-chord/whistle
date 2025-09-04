/**
 * Musical Note Articulation Detection System
 * Intelligently determines when pitch changes constitute new musical notes
 * Based on pitch distance, timing, dynamics, and musical context
 */
class ArticulationDetector {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        
        // Current note tracking
        this.currentNote = null;
        this.noteStartTime = 0;
        this.notePitchHistory = [];
        this.noteConfidenceHistory = [];
        
        // Western Classical Articulation Parameters
        this.minNoteDuration = 120;       // Minimum discrete note length (ms) 
        this.articulationSensitivity = 1.0;
        
        // Classical music intervals (in cents) - more conservative thresholds
        this.intervals = {
            vibrato: 35,        // ±35 cents = expressive vibrato (don't change note)
            ornament: 70,       // 70 cents = grace notes, trills (same harmonic note)
            semitone: 100,      // 100 cents = semitone (new note if articulated)
            wholetone: 200,     // 200 cents = whole tone (definitely new note)
            minorThird: 300     // 300+ cents = clear melodic leap (new note)
        };
        
        // Classical articulation detection
        this.articulationTypes = {
            LEGATO: 'legato',           // Smooth connection (slurred)
            STACCATO: 'staccato',       // Detached/separated  
            TENUTO: 'tenuto',           // Sustained connection
            PORTAMENTO: 'portamento',   // Smooth slide between pitches
            ATTACK: 'attack'            // Clear new note beginning
        };
        
        // Dynamic detection parameters
        this.amplitudeHistory = new Array(10).fill(-Infinity);
        this.amplitudeIndex = 0;
        this.dynamicThreshold = 3; // dB change for articulation detection
        
        // Classical articulation detection parameters
        this.pitchChangeVelocity = 0;
        this.maxLegatoCentsPerMs = 3;    // Maximum cents/ms for legato connection
        this.maxPortamentoCentsPerMs = 8; // Maximum cents/ms for portamento 
        this.attackThreshold = 12;        // dB jump indicating note attack
        this.releaseThreshold = -8;       // dB drop indicating note release
        
        // Phrase structure detection
        this.silenceThreshold = -50;     // dB level considered silence
        this.breathPauseMin = 150;       // Minimum pause indicating phrase break (ms)
        this.lastSilenceTime = 0;
        
        console.log('ArticulationDetector initialized');
    }
    
    /**
     * Main articulation analysis - determines if current pitch represents a new note
     * @param {Object} pitchResult - Current pitch detection result
     * @param {number} amplitude - Current amplitude in dB
     * @returns {Object} - Articulation decision and metadata
     */
    analyzeArticulation(pitchResult, amplitude = -60) {
        const currentTime = Date.now();
        
        if (!pitchResult) {
            return this.handleSilence(currentTime);
        }
        
        // Update amplitude history
        this.updateAmplitudeHistory(amplitude);
        
        // First note initialization
        if (!this.currentNote) {
            return this.initializeFirstNote(pitchResult, currentTime, amplitude);
        }
        
        // Analyze various articulation factors
        const analysis = this.performArticulationAnalysis(pitchResult, currentTime, amplitude);
        
        return this.makeArticulationDecision(analysis, pitchResult, currentTime);
    }
    
    handleSilence(currentTime) {
        // If we have a current note and silence is detected, potentially end it
        if (this.currentNote) {
            const noteDuration = currentTime - this.noteStartTime;
            
            if (noteDuration >= this.minNoteDuration) {
                const endedNote = {
                    ...this.currentNote,
                    duration: noteDuration,
                    endTime: currentTime,
                    articulationType: 'silence_end'
                };
                
                this.currentNote = null;
                return {
                    noteEvent: 'note_end',
                    note: endedNote,
                    reason: 'silence_detected'
                };
            }
        }
        
        return { noteEvent: 'silence', note: null };
    }
    
    initializeFirstNote(pitchResult, currentTime, amplitude) {
        this.currentNote = {
            frequency: pitchResult.frequency,
            note: this.frequencyToNoteName(pitchResult.frequency),
            confidence: pitchResult.confidence,
            startAmplitude: amplitude
        };
        this.noteStartTime = currentTime;
        this.notePitchHistory = [pitchResult.frequency];
        this.noteConfidenceHistory = [pitchResult.confidence];
        
        return {
            noteEvent: 'note_start',
            note: this.currentNote,
            reason: 'first_note'
        };
    }
    
    performArticulationAnalysis(pitchResult, currentTime, amplitude) {
        const currentFreq = pitchResult.frequency;
        const noteFreq = this.currentNote.frequency;
        
        // 1. Pitch distance analysis
        const pitchDistance = this.calculatePitchDistance(currentFreq, noteFreq);
        
        // 2. Dynamic change analysis
        const dynamicChange = this.analyzeDynamicChange(amplitude);
        
        // 3. Pitch stability analysis
        const pitchStability = this.analyzePitchStability(currentFreq);
        
        // 4. Temporal analysis
        const noteDuration = currentTime - this.noteStartTime;
        
        // 5. Pitch velocity analysis (for glides vs. jumps)
        const pitchVelocity = this.calculatePitchVelocity(currentFreq);
        
        // 6. Confidence analysis
        const confidenceChange = Math.abs(pitchResult.confidence - this.currentNote.confidence);
        
        return {
            pitchDistance,
            dynamicChange,
            pitchStability,
            noteDuration,
            pitchVelocity,
            confidenceChange,
            currentFreq,
            amplitude
        };
    }
    
    makeArticulationDecision(analysis, pitchResult, currentTime) {
        // Detect classical articulation type first
        const articulationType = this.detectArticulationType(analysis);
        
        // Make decision based on Western classical music rules
        switch (articulationType) {
            case this.articulationTypes.ATTACK:
                return this.startNewNote(pitchResult, currentTime, analysis, 'attack_detected');
                
            case this.articulationTypes.STACCATO:
                return this.startNewNote(pitchResult, currentTime, analysis, 'staccato_articulation');
                
            case this.articulationTypes.LEGATO:
                // Legato: same note continues despite pitch change
                if (analysis.pitchDistance > this.intervals.semitone) {
                    // Large interval in legato = new note, but connected
                    return this.startNewNote(pitchResult, currentTime, analysis, 'legato_new_pitch');
                } else {
                    // Small interval = ornament or expression, continue note
                    return this.continueCurrentNote(pitchResult, currentTime, analysis);
                }
                
            case this.articulationTypes.PORTAMENTO:
                // Portamento: smooth slide - continue until slide ends
                if (analysis.pitchVelocity < this.maxLegatoCentsPerMs) {
                    // Slide has stabilized, register new note
                    return this.startNewNote(pitchResult, currentTime, analysis, 'portamento_arrival');
                } else {
                    // Still sliding, continue
                    return this.continueCurrentNote(pitchResult, currentTime, analysis);
                }
                
            case this.articulationTypes.TENUTO:
            default:
                // Sustained connection - use traditional scoring
                return this.scoreBasedDecision(analysis, pitchResult, currentTime);
        }
    }
    
    detectArticulationType(analysis) {
        // 1. Check for clear attack (sudden amplitude increase)
        if (analysis.dynamicChange > this.attackThreshold) {
            return this.articulationTypes.ATTACK;
        }
        
        // 2. Check for staccato (short notes with clear separation)
        if (analysis.noteDuration < this.minNoteDuration * 0.8 && 
            analysis.dynamicChange > this.dynamicThreshold) {
            return this.articulationTypes.STACCATO;
        }
        
        // 3. Check for portamento (rapid continuous pitch change)
        if (analysis.pitchVelocity > this.maxPortamentoCentsPerMs &&
            analysis.pitchDistance > this.intervals.wholetone) {
            return this.articulationTypes.PORTAMENTO;
        }
        
        // 4. Check for legato (smooth, connected, moderate pitch changes)
        if (analysis.pitchVelocity <= this.maxLegatoCentsPerMs &&
            analysis.pitchDistance > this.intervals.ornament &&
            analysis.dynamicChange < this.dynamicThreshold) {
            return this.articulationTypes.LEGATO;
        }
        
        // 5. Default to tenuto (sustained)
        return this.articulationTypes.TENUTO;
    }
    
    scoreBasedDecision(analysis, pitchResult, currentTime) {
        const scores = {
            pitchChange: this.scoreClassicalPitchChange(analysis.pitchDistance, analysis.pitchVelocity),
            dynamicArticulation: this.scoreDynamicArticulation(analysis.dynamicChange),
            phraseStructure: this.scorePhraseStructure(analysis.noteDuration),
            intervalClass: this.scoreIntervalClass(analysis.pitchDistance)
        };
        
        // Classical music weighted decision
        const articulationScore = 
            scores.intervalClass * 0.35 +        // Primary: musical interval
            scores.pitchChange * 0.3 +           // Pitch change character
            scores.dynamicArticulation * 0.25 +  // Dynamic articulation
            scores.phraseStructure * 0.1;       // Phrase structure
        
        if (articulationScore > 0.75) {
            return this.startNewNote(pitchResult, currentTime, analysis, 'classical_new_note');
        } else if (articulationScore > 0.45 && analysis.noteDuration > this.minNoteDuration * 1.5) {
            return this.startNewNote(pitchResult, currentTime, analysis, 'classical_moderate');
        } else {
            return this.continueCurrentNote(pitchResult, currentTime, analysis);
        }
    }
    
    calculatePitchDistance(freq1, freq2) {
        if (freq1 <= 0 || freq2 <= 0) return 0;
        return Math.abs(1200 * Math.log2(freq1 / freq2)); // Distance in cents
    }
    
    analyzeDynamicChange(currentAmplitude) {
        const recentAmplitudes = this.amplitudeHistory.slice(-3);
        const avgRecentAmplitude = recentAmplitudes.reduce((a, b) => a + b, 0) / recentAmplitudes.length;
        return Math.abs(currentAmplitude - avgRecentAmplitude);
    }
    
    analyzePitchStability(currentFreq) {
        this.notePitchHistory.push(currentFreq);
        if (this.notePitchHistory.length > 10) {
            this.notePitchHistory.shift();
        }
        
        if (this.notePitchHistory.length < 3) return 1.0;
        
        const recent = this.notePitchHistory.slice(-5);
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
        const stdDev = Math.sqrt(variance);
        
        // Return stability as inverse coefficient of variation
        return mean > 0 ? 1 / (1 + (stdDev / mean) * 100) : 0;
    }
    
    calculatePitchVelocity(currentFreq) {
        const prevFreq = this.notePitchHistory[this.notePitchHistory.length - 1] || currentFreq;
        const timeDelta = 1000 / 30; // Assume ~30fps update rate
        
        const freqChange = Math.abs(currentFreq - prevFreq);
        const centsChange = this.calculatePitchDistance(currentFreq, prevFreq);
        
        this.pitchChangeVelocity = centsChange / timeDelta; // cents per ms
        return this.pitchChangeVelocity;
    }
    
    scoreClassicalPitchChange(pitchDistance, pitchVelocity) {
        // Classical music interval-based scoring
        let score = 0;
        
        if (pitchDistance < this.intervals.vibrato) {
            score = 0; // Vibrato/expression, continue note
        } else if (pitchDistance < this.intervals.ornament) {
            score = 0.1; // Grace notes, trills - usually continue
        } else if (pitchDistance < this.intervals.semitone) {
            score = 0.3; // Microtonal - possibly new note
        } else if (pitchDistance < this.intervals.wholetone) {
            score = 0.6; // Semitone - likely new note
        } else if (pitchDistance < this.intervals.minorThird) {
            score = 0.8; // Whole tone - new note
        } else {
            score = 0.95; // Large leap - definitely new note
        }
        
        // Classical articulation velocity adjustments
        if (pitchVelocity > this.maxPortamentoCentsPerMs) {
            score *= 1.1; // Quick jumps = articulated
        } else if (pitchVelocity <= this.maxLegatoCentsPerMs) {
            score *= 0.8; // Smooth connection = legato
        }
        
        return Math.min(1.0, score);
    }
    
    scoreIntervalClass(pitchDistance) {
        // Score based on classical interval classes
        const semitones = Math.round(pitchDistance / 100);
        
        // Classical interval preferences
        switch (semitones) {
            case 0: return 0;      // Unison
            case 1: case 11: return 0.5;  // Minor 2nd, Major 7th (dissonant steps)
            case 2: case 10: return 0.6;  // Major 2nd, Minor 7th 
            case 3: case 9: return 0.7;   // Minor 3rd, Major 6th
            case 4: case 8: return 0.7;   // Major 3rd, Minor 6th
            case 5: case 7: return 0.8;   // Perfect 4th, Perfect 5th
            case 6: return 0.5;            // Tritone (special case)
            case 12: return 0.9;           // Octave
            default: return 0.9;           // Larger intervals
        }
    }
    
    scorePhraseStructure(noteDuration) {
        // Classical phrasing considerations
        if (noteDuration < this.minNoteDuration * 0.5) {
            return 0.1; // Very short - ornament
        } else if (noteDuration < this.minNoteDuration) {
            return 0.3; // Short note
        } else if (noteDuration < this.minNoteDuration * 3) {
            return 0.2; // Normal length
        } else {
            return 0.4; // Long note - more likely to change
        }
    }
    
    scoreDynamicArticulation(dynamicChange) {
        // Sudden amplitude changes indicate articulation
        if (dynamicChange > this.dynamicThreshold * 2) {
            return 0.8; // Strong dynamic articulation
        } else if (dynamicChange > this.dynamicThreshold) {
            return 0.4; // Moderate dynamic change
        }
        return 0;
    }
    
    scorePitchStability(stability) {
        // Less stable pitch = more likely transitioning to new note
        return 1.0 - stability;
    }
    
    scoreTemporalFactors(noteDuration) {
        // Longer notes are more likely to change
        if (noteDuration < this.minNoteDuration) {
            return 0; // Too short to change
        } else if (noteDuration > this.minNoteDuration * 4) {
            return 0.3; // Long note, possible change
        }
        return 0.1;
    }
    
    scoreConfidenceChange(confidenceChange) {
        // Large confidence changes may indicate new note
        return Math.min(0.5, confidenceChange * 2);
    }
    
    startNewNote(pitchResult, currentTime, analysis, reason) {
        // End current note
        const endedNote = {
            ...this.currentNote,
            duration: currentTime - this.noteStartTime,
            endTime: currentTime,
            endReason: reason
        };
        
        // Start new note
        this.currentNote = {
            frequency: pitchResult.frequency,
            note: this.frequencyToNoteName(pitchResult.frequency),
            confidence: pitchResult.confidence,
            startAmplitude: analysis.amplitude
        };
        this.noteStartTime = currentTime;
        this.notePitchHistory = [pitchResult.frequency];
        this.noteConfidenceHistory = [pitchResult.confidence];
        
        return {
            noteEvent: 'note_change',
            endedNote: endedNote,
            newNote: this.currentNote,
            reason: reason,
            articulationScore: analysis
        };
    }
    
    continueCurrentNote(pitchResult, currentTime, analysis) {
        // Update current note with latest pitch info
        const avgFreq = (this.currentNote.frequency + pitchResult.frequency) / 2;
        this.currentNote.frequency = avgFreq;
        this.currentNote.note = this.frequencyToNoteName(avgFreq);
        
        return {
            noteEvent: 'note_continue',
            note: {
                ...this.currentNote,
                duration: currentTime - this.noteStartTime,
                currentFreq: pitchResult.frequency
            },
            reason: 'insufficient_articulation'
        };
    }
    
    updateAmplitudeHistory(amplitude) {
        this.amplitudeHistory[this.amplitudeIndex] = amplitude;
        this.amplitudeIndex = (this.amplitudeIndex + 1) % this.amplitudeHistory.length;
    }
    
    frequencyToNoteName(frequency) {
        // Simple frequency to note conversion - will be replaced by main system
        const A4 = 440;
        const semitone = Math.round(12 * Math.log2(frequency / A4));
        const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
        const octave = Math.floor((semitone + 9) / 12) + 4;
        const noteIndex = ((semitone % 12) + 12) % 12;
        return noteNames[noteIndex] + octave;
    }
    
    /**
     * Adjust articulation sensitivity
     * @param {number} sensitivity - 0.5 (less sensitive) to 2.0 (more sensitive)
     */
    setSensitivity(sensitivity) {
        this.articulationSensitivity = Math.max(0.1, Math.min(3.0, sensitivity));
        console.log(`Articulation sensitivity set to ${this.articulationSensitivity}`);
    }
    
    /**
     * Reset articulation state (e.g., between performances)
     */
    reset() {
        this.currentNote = null;
        this.noteStartTime = 0;
        this.notePitchHistory = [];
        this.noteConfidenceHistory = [];
        this.amplitudeHistory.fill(-Infinity);
        this.pitchChangeVelocity = 0;
    }
}