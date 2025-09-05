class RegisterDetector {
    constructor(notationRenderer) {
        this.notationRenderer = notationRenderer;
        
        // Clef ranges (MIDI note numbers for easy comparison)
        this.clefRanges = {
            treble: {
                optimal: { min: 60, max: 84 },     // C4 to C6 (optimal range)
                extended: { min: 48, max: 96 },    // C3 to C7 (playable range)
                centerLine: 71,                    // B4 (middle line of treble staff)
                name: 'Treble Clef'
            },
            alto: {
                optimal: { min: 48, max: 72 },     // C3 to C5 (optimal range)  
                extended: { min: 36, max: 84 },    // C2 to C6 (playable range)
                centerLine: 60,                    // C4 (middle line of alto staff)
                name: 'Alto Clef'
            },
            bass: {
                optimal: { min: 36, max: 60 },     // C2 to C4 (optimal range)
                extended: { min: 24, max: 72 },    // C1 to C5 (playable range)
                centerLine: 50,                    // D3 (middle line of bass staff)
                name: 'Bass Clef'
            }
        };
        
        // Analysis parameters
        this.recentNotes = [];              // Recent notes for analysis
        this.analysisWindow = 10;           // Number of recent notes to analyze
        this.clefChangeThreshold = 0.7;     // Confidence threshold for clef change
        this.currentClef = 'treble';        // Default clef
        this.lastClefChange = 0;            // Timestamp of last clef change
        this.minClefChangeInterval = 3000;  // Minimum time between clef changes (ms)
        
        // Register statistics
        this.registerStats = {
            treble: { count: 0, totalDistance: 0, avgDistance: 0, confidence: 0 },
            alto: { count: 0, totalDistance: 0, avgDistance: 0, confidence: 0 },
            bass: { count: 0, totalDistance: 0, avgDistance: 0, confidence: 0 }
        };
        
        console.log('RegisterDetector initialized with intelligent clef switching');
    }
    
    // Convert frequency to MIDI note number for easy comparison
    frequencyToMIDI(frequency) {
        return Math.round(69 + 12 * Math.log2(frequency / 440));
    }
    
    // Analyze a new note and potentially trigger clef change
    analyzeNote(noteInfo) {
        if (!noteInfo.frequency || noteInfo.frequency < 80 || noteInfo.frequency > 2000) {
            return this.currentClef; // Skip invalid frequencies
        }
        
        const midiNote = this.frequencyToMIDI(noteInfo.frequency);
        
        // Add note to recent history
        this.recentNotes.push({
            midi: midiNote,
            frequency: noteInfo.frequency,
            timestamp: Date.now(),
            note: noteInfo.note
        });
        
        // Keep only recent notes
        if (this.recentNotes.length > this.analysisWindow) {
            this.recentNotes = this.recentNotes.slice(-this.analysisWindow);
        }
        
        // Don't change clef too frequently
        if (Date.now() - this.lastClefChange < this.minClefChangeInterval) {
            return this.currentClef;
        }
        
        // Analyze if we should change clef
        const bestClef = this.determineBestClef();
        
        if (bestClef !== this.currentClef) {
            console.log(`Register analysis suggests clef change: ${this.currentClef} → ${bestClef}`);
            return this.changeClef(bestClef);
        }
        
        return this.currentClef;
    }
    
    determineBestClef() {
        if (this.recentNotes.length < 3) {
            return this.currentClef; // Need more data
        }
        
        // Reset statistics
        Object.keys(this.registerStats).forEach(clef => {
            this.registerStats[clef] = { count: 0, totalDistance: 0, avgDistance: 0, confidence: 0 };
        });
        
        // Analyze each note against each clef
        this.recentNotes.forEach(note => {
            Object.keys(this.clefRanges).forEach(clef => {
                const range = this.clefRanges[clef];
                const stats = this.registerStats[clef];
                
                // Calculate distance from optimal center
                const distance = Math.abs(note.midi - range.centerLine);
                stats.totalDistance += distance;
                stats.count++;
                
                // Bonus points for being in optimal range
                if (note.midi >= range.optimal.min && note.midi <= range.optimal.max) {
                    stats.count += 2; // Weight optimal range notes more heavily
                }
            });
        });
        
        // Calculate average distances and confidence scores
        let bestClef = this.currentClef;
        let bestScore = -1;
        
        Object.keys(this.registerStats).forEach(clef => {
            const stats = this.registerStats[clef];
            if (stats.count > 0) {
                stats.avgDistance = stats.totalDistance / stats.count;
                
                // Calculate confidence (lower distance = higher confidence)
                // Scale: 0-20 semitones distance → 1.0-0.0 confidence
                stats.confidence = Math.max(0, 1.0 - (stats.avgDistance / 20));
                
                // Bias toward current clef to avoid unnecessary changes
                let score = stats.confidence;
                if (clef === this.currentClef) {
                    score *= 1.2; // 20% bonus for current clef
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    bestClef = clef;
                }
            }
        });
        
        // Only change if confidence is significantly higher
        const currentScore = this.registerStats[this.currentClef].confidence * 1.2;
        const newScore = this.registerStats[bestClef].confidence;
        
        if (bestClef !== this.currentClef && newScore > currentScore + 0.2) {
            return bestClef;
        }
        
        return this.currentClef;
    }
    
    changeClef(newClef) {
        if (newClef === this.currentClef) return this.currentClef;
        
        console.log(`Changing clef from ${this.clefRanges[this.currentClef].name} to ${this.clefRanges[newClef].name}`);
        
        // Update notation renderer
        this.notationRenderer.changeClef(newClef);
        
        // Update internal state
        this.currentClef = newClef;
        this.lastClefChange = Date.now();
        
        // Log the change for user awareness
        this.notifyClefChange(newClef);
        
        return this.currentClef;
    }
    
    notifyClefChange(newClef) {
        // Create a subtle notification for the user
        const statusText = document.getElementById('statusText');
        if (statusText) {
            const originalText = statusText.textContent;
            const originalColor = statusText.style.color;
            
            statusText.textContent = `Switched to ${this.clefRanges[newClef].name} for better note placement`;
            statusText.style.color = '#4a9eff';
            
            setTimeout(() => {
                statusText.textContent = originalText;
                statusText.style.color = originalColor;
            }, 3000);
        }
    }
    
    // Manual clef setting (from staff configuration)
    setClef(clef) {
        if (this.clefRanges[clef]) {
            this.currentClef = clef;
            this.lastClefChange = Date.now();
            
            // Clear recent notes to prevent immediate auto-switching
            this.recentNotes = [];
            
            console.log(`Manual clef set to: ${this.clefRanges[clef].name}`);
        }
    }
    
    // Get current clef info
    getCurrentClef() {
        return {
            type: this.currentClef,
            name: this.clefRanges[this.currentClef].name,
            range: this.clefRanges[this.currentClef]
        };
    }
    
    // Suggest optimal clef for a given frequency range
    suggestClefForRange(minFreq, maxFreq) {
        const minMIDI = this.frequencyToMIDI(minFreq);
        const maxMIDI = this.frequencyToMIDI(maxFreq);
        const avgMIDI = (minMIDI + maxMIDI) / 2;
        
        let bestClef = 'treble';
        let bestScore = -1;
        
        Object.keys(this.clefRanges).forEach(clef => {
            const range = this.clefRanges[clef];
            
            // Check how well this range fits in the clef
            const optimalOverlap = Math.max(0, 
                Math.min(maxMIDI, range.optimal.max) - Math.max(minMIDI, range.optimal.min)
            );
            
            const extendedOverlap = Math.max(0,
                Math.min(maxMIDI, range.extended.max) - Math.max(minMIDI, range.extended.min)
            );
            
            // Score based on overlap and center proximity
            const centerDistance = Math.abs(avgMIDI - range.centerLine);
            const score = (optimalOverlap * 2 + extendedOverlap) - centerDistance * 0.1;
            
            if (score > bestScore) {
                bestScore = score;
                bestClef = clef;
            }
        });
        
        return bestClef;
    }
    
    // Get diagnostic information
    getAnalysisInfo() {
        return {
            currentClef: this.getCurrentClef(),
            recentNotesCount: this.recentNotes.length,
            registerStats: { ...this.registerStats },
            lastClefChange: this.lastClefChange,
            recentRange: this.recentNotes.length > 0 ? {
                min: Math.min(...this.recentNotes.map(n => n.midi)),
                max: Math.max(...this.recentNotes.map(n => n.midi))
            } : null
        };
    }
    
    // Reset the detector (useful when clearing notation)
    reset() {
        this.recentNotes = [];
        this.currentClef = 'treble';
        this.lastClefChange = 0;
        console.log('RegisterDetector reset to default state');
    }
}