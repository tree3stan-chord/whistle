/**
 * VocalNotationRenderer - Professional vocal sheet music rendering
 * Extends NotationRenderer with vocal-specific features:
 * - Automatic clef selection based on vocal range
 * - Lyric placement with syllable alignment
 * - Melisma notation for multiple notes per syllable
 * - Breath marks and vocal technique symbols
 * - Expression notation (dynamics, articulations)
 */

class VocalNotationRenderer extends NotationRenderer {
    constructor(canvas) {
        super(canvas);
        
        // Vocal-specific properties
        this.vocalRange = { lowest: null, highest: null };
        this.preferredClef = 'treble';  // Will be auto-selected
        this.lyrics = [];
        this.syllableMap = new Map();  // Maps note indices to syllable data
        this.breathMarks = [];
        this.expressionMarks = [];
        this.articulationMarks = [];
        this.dynamicMarks = [];
        
        // Lyric rendering properties
        this.lyricFontSize = 12;
        this.lyricFontFamily = 'serif';
        this.lyricSpacing = 28;  // Distance below staff
        this.melismaLineHeight = 2;
        this.hyphenLength = 8;
        
        // Vocal technique symbols
        this.breathMarkSymbol = '𝄒';  // Unicode breath mark
        this.vibratoSymbol = '~~~~~';
        this.portamentoSymbol = '⤴';
        
        // Clef selection ranges (in MIDI note numbers)
        this.clefRanges = {
            treble: { optimal: [60, 81], acceptable: [55, 84] },    // C4-A5 optimal
            alto: { optimal: [53, 74], acceptable: [48, 79] },      // F3-D5 optimal  
            tenor: { optimal: [48, 69], acceptable: [43, 74] },     // C3-A4 optimal
            bass: { optimal: [40, 60], acceptable: [35, 65] }       // E2-C4 optimal
        };
        
        // Expression mark templates
        this.dynamicMarkings = {
            'pp': { symbol: 'pp', fontSize: 14, weight: 'bold' },
            'p': { symbol: 'p', fontSize: 14, weight: 'bold' },
            'mp': { symbol: 'mp', fontSize: 12, weight: 'normal' },
            'mf': { symbol: 'mf', fontSize: 12, weight: 'normal' },
            'f': { symbol: 'f', fontSize: 14, weight: 'bold' },
            'ff': { symbol: 'ff', fontSize: 14, weight: 'bold' }
        };
        
        this.articulationSymbols = {
            'staccato': '•',
            'accent': '>',
            'tenuto': '−',
            'marcato': '∧',
            'fermata': '𝄐'
        };
    }

    /**
     * Analyze vocal range and select optimal clef
     * @param {Array} pitchData - Array of pitch data with MIDI note numbers
     */
    analyzeVocalRange(pitchData) {
        if (!pitchData || pitchData.length === 0) return;
        
        const midiNotes = pitchData
            .filter(p => p.midiNote && p.midiNote > 0)
            .map(p => p.midiNote);
            
        if (midiNotes.length === 0) return;
        
        this.vocalRange.lowest = Math.min(...midiNotes);
        this.vocalRange.highest = Math.max(...midiNotes);
        
        // Select optimal clef based on range coverage
        const rangeMid = (this.vocalRange.lowest + this.vocalRange.highest) / 2;
        let bestClef = 'treble';
        let bestScore = 0;
        
        for (const [clef, ranges] of Object.entries(this.clefRanges)) {
            // Score based on how well the vocal range fits the clef's optimal range
            const optimalOverlap = Math.max(0, 
                Math.min(this.vocalRange.highest, ranges.optimal[1]) - 
                Math.max(this.vocalRange.lowest, ranges.optimal[0])
            );
            
            const acceptableOverlap = Math.max(0,
                Math.min(this.vocalRange.highest, ranges.acceptable[1]) - 
                Math.max(this.vocalRange.lowest, ranges.acceptable[0])
            );
            
            const score = optimalOverlap * 2 + acceptableOverlap;
            
            if (score > bestScore) {
                bestScore = score;
                bestClef = clef;
            }
        }
        
        if (bestClef !== this.clefType) {
            this.clefType = bestClef;
            this.preferredClef = bestClef;
            console.log(`Auto-selected ${bestClef} clef for range ${this.vocalRange.lowest}-${this.vocalRange.highest}`);
        }
    }

