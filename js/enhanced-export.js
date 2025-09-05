class EnhancedExport {
    constructor(notationRenderer, staffConfig, vocalTranscriptionEngine = null, articulationIntegration = null) {
        this.notationRenderer = notationRenderer;
        this.staffConfig = staffConfig;
        this.vocalTranscriptionEngine = vocalTranscriptionEngine;
        this.articulationIntegration = articulationIntegration;
        
        // Initialize Phase 6 Professional Exporter
        this.professionalExporter = new EnhancedProfessionalExporter(
            notationRenderer,
            vocalTranscriptionEngine,
            articulationIntegration
        );
        
        console.log('🚀 Enhanced Export initialized with Phase 6 Professional Export capabilities');
    }
    
    // Export to MIDI format
    exportMIDI() {
        const notes = this.notationRenderer.getNotes();
        if (!notes || notes.length === 0) {
            throw new Error('No notes to export');
        }
        
        const config = this.staffConfig.getConfiguration();
        const midi = this.createMIDIFile(notes, config);
        
        const blob = new Blob([midi], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `whistle-${this.getTimestamp()}.mid`;
        link.click();
        
        URL.revokeObjectURL(url);
        console.log('MIDI export completed');
    }
    
    createMIDIFile(notes, config) {
        // MIDI file structure (simplified implementation)
        const ticksPerQuarter = 480; // Standard resolution
        const tempo = config.tempo || 120;
        const timeSignature = config.timeSignature || { numerator: 4, denominator: 4 };
        
        // Convert notes to MIDI events
        const events = [];
        let currentTick = 0;
        
        // Add header events
        events.push({
            type: 'timeSignature',
            tick: 0,
            numerator: timeSignature.numerator,
            denominator: timeSignature.denominator,
            metronome: 24,
            thirty2nds: 8
        });
        
        events.push({
            type: 'setTempo',
            tick: 0,
            microsecondsPerBeat: Math.round(60000000 / tempo)
        });
        
        // Add key signature
        const keyInfo = this.getKeySignatureForMIDI(config.keySignature);
        events.push({
            type: 'keySignature',
            tick: 0,
            key: keyInfo.key,
            scale: keyInfo.scale
        });
        
        // Convert notes to MIDI note events
        notes.forEach((note, index) => {
            const midiNote = this.noteToMIDI(note.note, note.octave);
            const startTick = Math.round((note.timestamp / 1000) * (tempo / 60) * ticksPerQuarter);
            const duration = Math.round((note.duration / 1000) * (tempo / 60) * ticksPerQuarter) || ticksPerQuarter / 4;
            const velocity = Math.round((note.amplitude || 0.7) * 127);
            
            // Note on event
            events.push({
                type: 'noteOn',
                tick: startTick,
                channel: 0,
                note: midiNote,
                velocity: velocity
            });
            
            // Note off event
            events.push({
                type: 'noteOff',
                tick: startTick + duration,
                channel: 0,
                note: midiNote,
                velocity: 0
            });
        });
        
        // Sort events by tick
        events.sort((a, b) => a.tick - b.tick);
        
        // Generate MIDI binary data
        return this.generateMIDIBinary(events, ticksPerQuarter);
    }
    
    generateMIDIBinary(events, ticksPerQuarter) {
        // MIDI header chunk
        const header = new Uint8Array([
            0x4D, 0x54, 0x68, 0x64, // "MThd"
            0x00, 0x00, 0x00, 0x06, // Header length (6 bytes)
            0x00, 0x00, // Format 0 (single track)
            0x00, 0x01, // Number of tracks (1)
            (ticksPerQuarter >> 8) & 0xFF, ticksPerQuarter & 0xFF // Ticks per quarter note
        ]);
        
        // Generate track data
        const trackData = this.generateTrackData(events);
        
        // Track header
        const trackHeader = new Uint8Array([
            0x4D, 0x54, 0x72, 0x6B, // "MTrk"
            (trackData.length >> 24) & 0xFF,
            (trackData.length >> 16) & 0xFF,
            (trackData.length >> 8) & 0xFF,
            trackData.length & 0xFF
        ]);
        
        // Combine header and track
        const midiFile = new Uint8Array(header.length + trackHeader.length + trackData.length);
        midiFile.set(header, 0);
        midiFile.set(trackHeader, header.length);
        midiFile.set(trackData, header.length + trackHeader.length);
        
        return midiFile;
    }
    
    generateTrackData(events) {
        const data = [];
        let lastTick = 0;
        
        events.forEach(event => {
            const deltaTime = event.tick - lastTick;
            lastTick = event.tick;
            
            // Add variable-length quantity for delta time
            data.push(...this.encodeVariableLengthQuantity(deltaTime));
            
            switch (event.type) {
                case 'noteOn':
                    data.push(0x90 | event.channel, event.note, event.velocity);
                    break;
                case 'noteOff':
                    data.push(0x80 | event.channel, event.note, event.velocity);
                    break;
                case 'setTempo':
                    data.push(0xFF, 0x51, 0x03);
                    data.push(
                        (event.microsecondsPerBeat >> 16) & 0xFF,
                        (event.microsecondsPerBeat >> 8) & 0xFF,
                        event.microsecondsPerBeat & 0xFF
                    );
                    break;
                case 'timeSignature':
                    data.push(0xFF, 0x58, 0x04);
                    data.push(event.numerator, Math.log2(event.denominator), event.metronome, event.thirty2nds);
                    break;
                case 'keySignature':
                    data.push(0xFF, 0x59, 0x02);
                    data.push(event.key, event.scale);
                    break;
            }
        });
        
        // End of track
        data.push(0x00, 0xFF, 0x2F, 0x00);
        
        return new Uint8Array(data);
    }
    
    encodeVariableLengthQuantity(value) {
        const result = [];
        let temp = value & 0x7F;
        
        while (value >>= 7) {
            temp <<= 8;
            temp |= (value & 0x7F) | 0x80;
        }
        
        while (true) {
            result.push(temp & 0xFF);
            if (temp & 0x80) {
                temp >>= 8;
            } else {
                break;
            }
        }
        
        return result;
    }
    
    noteToMIDI(noteName, octave) {
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        const baseNote = noteName.replace(/\d+/, '');
        const semitone = noteMap[baseNote] || 0;
        return (octave + 1) * 12 + semitone;
    }
    
    getKeySignatureForMIDI(keySignature) {
        const keyMap = {
            'C': { key: 0, scale: 0 },   // C major
            'G': { key: 1, scale: 0 },   // G major (1 sharp)
            'D': { key: 2, scale: 0 },   // D major (2 sharps)
            'A': { key: 3, scale: 0 },   // A major (3 sharps)
            'E': { key: 4, scale: 0 },   // E major (4 sharps)
            'B': { key: 5, scale: 0 },   // B major (5 sharps)
            'F#': { key: 6, scale: 0 },  // F# major (6 sharps)
            'C#': { key: 7, scale: 0 },  // C# major (7 sharps)
            'F': { key: -1, scale: 0 },  // F major (1 flat)
            'Bb': { key: -2, scale: 0 }, // Bb major (2 flats)
            'Eb': { key: -3, scale: 0 }, // Eb major (3 flats)
            'Ab': { key: -4, scale: 0 }, // Ab major (4 flats)
            'Db': { key: -5, scale: 0 }, // Db major (5 flats)
            'Gb': { key: -6, scale: 0 }, // Gb major (6 flats)
            'Cb': { key: -7, scale: 0 }  // Cb major (7 flats)
        };
        
        return keyMap[keySignature] || { key: 0, scale: 0 };
    }
    
    // Export to MusicXML format
    exportMusicXML() {
        const notes = this.notationRenderer.getNotes();
        if (!notes || notes.length === 0) {
            throw new Error('No notes to export');
        }
        
        const config = this.staffConfig.getConfiguration();
        const musicXML = this.createMusicXMLFile(notes, config);
        
        const blob = new Blob([musicXML], { type: 'application/vnd.recordare.musicxml+xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `whistle-${this.getTimestamp()}.musicxml`;
        link.click();
        
        URL.revokeObjectURL(url);
        console.log('MusicXML export completed');
    }
    
    createMusicXMLFile(notes, config) {
        const timeSignature = config.timeSignature || { numerator: 4, denominator: 4 };
        const keySignature = config.keySignature || 'C';
        const tempo = config.tempo || 120;
        const clef = config.clef || 'treble';
        
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>Whistle Recording</work-title>
  </work>
  <identification>
    <creator type="software">Whistle - Real-time Pitch to Staff Notation</creator>
    <encoding>
      <software>Whistle ${this.getTimestamp()}</software>
      <encoding-date>${new Date().toISOString().split('T')[0]}</encoding-date>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Melody</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key>
          <fifths>${this.getKeySignatureFifths(keySignature)}</fifths>
        </key>
        <time>
          <beats>${timeSignature.numerator}</beats>
          <beat-type>${timeSignature.denominator}</beat-type>
        </time>
        <clef>
          <sign>${clef.charAt(0).toUpperCase()}</sign>
          <line>${this.getClefLine(clef)}</line>
        </clef>
      </attributes>
      <sound tempo="${tempo}"/>
${this.generateMusicXMLNotes(notes, timeSignature)}
    </measure>
  </part>
</score-partwise>`;
        
        return xml;
    }
    
    generateMusicXMLNotes(notes, timeSignature) {
        let xml = '';
        const divisionsPerQuarter = 480;
        
        notes.forEach((note, index) => {
            const { step, alter, octave } = this.parseNoteForMusicXML(note.note, note.octave);
            const duration = Math.round((note.duration / 1000) * divisionsPerQuarter) || (divisionsPerQuarter / 4);
            
            xml += `      <note>
        <pitch>
          <step>${step}</step>
${alter !== 0 ? `          <alter>${alter}</alter>` : ''}
          <octave>${octave}</octave>
        </pitch>
        <duration>${duration}</duration>
        <type>quarter</type>
      </note>
`;
        });
        
        return xml;
    }
    
    parseNoteForMusicXML(noteName, octave) {
        const baseNote = noteName.replace(/\d+/, '');
        let step = baseNote.charAt(0);
        let alter = 0;
        
        if (baseNote.includes('#')) {
            alter = 1;
        } else if (baseNote.includes('b')) {
            alter = -1;
        }
        
        return { step, alter, octave };
    }
    
    getKeySignatureFifths(keySignature) {
        const fifthsMap = {
            'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
            'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7
        };
        return fifthsMap[keySignature] || 0;
    }
    
    getClefLine(clef) {
        const clefLines = { 'treble': 2, 'bass': 4, 'alto': 3 };
        return clefLines[clef] || 2;
    }
    
    // Export to SVG format
    exportSVG() {
        const canvas = this.notationRenderer.canvas;
        const svg = this.canvasToSVG(canvas);
        
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `whistle-${this.getTimestamp()}.svg`;
        link.click();
        
        URL.revokeObjectURL(url);
        console.log('SVG export completed');
    }
    
    canvasToSVG(canvas) {
        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, width, height);
        
        // Convert canvas to SVG (simplified - in practice would need more sophisticated conversion)
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="100%" height="100%" fill="white"/>
  <image x="0" y="0" width="${width}" height="${height}" xlink:href="${canvas.toDataURL()}" />
  <text x="10" y="${height - 10}" font-family="Arial, sans-serif" font-size="12" fill="gray">
    Generated by Whistle - ${new Date().toLocaleString()}
  </text>
</svg>`;
        
        return svg;
    }
    
    // Export to PDF format
    async exportPDF() {
        // For PDF export, we'll use a canvas-to-PDF approach
        // In a real implementation, you might want to use a library like jsPDF
        const canvas = this.notationRenderer.canvas;
        const imgData = canvas.toDataURL('image/png');
        
        // Simple PDF generation (would typically use jsPDF or similar)
        const pdf = this.generateSimplePDF(imgData, canvas.width, canvas.height);
        
        const blob = new Blob([pdf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `whistle-${this.getTimestamp()}.pdf`;
        link.click();
        
        URL.revokeObjectURL(url);
        console.log('PDF export completed');
    }
    
    generateSimplePDF(imageData, width, height) {
        // This is a very basic PDF structure - in production you'd use a proper PDF library
        const pdfHeader = '%PDF-1.4\n';
        const pageWidth = 612; // 8.5 inches * 72 points
        const pageHeight = 792; // 11 inches * 72 points
        
        // Scale image to fit page
        const scale = Math.min(pageWidth / width, pageHeight / height) * 0.9;
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const x = (pageWidth - scaledWidth) / 2;
        const y = (pageHeight - scaledHeight) / 2;
        
        const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R >>
endobj

4 0 obj
<< /Length 44 >>
stream
q
${scaledWidth} 0 0 ${scaledHeight} ${x} ${y} cm
/Im1 Do
Q
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000217 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
315
%%EOF`;
        
        return new TextEncoder().encode(pdf);
    }
    
    // Utility function to generate timestamp
    getTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }
    
    // Enhanced JSON export with more metadata
    exportEnhancedJSON() {
        const notes = this.notationRenderer.getNotes();
        const config = this.staffConfig.getConfiguration();
        
        const data = {
            metadata: {
                title: 'Whistle Recording',
                created: new Date().toISOString(),
                software: 'Whistle - Real-time Pitch to Staff Notation',
                version: '1.0'
            },
            configuration: {
                ...config,
                keySignatureInfo: this.staffConfig.getKeySignatureInfo(),
                timeSignatureInfo: this.staffConfig.getTimeSignatureInfo()
            },
            notes: notes.map(note => ({
                ...note,
                midiNote: this.noteToMIDI(note.note, note.octave),
                cents: note.cents || 0,
                confidence: note.confidence || 1.0
            })),
            statistics: {
                totalNotes: notes.length,
                duration: notes.length > 0 ? 
                    Math.max(...notes.map(n => n.timestamp + (n.duration || 0))) - 
                    Math.min(...notes.map(n => n.timestamp)) : 0,
                pitchRange: this.calculatePitchRange(notes),
                averageNoteLength: notes.length > 0 ? 
                    notes.reduce((sum, note) => sum + (note.duration || 0), 0) / notes.length : 0
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `whistle-${this.getTimestamp()}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        console.log('Enhanced JSON export completed');
    }
    
    calculatePitchRange(notes) {
        if (notes.length === 0) return { lowest: null, highest: null, span: 0 };
        
        const frequencies = notes.map(note => note.frequency).filter(f => f > 0);
        if (frequencies.length === 0) return { lowest: null, highest: null, span: 0 };
        
        const lowest = Math.min(...frequencies);
        const highest = Math.max(...frequencies);
        const span = Math.log2(highest / lowest) * 12; // Span in semitones
        
        return {
            lowest: lowest,
            highest: highest,
            span: Math.round(span * 100) / 100
        };
    }
    
    // Phase 6 Professional Export - All formats with vocal-specific features
    async exportAll() {
        try {
            console.log('🚀 Starting Phase 6 Professional Export...');
            
            // Use professional export system if available
            if (this.professionalExporter) {
                const exportPackage = await this.professionalExporter.exportAll({
                    title: 'Vocal Transcription',
                    composer: 'Transcribed with Whistle',
                    copyright: `© ${new Date().getFullYear()}`,
                    includeVocalFeatures: true,
                    professionalLayout: true
                });
                
                console.log('🎉 Professional export package created:', exportPackage);
                return exportPackage;
            } else {
                // Fallback to legacy export
                this.exportEnhancedJSON();
                setTimeout(() => this.exportMIDI(), 500);
                setTimeout(() => this.exportMusicXML(), 1000);
                setTimeout(() => this.exportSVG(), 1500);
                setTimeout(() => this.exportPDF(), 2000);
                
                console.log('Batch export initiated for all formats (legacy mode)');
            }
        } catch (error) {
            console.error('Professional export failed:', error);
            throw error;
        }
    }
    
    // Individual professional export methods
    async exportProfessionalMusicXML() {
        if (!this.professionalExporter) return this.exportMusicXML();
        
        const result = await this.professionalExporter.exportToMusicXML(
            this.professionalExporter.prepareVocalScoreData({
                title: 'Vocal Transcription - MusicXML',
                includeVocalFeatures: true
            })
        );
        
        console.log('🎼 Professional MusicXML exported:', result.filename);
        return result;
    }
    
    async exportProfessionalLilyPond() {
        if (!this.professionalExporter) {
            console.warn('LilyPond export requires Phase 6 Professional Exporter');
            return null;
        }
        
        const result = await this.professionalExporter.exportToLilyPond(
            this.professionalExporter.prepareVocalScoreData({
                title: 'Vocal Transcription - LilyPond',
                includeVocalFeatures: true,
                professionalLayout: true
            })
        );
        
        console.log('🎵 Professional LilyPond exported:', result.filename);
        return result;
    }
    
    async exportProfessionalMIDI() {
        if (!this.professionalExporter) return this.exportMIDI();
        
        const result = await this.professionalExporter.exportToMIDI(
            this.professionalExporter.prepareVocalScoreData({
                title: 'Vocal Transcription - Enhanced MIDI',
                includeExtendedCC: true,
                vocalArticulations: true
            })
        );
        
        console.log('🎹 Professional Enhanced MIDI exported:', result.filename);
        return result;
    }
    
    // Batch export all formats (legacy method maintained for compatibility)
    exportAllLegacy() {
        try {
            this.exportEnhancedJSON();
            setTimeout(() => this.exportMIDI(), 500);
            setTimeout(() => this.exportMusicXML(), 1000);
            setTimeout(() => this.exportSVG(), 1500);
            setTimeout(() => this.exportPDF(), 2000);
            
            console.log('Legacy batch export initiated for all formats');
        } catch (error) {
            console.error('Legacy batch export failed:', error);
            throw error;
        }
    }
}