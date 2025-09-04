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
        this.currentX = this.staffStartX + 50; // Start position for notes
        
        // Musical constants
        this.clefType = 'treble';
        this.keySignature = 'C'; // C major (no sharps/flats)
        
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
        this.currentX = this.staffStartX + 50;
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
        
        // Draw treble clef (simplified)
        this.drawTrebleClef();
        
        // Draw time signature (4/4)
        this.drawTimeSignature();
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
        // Map notes to staff positions (treble clef)
        const notePositions = {
            // Octave 4
            'C4': this.staffStartY + (this.staffSpacing * 5), // Below staff
            'D4': this.staffStartY + (this.staffSpacing * 4.5),
            'E4': this.staffStartY + (this.staffSpacing * 4),
            'F4': this.staffStartY + (this.staffSpacing * 3.5),
            'G4': this.staffStartY + (this.staffSpacing * 3),
            'A4': this.staffStartY + (this.staffSpacing * 2.5),
            'B4': this.staffStartY + (this.staffSpacing * 2),
            
            // Octave 5
            'C5': this.staffStartY + (this.staffSpacing * 1.5),
            'D5': this.staffStartY + (this.staffSpacing * 1),
            'E5': this.staffStartY + (this.staffSpacing * 0.5),
            'F5': this.staffStartY,
            'G5': this.staffStartY - (this.staffSpacing * 0.5),
            'A5': this.staffStartY - (this.staffSpacing * 1),
            'B5': this.staffStartY - (this.staffSpacing * 1.5),
            
            // Octave 6
            'C6': this.staffStartY - (this.staffSpacing * 2),
            'D6': this.staffStartY - (this.staffSpacing * 2.5),
            'E6': this.staffStartY - (this.staffSpacing * 3),
        };
        
        // Handle sharps/flats by using the base note position
        let baseNote = noteInfo.note.replace('#', '').replace('b', '');
        
        return notePositions[baseNote] || this.staffStartY + (this.staffSpacing * 2.5);
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
        // Check if we need to start a new line
        if (this.currentX > this.staffStartX + this.staffWidth - 50) {
            this.currentX = this.staffStartX + 50;
        }
        
        this.drawNote(noteInfo);
    }
}