    /**
     * Add lyric data with syllable-to-note mapping
     * @param {Object} lyricData - Contains text, syllables, and timing
     */
    addLyricData(lyricData) {
        if (!lyricData || !lyricData.syllables) return;
        
        this.lyrics = lyricData.syllables;
        
        // Create syllable-to-note mapping based on timing
        lyricData.syllables.forEach((syllable, index) => {
            if (syllable.startTime !== undefined) {
                // Find the note(s) that correspond to this syllable timing
                const matchingNotes = this.allNotes.filter(note => 
                    Math.abs(note.timestamp - syllable.startTime) < 0.1 // 100ms tolerance
                );
                
                if (matchingNotes.length > 0) {
                    const noteIndex = this.allNotes.indexOf(matchingNotes[0]);
                    this.syllableMap.set(noteIndex, {
                        text: syllable.text,
                        index: index,
                        noteCount: matchingNotes.length,  // For melismas
                        isHyphenated: syllable.text.endsWith('-')
                    });
                }
            }
        });
    }

    /**
     * Add breath mark at specified note position
     * @param {number} noteIndex - Index of note after which to place breath mark
     * @param {string} type - Type of breath mark ('comma', 'tick', 'caesura')
     */
    addBreathMark(noteIndex, type = 'comma') {
        this.breathMarks.push({
            noteIndex: noteIndex,
            type: type,
            symbol: type === 'comma' ? ',' : type === 'tick' ? '𝄒' : '𝄓'
        });
    }

    /**
     * Add expression marking (dynamics, tempo, etc.)
     * @param {Object} marking - Expression marking data
     */
    addExpressionMark(marking) {
        switch (marking.type) {
            case 'dynamic':
                this.dynamicMarks.push(marking);
                break;
            case 'articulation':
                this.articulationMarks.push(marking);
                break;
            case 'expression':
                this.expressionMarks.push(marking);
                break;
        }
    }

    /**
     * Render complete vocal score with all vocal-specific elements
     * @param {Array} pitchData - Pitch analysis data
     * @param {Object} lyricsData - Lyrics and syllable data  
     * @param {Object} articulationData - Articulation analysis data
     */
    renderVocalScore(pitchData, lyricsData = null, articulationData = null) {
        // Step 1: Analyze range and select clef
        this.analyzeVocalRange(pitchData);
        
        // Step 2: Process lyrics if provided
        if (lyricsData) {
            this.addLyricData(lyricsData);
        }
        
        // Step 3: Process articulation data
        if (articulationData) {
            this.processArticulationData(articulationData);
        }
        
        // Step 4: Clear and render basic staff
        this.clear();
        this.drawStaff();
        this.drawClef();
        this.drawTimeSignature();
        
        // Step 5: Render notes with vocal enhancements
        this.renderNotesWithVocalFeatures();
        
        // Step 6: Render lyrics
        this.renderLyrics();
        
        // Step 7: Render expression markings
        this.renderExpressionMarkings();
        
        // Step 8: Render breath marks
        this.renderBreathMarks();
        
        return this.generateVocalScoreData();
    }

    /**
     * Process articulation data from Phase 3 analysis
     * @param {Object} articulationData - Complete articulation analysis
     */
    processArticulationData(articulationData) {
        if (!articulationData) return;
        
        // Process vibrato markings
        if (articulationData.vibrato) {
            articulationData.vibrato.forEach((vibrato, noteIndex) => {
                if (vibrato.present && vibrato.quality > 0.6) {
                    this.addExpressionMark({
                        type: 'expression',
                        noteIndex: noteIndex,
                        symbol: this.vibratoSymbol,
                        position: 'above'
                    });
                }
            });
        }
        
        // Process dynamic analysis
        if (articulationData.dynamics) {
            articulationData.dynamics.forEach(dynamic => {
                this.addExpressionMark({
                    type: 'dynamic',
                    noteIndex: dynamic.noteIndex,
                    marking: dynamic.level,
                    position: 'below'
                });
            });
        }
        
        // Process breathing patterns
        if (articulationData.breathing) {
            articulationData.breathing.breathMarks.forEach(breath => {
                this.addBreathMark(breath.noteIndex, 'comma');
            });
        }
        
        // Process articulation connections
        if (articulationData.connections) {
            articulationData.connections.forEach(connection => {
                this.addExpressionMark({
                    type: 'articulation',
                    startNote: connection.startNote,
                    endNote: connection.endNote,
                    articulationType: connection.type,
                    confidence: connection.confidence
                });
            });
        }
    }

    /**
     * Enhanced note rendering with vocal-specific features
     */
    renderNotesWithVocalFeatures() {
        this.allNotes.forEach((note, index) => {
            const screenX = this.calculateNoteX(index);
            
            // Render basic note
            this.drawNote(note, screenX);
            
            // Add syllable indicator if this note has lyrics
            if (this.syllableMap.has(index)) {
                this.markSyllableNote(screenX, note, index);
            }
        });
    }

