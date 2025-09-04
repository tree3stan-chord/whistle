class NotationRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Staff parameters
        this.staffLines = 5;
        this.staffSpacing = 20;
        this.staffStartY = 100;
        this.staffWidth = this.canvas.width - 100;
        this.staffStartX = 50;
        
        // Note parameters
        this.noteWidth = 15;
        this.noteHeight = 12;
        this.noteSpacing = 40;
        this.currentX = this.staffStartX + 80; // Start position for notes
        
        // Musical constants
        this.clefType = 'treble';
        this.keySignature = 'C'; // C major (no sharps/flats)
        
        // Measure and scrolling
        this.measureWidth = 200;
        this.notesPerMeasure = 4;
        this.currentMeasure = 0;
        this.noteInMeasure = 0;
        this.allNotes = []; // Store all placed notes
        
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
    }
    
    drawStaff() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1.5;
        
        // Draw staff lines
        for (let i = 0; i < this.staffLines; i++) {
            const y = this.staffStartY + (i * this.staffSpacing);
            this.ctx.beginPath();
            this.ctx.moveTo(this.staffStartX, y);
            this.ctx.lineTo(this.staffStartX + this.staffWidth, y);
            this.ctx.stroke();
        }
        
        // Draw measure lines
        this.drawMeasureLines();
        
        // Draw treble clef (simplified)
        this.drawTrebleClef();
        
        // Draw time signature (4/4)
        this.drawTimeSignature();
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
        const clefX = this.staffStartX + 15;
        const clefY = this.staffStartY + (this.staffSpacing * 2);
        
        this.ctx.font = '60px serif';
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('𝄞', clefX, clefY + 10);
    }
    
    drawTimeSignature() {
        const sigX = this.staffStartX + 70;
        const sigY = this.staffStartY + this.staffSpacing;
        
        this.ctx.font = '24px serif';
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        
        // Draw 4/4 time signature
        this.ctx.fillText('4', sigX, sigY);
        this.ctx.fillText('4', sigX, sigY + (this.staffSpacing * 2));
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
            this.currentX += 40; // Advance for next note
        }
        
        const y = this.noteToStaffPosition(noteInfo);
        
        // Draw note head (filled oval)
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, this.noteWidth/2, this.noteHeight/2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw stem
        const stemHeight = this.staffSpacing * 3;
        const stemX = x + this.noteWidth/2;
        
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        if (y > this.staffStartY + this.staffSpacing * 2) {
            // Stem up
            this.ctx.moveTo(stemX, y);
            this.ctx.lineTo(stemX, y - stemHeight);
        } else {
            // Stem down
            this.ctx.moveTo(stemX - this.noteWidth, y);
            this.ctx.lineTo(stemX - this.noteWidth, y + stemHeight);
        }
        
        this.ctx.stroke();
        
        // Draw ledger lines if needed
        this.drawLedgerLines(x, y);
        
        // Draw accidentals if needed
        this.drawAccidental(noteInfo, x - 25, y);
    }
    
    drawLedgerLines(x, y) {
        const ledgerLength = 25;
        
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1.5;
        
        // Above staff
        if (y < this.staffStartY) {
            for (let ledgerY = this.staffStartY - this.staffSpacing; ledgerY >= y; ledgerY -= this.staffSpacing) {
                this.ctx.beginPath();
                this.ctx.moveTo(x - ledgerLength/2, ledgerY);
                this.ctx.lineTo(x + ledgerLength/2, ledgerY);
                this.ctx.stroke();
            }
        }
        
        // Below staff
        const bottomStaff = this.staffStartY + (this.staffSpacing * 4);
        if (y > bottomStaff) {
            for (let ledgerY = bottomStaff + this.staffSpacing; ledgerY <= y; ledgerY += this.staffSpacing) {
                this.ctx.beginPath();
                this.ctx.moveTo(x - ledgerLength/2, ledgerY);
                this.ctx.lineTo(x + ledgerLength/2, ledgerY);
                this.ctx.stroke();
            }
        }
    }
    
    drawAccidental(noteInfo, x, y) {
        if (noteInfo.note.includes('#')) {
            this.ctx.font = '20px serif';
            this.ctx.fillStyle = '#333';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('♯', x, y + 5);
        } else if (noteInfo.note.includes('b')) {
            this.ctx.font = '20px serif';
            this.ctx.fillStyle = '#333';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('♭', x, y + 5);
        }
    }
    
    addNote(noteInfo) {
        // Calculate position based on current measure and note position
        const measureX = this.staffStartX + (this.currentMeasure * this.measureWidth);
        const noteX = measureX + 20 + (this.noteInMeasure * (this.measureWidth - 40) / this.notesPerMeasure);
        
        // Check if we need to move to next measure
        if (this.noteInMeasure >= this.notesPerMeasure) {
            this.currentMeasure++;
            this.noteInMeasure = 0;
            
            // If we've exceeded the staff width, redraw with scrolling
            if (this.currentMeasure * this.measureWidth > this.staffWidth - this.measureWidth) {
                this.scrollToNewMeasure();
                return;
            }
        }
        
        // Store the note
        this.allNotes.push({
            ...noteInfo,
            x: noteX,
            measure: this.currentMeasure,
            noteIndex: this.noteInMeasure
        });
        
        // Draw the note
        this.drawNote(noteInfo, noteX);
        
        this.noteInMeasure++;
    }
    
    scrollToNewMeasure() {
        // For now, just clear and restart - could implement proper scrolling later
        this.clear();
        this.drawStaff();
        
        // Redraw recent notes (last 2 measures)
        const recentNotes = this.allNotes.slice(-8); // Last 8 notes
        this.allNotes = [];
        this.currentMeasure = 0;
        this.noteInMeasure = 0;
        
        // Re-add recent notes
        recentNotes.forEach(note => {
            this.addNote(note);
        });
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
}