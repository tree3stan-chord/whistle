class NotationRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // FOSS Standard Staff Parameters (based on LilyPond/MuseScore standards)
        this.staffLines = 5;
        this.staffSpacing = 16;        // Standard 16px staff spacing (4mm at 96dpi)
        this.staffStartY = 120;
        this.staffWidth = this.canvas.width - 120;
        this.staffStartX = 60;
        this.staffLineWidth = 1.2;    // Slightly thicker staff lines
        
        // FOSS Standard Note Parameters
        this.noteHeadWidth = 12;      // Standard note head width
        this.noteHeadHeight = 9;      // Standard note head height  
        this.stemWidth = 1.5;         // Stem thickness
        this.stemLength = 28;         // Standard stem length (3.5 staff spaces)
        this.noteSpacing = 32;        // Space between note heads
        
        // Musical typography (FOSS notation standards) - configurable
        this.clefType = 'treble';
        this.keySignature = 'C';      // C major (no sharps/flats)
        this.timeSignature = [4, 4];  // 4/4 time
        this.tempo = 120;             // BPM
        this.showBeatGrid = true;     // Visual beat markers
        
        // Layout management
        this.measureWidth = 160;      // Compact measure width
        this.currentX = this.staffStartX + 90;
        this.currentMeasure = 0;
        this.noteInMeasure = 0;
        this.allNotes = [];
        
        // Scrolling management
        this.scrollOffset = 0;        // Horizontal scroll offset
        this.maxVisibleMeasures = Math.floor(this.staffWidth / this.measureWidth);
        this.scrollThreshold = Math.max(2, this.maxVisibleMeasures - 1); // Start scrolling before edge
        this.scrollMode = 'continuous'; // 'continuous' or 'page'
        
        // Staff positioning reference points
        this.staffMiddleY = this.staffStartY + (this.staffSpacing * 2); // B4 line
        this.staffTopY = this.staffStartY;                              // F5 line  
        this.staffBottomY = this.staffStartY + (this.staffSpacing * 4); // E4 line
        
        this.setupCanvas();
    }
    
    setupCanvas() {
        // Set high DPI scaling
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        // Set canvas display size
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.currentX = this.staffStartX + 80;
        this.currentMeasure = 0;
        this.noteInMeasure = 0;
        this.allNotes = [];
        this.scrollOffset = 0; // Reset scroll position
    }
    
    drawStaff() {
        // Set staff line style (FOSS standard: dark but not black)
        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = this.staffLineWidth;
        this.ctx.lineCap = 'butt';
        
        // Draw staff lines with proper spacing
        for (let i = 0; i < this.staffLines; i++) {
            const y = this.staffStartY + (i * this.staffSpacing);
            this.ctx.beginPath();
            this.ctx.moveTo(this.staffStartX, y);
            this.ctx.lineTo(this.staffStartX + this.staffWidth, y);
            this.ctx.stroke();
        }
        
        // Draw barlines (measure separators)
        this.drawBarlines();
        
        // Draw musical symbols
        this.drawTrebleClef();
        this.drawTimeSignature();
        this.drawKeySignature();
    }
    
    drawBarlines() {
        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = 1.5;
        
        // Calculate which measures are visible based on scroll offset
        const startMeasure = Math.floor(this.scrollOffset / this.measureWidth);
        const endMeasure = startMeasure + this.maxVisibleMeasures + 2; // Draw a few extra
        
        // Draw barlines for visible measures
        for (let measure = startMeasure; measure <= endMeasure; measure++) {
            const x = this.staffStartX + (measure * this.measureWidth) - this.scrollOffset;
            
            // Only draw barlines that are within the visible staff area
            if (x >= this.staffStartX - this.measureWidth && x <= this.staffStartX + this.staffWidth + this.measureWidth) {
                if (measure === 0) {
                    // Initial barline (thicker)
                    this.drawSingleBarline(Math.max(x, this.staffStartX));
                } else {
                    this.drawSingleBarline(x);
                }
            }
        }
        
        // Draw final barline (end of visible staff) - double barline
        this.drawDoubleBarline(this.staffStartX + this.staffWidth - 8);
    }
    
    drawSingleBarline(x) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, this.staffTopY);
        this.ctx.lineTo(x, this.staffBottomY);
        this.ctx.stroke();
    }
    
    drawDoubleBarline(x) {
        // Thin line
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, this.staffTopY);
        this.ctx.lineTo(x, this.staffBottomY);
        this.ctx.stroke();
        
        // Thick line  
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 4, this.staffTopY);
        this.ctx.lineTo(x + 4, this.staffBottomY);
        this.ctx.stroke();
    }
    
    drawMeasureLines() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        
        const staffTop = this.staffStartY;
        const staffBottom = this.staffStartY + (this.staffSpacing * 4);
        
        // Draw measure separators
        for (let measure = 1; measure <= Math.floor(this.staffWidth / this.measureWidth); measure++) {
            const x = this.staffStartX + (measure * this.measureWidth);
            if (x < this.staffStartX + this.staffWidth) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, staffTop);
                this.ctx.lineTo(x, staffBottom);
                this.ctx.stroke();
            }
        }
    }
    
    drawTrebleClef() {
        const clefX = this.staffStartX + 20;
        const clefY = this.staffStartY + (this.staffSpacing * 2);
        
        // Use proper music font if available, fallback to Unicode
        this.ctx.font = 'bold 52px "Bravura", "Emmentaler", "Feta", serif';
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Treble clef symbol (G-clef) positioned on G4 line
        this.ctx.fillText('𝄞', clefX, clefY + 2);
    }
    
    drawKeySignature() {
        // For C major, no sharps or flats to draw
        // Position would be after treble clef, before time signature
        const keyX = this.staffStartX + 45;
        
        // Future enhancement: draw sharps/flats based on this.keySignature
        // For now, C major requires no accidentals
    }
    
    drawTimeSignature() {
        const sigX = this.staffStartX + 70;
        const topNumberY = this.staffStartY + this.staffSpacing;      // Second staff line
        const bottomNumberY = this.staffStartY + (this.staffSpacing * 3); // Fourth staff line
        
        // FOSS standard time signature font and positioning
        this.ctx.font = 'bold 28px "Bravura", "Times New Roman", serif';
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Draw time signature numbers (4/4)
        this.ctx.fillText(this.timeSignature[0].toString(), sigX, topNumberY);
        this.ctx.fillText(this.timeSignature[1].toString(), sigX, bottomNumberY);
    }
    
    noteToStaffPosition(noteInfo) {
        // Get base note and octave from note string (handles C#4, Bb3, etc.)
        const match = noteInfo.note.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) return this.staffStartY + (this.staffSpacing * 2); // Default to G4
        
        const [, noteName, octaveStr] = match;
        const octave = parseInt(octaveStr);
        const baseNote = noteName.charAt(0); // Just C, D, E, F, G, A, or B
        
        // Staff line positions in treble clef (from bottom to top of staff)
        // E4 = bottom line, G4 = second line, B4 = middle, D5 = fourth, F5 = top line
        const basePositions = {
            'C': 0,   // Space positions
            'D': 1,   // Line positions  
            'E': 2,   // Line positions
            'F': 3,   // Space positions
            'G': 4,   // Line positions
            'A': 5,   // Space positions
            'B': 6    // Line positions
        };
        
        // Calculate staff position: octave 4 starts below staff
        // Each octave = 7 semitones = 3.5 staff spaces
        const basePosition = basePositions[baseNote];
        const octaveOffset = (octave - 4) * 7;
        const staffPosition = basePosition + octaveOffset;
        
        // Convert to pixel Y coordinate (negative because canvas Y increases downward)
        // Staff position 2 = E4 (bottom line), position 10 = F5 (top line)
        const bottomLine = this.staffStartY + (this.staffSpacing * 4); // E4 position
        const y = bottomLine - (staffPosition - 2) * (this.staffSpacing / 2);
        
        return y;
    }
    
    drawNote(noteInfo, x = null) {
        if (x === null) {
            x = this.currentX;
            this.currentX += this.noteSpacing;
        }
        
        const y = this.noteToStaffPosition(noteInfo);
        
        // Draw ledger lines first (behind note)
        this.drawLedgerLines(x, y);
        
        // Draw accidental if needed (before note)
        this.drawAccidental(noteInfo, x - 20, y);
        
        // Draw note head (FOSS standard filled oval - quarter note)
        this.drawNoteHead(x, y, 'quarter');
        
        // Draw stem (FOSS standard positioning and length)
        this.drawStem(x, y);
    }
    
    drawNoteHead(x, y, noteType = 'quarter') {
        this.ctx.fillStyle = '#2a2a2a';
        
        switch (noteType) {
            case 'whole':
                // Whole note - hollow oval
                this.ctx.strokeStyle = '#2a2a2a';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.ellipse(x, y, this.noteHeadWidth/2, this.noteHeadHeight/2, -0.3, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
                
            case 'half':
                // Half note - hollow oval
                this.ctx.strokeStyle = '#2a2a2a';
                this.ctx.lineWidth = 1.5;
                this.ctx.beginPath();
                this.ctx.ellipse(x, y, this.noteHeadWidth/2, this.noteHeadHeight/2, -0.3, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
                
            case 'quarter':
            default:
                // Quarter note - filled oval (slanted for proper appearance)
                this.ctx.beginPath();
                this.ctx.ellipse(x, y, this.noteHeadWidth/2, this.noteHeadHeight/2, -0.3, 0, Math.PI * 2);
                this.ctx.fill();
                break;
        }
    }
    
    drawStem(x, y, noteType = 'quarter') {
        if (noteType === 'whole') return; // Whole notes don't have stems
        
        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = this.stemWidth;
        this.ctx.lineCap = 'butt';
        
        // FOSS standard: stems go up below middle line, down above middle line
        const stemUp = y > this.staffMiddleY;
        
        this.ctx.beginPath();
        
        if (stemUp) {
            // Stem up from right side of note head
            const stemStartX = x + (this.noteHeadWidth / 2);
            this.ctx.moveTo(stemStartX, y);
            this.ctx.lineTo(stemStartX, y - this.stemLength);
        } else {
            // Stem down from left side of note head
            const stemStartX = x - (this.noteHeadWidth / 2);
            this.ctx.moveTo(stemStartX, y);
            this.ctx.lineTo(stemStartX, y + this.stemLength);
        }
        
        this.ctx.stroke();
    }
    
    drawLedgerLines(x, y) {
        const ledgerLength = this.noteHeadWidth + 4; // FOSS standard: slightly wider than note head
        const tolerance = this.staffSpacing / 4; // Tolerance for ledger line positioning
        
        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = this.staffLineWidth; // Same as staff lines
        this.ctx.lineCap = 'butt';
        
        // Above staff ledger lines
        if (y < this.staffTopY - tolerance) {
            let ledgerY = this.staffTopY - this.staffSpacing;
            while (ledgerY >= y - tolerance) {
                this.ctx.beginPath();
                this.ctx.moveTo(x - ledgerLength/2, ledgerY);
                this.ctx.lineTo(x + ledgerLength/2, ledgerY);
                this.ctx.stroke();
                ledgerY -= this.staffSpacing;
            }
        }
        
        // Below staff ledger lines  
        if (y > this.staffBottomY + tolerance) {
            let ledgerY = this.staffBottomY + this.staffSpacing;
            while (ledgerY <= y + tolerance) {
                this.ctx.beginPath();
                this.ctx.moveTo(x - ledgerLength/2, ledgerY);
                this.ctx.lineTo(x + ledgerLength/2, ledgerY);
                this.ctx.stroke();
                ledgerY += this.staffSpacing;
            }
        }
    }
    
    drawAccidental(noteInfo, x, y) {
        if (!noteInfo.note.includes('#') && !noteInfo.note.includes('b')) {
            return; // No accidental needed
        }
        
        // FOSS standard accidental fonts and positioning
        this.ctx.font = 'bold 18px "Bravura", "Emmentaler", "Feta", serif';
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        if (noteInfo.note.includes('#')) {
            // Sharp symbol
            this.ctx.fillText('♯', x, y);
        } else if (noteInfo.note.includes('b')) {
            // Flat symbol  
            this.ctx.fillText('♭', x, y);
        }
    }
    
    addNote(noteInfo) {
        // Check if we need to move to next measure
        if (this.noteInMeasure >= this.notesPerMeasure) {
            this.currentMeasure++;
            this.noteInMeasure = 0;
            
            // Check if we need to scroll
            if (this.currentMeasure >= this.scrollThreshold) {
                this.updateScrolling();
            }
        }
        
        // Calculate absolute position (not affected by scroll)
        const absoluteX = this.staffStartX + 90 + (this.currentMeasure * this.measureWidth) + 
                         (this.noteInMeasure * (this.measureWidth - 40) / this.notesPerMeasure);
        
        // Store the note with absolute position
        const noteData = {
            ...noteInfo,
            absoluteX: absoluteX,
            measure: this.currentMeasure,
            noteIndex: this.noteInMeasure,
            timestamp: Date.now() // For cleanup of old notes
        };
        
        this.allNotes.push(noteData);
        
        // Remove old notes to prevent memory buildup (keep last 50 notes)
        if (this.allNotes.length > 50) {
            this.allNotes = this.allNotes.slice(-50);
        }
        
        // Redraw everything with current scroll position
        this.redrawWithScroll();
        
        this.noteInMeasure++;
    }
    
    updateScrolling() {
        if (this.scrollMode === 'continuous') {
            // Smooth continuous scrolling
            const targetScroll = (this.currentMeasure - this.scrollThreshold + 1) * this.measureWidth;
            this.scrollOffset = targetScroll;
        } else {
            // Page-based scrolling
            const page = Math.floor(this.currentMeasure / this.maxVisibleMeasures);
            this.scrollOffset = page * this.maxVisibleMeasures * this.measureWidth;
        }
    }
    
    redrawWithScroll() {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw staff with current scroll
        this.drawStaff();
        
        // Draw all visible notes
        this.drawAllVisibleNotes();
    }
    
    drawAllVisibleNotes() {
        // Calculate visible range
        const leftBound = this.scrollOffset - this.measureWidth; // Buffer for smooth scrolling
        const rightBound = this.scrollOffset + this.staffWidth + this.measureWidth;
        
        // Draw only notes that are visible
        this.allNotes.forEach(note => {
            const screenX = note.absoluteX - this.scrollOffset;
            
            // Only draw notes that are within the visible area
            if (screenX >= this.staffStartX - this.measureWidth && screenX <= this.staffStartX + this.staffWidth + this.measureWidth) {
                this.drawNote(note, screenX);
            }
        });
    }
    
    scrollToNewMeasure() {
        // Legacy method - redirect to new scrolling system
        this.updateScrolling();
        this.redrawWithScroll();
    }
    
    // Scroll control methods
    setScrollMode(mode) {
        this.scrollMode = mode; // 'continuous' or 'page'
        console.log('Scroll mode set to:', mode);
    }
    
    manualScroll(offset) {
        this.scrollOffset = Math.max(0, offset);
        this.redrawWithScroll();
    }
    
    getScrollInfo() {
        return {
            scrollOffset: this.scrollOffset,
            currentMeasure: this.currentMeasure,
            maxVisibleMeasures: this.maxVisibleMeasures,
            scrollThreshold: this.scrollThreshold,
            scrollMode: this.scrollMode,
            totalNotes: this.allNotes.length
        };
    }
    
    exportPng() {
        // Create filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `whistle-notation-${timestamp}.png`;
        
        // Convert canvas to PNG data URL
        const dataURL = this.canvas.toDataURL('image/png');
        
        // Create download link and trigger download
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`Exported PNG: ${filename}`);
    }
    
    exportJson() {
        // Create filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `whistle-melody-${timestamp}.json`;
        
        // Prepare export data
        const exportData = {
            timestamp: new Date().toISOString(),
            totalNotes: this.allNotes.length,
            keySignature: this.keySignature,
            timeSignature: '4/4',
            clef: this.clefType,
            notes: this.allNotes.map(note => ({
                note: note.note,
                octave: note.octave,
                frequency: Math.round(note.frequency * 100) / 100,
                cents: note.cents,
                measure: note.measure,
                noteIndex: note.noteIndex,
                timestamp: note.timestamp
            }))
        };
        
        // Convert to JSON string
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create download link and trigger download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log(`Exported JSON: ${filename} (${this.allNotes.length} notes)`);
    }
    
    // Configuration update method
    updateConfiguration(config) {
        // Update notation settings
        this.clefType = config.clef || this.clefType;
        this.keySignature = config.keySignature || this.keySignature;
        this.timeSignature = [config.timeSignature.numerator || 4, config.timeSignature.denominator || 4];
        this.tempo = config.tempo || this.tempo;
        this.showBeatGrid = config.showBeatGrid !== undefined ? config.showBeatGrid : this.showBeatGrid;
        
        // Update measures per line based on time signature
        this.notesPerMeasure = config.timeSignature.numerator || 4;
        
        // Clear and redraw with new configuration
        this.clear();
        this.drawStaff();
        
        console.log('Notation configuration updated:', {
            clef: this.clefType,
            key: this.keySignature,
            timeSignature: this.timeSignature,
            tempo: this.tempo,
            showBeatGrid: this.showBeatGrid
        });
    }
}