    /**
     * Mark notes that have syllables for visual reference
     * @param {number} x - X position of note
     * @param {Object} note - Note data
     * @param {number} index - Note index
     */
    markSyllableNote(x, note, index) {
        const syllableData = this.syllableMap.get(index);
        if (!syllableData) return;
        
        // Subtle visual indicator for syllable notes
        this.ctx.save();
        this.ctx.strokeStyle = '#4A90E2';
        this.ctx.lineWidth = 2;
        
        const y = this.calculateNoteY(note.pitch);
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.noteHeadWidth/2 + 2, 0, 2 * Math.PI);
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * Render lyrics below the staff with proper alignment
     */
    renderLyrics() {
        if (this.lyrics.length === 0) return;
        
        this.ctx.save();
        this.ctx.font = `${this.lyricFontSize}px ${this.lyricFontFamily}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillStyle = '#000000';
        
        const lyricY = this.staffStartY + (this.staffSpacing * 4) + this.lyricSpacing;
        
        // Render each syllable under its corresponding note(s)
        for (const [noteIndex, syllableData] of this.syllableMap) {
            const noteX = this.calculateNoteX(noteIndex);
            
            // Handle melismas (multiple notes per syllable)
            if (syllableData.noteCount > 1) {
                this.renderMelisma(noteIndex, syllableData, lyricY);
            } else {
                // Single note syllable
                this.ctx.fillText(syllableData.text, noteX, lyricY);
            }
            
            // Add hyphen if syllable is hyphenated
            if (syllableData.isHyphenated && noteIndex < this.allNotes.length - 1) {
                const nextNoteX = this.calculateNoteX(noteIndex + 1);
                const hyphenX = noteX + (nextNoteX - noteX) / 2;
                this.ctx.fillText('-', hyphenX, lyricY);
            }
        }
        
        this.ctx.restore();
    }

    /**
     * Render melisma (multiple notes for one syllable)
     * @param {number} startNoteIndex - First note of melisma
     * @param {Object} syllableData - Syllable information
     * @param {number} lyricY - Y position for lyrics
     */
    renderMelisma(startNoteIndex, syllableData, lyricY) {
        const startX = this.calculateNoteX(startNoteIndex);
        const endX = this.calculateNoteX(startNoteIndex + syllableData.noteCount - 1);
        
        // Render syllable text under first note
        this.ctx.fillText(syllableData.text, startX, lyricY);
        
        // Draw melisma line
        this.ctx.save();
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = this.melismaLineHeight;
        this.ctx.beginPath();
        this.ctx.moveTo(startX + 15, lyricY + this.lyricFontSize + 4);
        this.ctx.lineTo(endX - 15, lyricY + this.lyricFontSize + 4);
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * Render expression markings (dynamics, articulations, etc.)
     */
    renderExpressionMarkings() {
        // Render dynamic markings
        this.dynamicMarks.forEach(marking => {
            const x = this.calculateNoteX(marking.noteIndex);
            const y = this.staffStartY + (this.staffSpacing * 5) + 20;
            
            this.ctx.save();
            const dynTemplate = this.dynamicMarkings[marking.marking];
            if (dynTemplate) {
                this.ctx.font = `${dynTemplate.weight} ${dynTemplate.fontSize}px serif`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(dynTemplate.symbol, x, y);
            }
            this.ctx.restore();
        });
        
        // Render articulation markings
        this.articulationMarks.forEach(marking => {
            this.renderArticulationMark(marking);
        });
        
        // Render expression markings (vibrato, etc.)
        this.expressionMarks.forEach(marking => {
            const x = this.calculateNoteX(marking.noteIndex);
            const note = this.allNotes[marking.noteIndex];
            const noteY = this.calculateNoteY(note.pitch);
            const y = marking.position === 'above' ? noteY - 20 : noteY + 30;
            
            this.ctx.save();
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(marking.symbol, x, y);
            this.ctx.restore();
        });
    }

    /**
     * Render specific articulation mark
     * @param {Object} marking - Articulation marking data
     */
    renderArticulationMark(marking) {
        const startX = this.calculateNoteX(marking.startNote);
        const endX = marking.endNote ? this.calculateNoteX(marking.endNote) : startX;
        
        this.ctx.save();
        
        switch (marking.articulationType) {
            case 'legato':
                this.drawSlur(startX, endX, marking.startNote, marking.endNote);
                break;
            case 'staccato':
                this.drawStaccatoDot(startX, marking.startNote);
                break;
            case 'portamento':
                this.drawPortamento(startX, endX, marking.startNote, marking.endNote);
                break;
            case 'accent':
                this.drawAccent(startX, marking.startNote);
                break;
        }
        
        this.ctx.restore();
    }

    /**
     * Draw slur between notes
     */
    drawSlur(startX, endX, startNoteIndex, endNoteIndex) {
        const startNote = this.allNotes[startNoteIndex];
        const endNote = this.allNotes[endNoteIndex];
        const startY = this.calculateNoteY(startNote.pitch) - 15;
        const endY = this.calculateNoteY(endNote.pitch) - 15;
        
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        
        const controlY = Math.min(startY, endY) - 8;
        const midX = (startX + endX) / 2;
        
        this.ctx.moveTo(startX, startY);
        this.ctx.quadraticCurveTo(midX, controlY, endX, endY);
        this.ctx.stroke();
    }

    /**
     * Draw staccato dot
     */
    drawStaccatoDot(x, noteIndex) {
        const note = this.allNotes[noteIndex];
        const noteY = this.calculateNoteY(note.pitch);
        const y = noteY + 20;
        
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    /**
     * Draw portamento line
     */
    drawPortamento(startX, endX, startNoteIndex, endNoteIndex) {
        const startNote = this.allNotes[startNoteIndex];
        const endNote = this.allNotes[endNoteIndex];
        const startY = this.calculateNoteY(startNote.pitch);
        const endY = this.calculateNoteY(endNote.pitch);
        
        this.ctx.strokeStyle = '#666666';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);
        this.ctx.beginPath();
        this.ctx.moveTo(startX + 10, startY);
        this.ctx.lineTo(endX - 10, endY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    /**
     * Draw accent mark
     */
    drawAccent(x, noteIndex) {
        const note = this.allNotes[noteIndex];
        const noteY = this.calculateNoteY(note.pitch);
        const y = noteY - 15;
        
        this.ctx.font = '14px serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('>', x, y);
    }

    /**
     * Render breath marks
     */
    renderBreathMarks() {
        this.breathMarks.forEach(breathMark => {
            const x = this.calculateNoteX(breathMark.noteIndex) + 20;
            const y = this.staffStartY + (this.staffSpacing * 2);
            
            this.ctx.save();
            this.ctx.font = '16px serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(breathMark.symbol, x, y);
            this.ctx.restore();
        });
    }

    /**
     * Calculate X position for note at given index
     */
    calculateNoteX(noteIndex) {
        const measureIndex = Math.floor(noteIndex / 4); // Assuming 4 notes per measure
        const noteInMeasure = noteIndex % 4;
        
        return this.staffStartX + 90 + 
               (measureIndex * this.measureWidth) + 
               (noteInMeasure * this.noteSpacing) -
               this.scrollOffset;
    }

    /**
     * Generate structured vocal score data for export
     */
    generateVocalScoreData() {
        return {
            metadata: {
                clef: this.clefType,
                keySignature: this.keySignature,
                timeSignature: this.timeSignature,
                vocalRange: this.vocalRange,
                tempo: this.tempo
            },
            staffSystems: [{
                measures: this.generateMeasureData(),
                lyrics: this.generateLyricData(),
                articulations: this.articulationMarks,
                dynamics: this.dynamicMarks,
                expressions: this.expressionMarks,
                breathMarks: this.breathMarks
            }],
            renderingInfo: {
                totalNotes: this.allNotes.length,
                measuresRendered: Math.ceil(this.allNotes.length / 4),
                lyricSyllables: this.lyrics.length,
                articulationCount: this.articulationMarks.length
            }
        };
    }

    /**
     * Generate measure data for export
     */
    generateMeasureData() {
        const measures = [];
        const notesPerMeasure = 4; // Simplified for now
        
        for (let i = 0; i < this.allNotes.length; i += notesPerMeasure) {
            const measureNotes = this.allNotes.slice(i, i + notesPerMeasure);
            measures.push({
                measureNumber: Math.floor(i / notesPerMeasure) + 1,
                notes: measureNotes.map(note => ({
                    pitch: note.pitch,
                    midiNote: note.midiNote,
                    duration: note.duration || 'quarter',
                    timestamp: note.timestamp
                }))
            });
        }
        
        return measures;
    }

    /**
     * Generate lyric data for export
     */
    generateLyricData() {
        const lyricData = {
            syllables: [],
            syllableAlignment: []
        };
        
        for (const [noteIndex, syllableInfo] of this.syllableMap) {
            lyricData.syllables.push(syllableInfo.text);
            lyricData.syllableAlignment.push(noteIndex);
        }
        
        return lyricData;
    }
}