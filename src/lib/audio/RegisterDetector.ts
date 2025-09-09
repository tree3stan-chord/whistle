/**
 * Register Detection and Automatic Clef Switching
 * Intelligently detects vocal register changes and switches clefs accordingly
 */

import type { MusicalNote } from './NoteConverter.js';

interface ClefRange {
  optimal: { min: number; max: number };
  extended: { min: number; max: number };
  centerLine: number;
  name: string;
}

interface ClefRanges {
  treble: ClefRange;
  alto: ClefRange;  
  bass: ClefRange;
}

interface RegisterStats {
  count: number;
  totalDistance: number;
  avgDistance: number;
  confidence: number;
}

interface RecentNote {
  midi: number;
  frequency: number;
  timestamp: number;
  note: string;
}

export type ClefType = 'treble' | 'alto' | 'bass';

export class RegisterDetector {
  private clefRanges: ClefRanges;
  private recentNotes: RecentNote[];
  private analysisWindow: number;
  private clefChangeThreshold: number;
  private currentClef: ClefType;
  private lastClefChange: number;
  private minClefChangeInterval: number;
  private registerStats: Record<ClefType, RegisterStats>;

  constructor() {
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
        optimal: { min: 36, max: 59 },     // C2 to B3 (optimal range - below C4)
        extended: { min: 24, max: 72 },    // C1 to C5 (playable range)
        centerLine: 50,                    // D3 (middle line of bass staff)
        name: 'Bass Clef'
      }
    };

    // Analysis parameters
    this.recentNotes = [];              // Recent notes for analysis
    this.analysisWindow = 8;            // Larger window to require more evidence for clef changes
    this.clefChangeThreshold = 0.7;     // Confidence threshold for clef change
    this.currentClef = 'treble';         // Default clef
    this.lastClefChange = 0;            // Timestamp of last clef change
    this.minClefChangeInterval = 3000;  // Require 3 seconds between clef changes to prevent erratic switching

    // Register statistics
    this.registerStats = {
      treble: { count: 0, totalDistance: 0, avgDistance: 0, confidence: 0 },
      alto: { count: 0, totalDistance: 0, avgDistance: 0, confidence: 0 },
      bass: { count: 0, totalDistance: 0, avgDistance: 0, confidence: 0 }
    };

    console.log('RegisterDetector initialized with intelligent clef switching');
  }

  // Convert frequency to MIDI note number for easy comparison
  private frequencyToMIDI(frequency: number): number {
    return Math.round(69 + 12 * Math.log2(frequency / 440));
  }

  // Analyze a new note and potentially trigger clef change
  analyzeNote(note: MusicalNote): ClefType {
    if (!note.frequency || note.frequency < 80 || note.frequency > 2000) {
      return this.currentClef; // Skip invalid frequencies
    }

    const midiNote = this.frequencyToMIDI(note.frequency);

    // Add note to recent history
    this.recentNotes.push({
      midi: midiNote,
      frequency: note.frequency,
      timestamp: Date.now(),
      note: note.noteName
    });

    // Keep only recent notes
    if (this.recentNotes.length > this.analysisWindow) {
      this.recentNotes = this.recentNotes.slice(-this.analysisWindow);
    }

    // Only trigger bass clef for notes below A3 if we have sustained evidence
    if (midiNote <= 57 && this.currentClef !== 'bass') { // A3 = MIDI 57
      // Check if we have multiple recent notes in this low range
      const recentLowNotes = this.recentNotes.filter(n => n.midi <= 57);
      if (recentLowNotes.length >= 3) { // Require at least 3 low notes
        console.log(`Multiple notes below A3 detected, switching to bass clef`);
        return this.changeClef('bass');
      }
    }

    // Switch back to treble for notes significantly above A3
    if (midiNote >= 64 && this.currentClef !== 'treble') { // E4 = MIDI 64, higher threshold for switching back
      console.log(`Note ${note.noteName} (${midiNote}) is above E4, switching back to treble clef`);
      return this.changeClef('treble');
    }

    // Don't change clef too frequently for gradual changes
    if (Date.now() - this.lastClefChange < this.minClefChangeInterval) {
      return this.currentClef;
    }

    // Analyze if we should change clef gradually
    const bestClef = this.determineBestClef();

    if (bestClef !== this.currentClef) {
      console.log(`Register analysis suggests clef change: ${this.currentClef} → ${bestClef}`);
      return this.changeClef(bestClef);
    }

    return this.currentClef;
  }

  private determineBestClef(): ClefType {
    if (this.recentNotes.length < 5) {
      return this.currentClef; // Need more data for confident clef change
    }

    // Count notes below A3 vs above A3
    const notesBelow57 = this.recentNotes.filter(n => n.midi <= 57).length;
    const notesAbove57 = this.recentNotes.filter(n => n.midi > 57).length;
    
    // Only suggest bass clef if majority of recent notes are below A3
    if (notesBelow57 > notesAbove57 && notesBelow57 >= 4) {
      return 'bass';
    }
    
    // Only suggest treble clef if majority are above A3
    if (notesAbove57 > notesBelow57 && notesAbove57 >= 4) {
      return 'treble';
    }
    
    // If unclear, stick with current clef
    return this.currentClef;
  }

  private changeClef(newClef: ClefType): ClefType {
    if (newClef === this.currentClef) return this.currentClef;

    console.log(`Changing clef from ${this.clefRanges[this.currentClef].name} to ${this.clefRanges[newClef].name}`);

    // Update internal state
    this.currentClef = newClef;
    this.lastClefChange = Date.now();

    return this.currentClef;
  }

  // Manual clef setting (from staff configuration)
  setClef(clef: ClefType): void {
    if (this.clefRanges[clef]) {
      this.currentClef = clef;
      this.lastClefChange = Date.now();

      // Clear recent notes to prevent immediate auto-switching
      this.recentNotes = [];

      console.log(`Manual clef set to: ${this.clefRanges[clef].name}`);
    }
  }

  // Get current clef info
  getCurrentClef(): { type: ClefType; name: string; range: ClefRange } {
    return {
      type: this.currentClef,
      name: this.clefRanges[this.currentClef].name,
      range: this.clefRanges[this.currentClef]
    };
  }

  // Suggest optimal clef for a given frequency range
  suggestClefForRange(minFreq: number, maxFreq: number): ClefType {
    const minMIDI = this.frequencyToMIDI(minFreq);
    const maxMIDI = this.frequencyToMIDI(maxFreq);
    const avgMIDI = (minMIDI + maxMIDI) / 2;

    let bestClef: ClefType = 'treble';
    let bestScore = -1;

    Object.keys(this.clefRanges).forEach(clefKey => {
      const clef = clefKey as ClefType;
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
  getAnalysisInfo(): {
    currentClef: { type: ClefType; name: string; range: ClefRange };
    recentNotesCount: number;
    registerStats: Record<ClefType, RegisterStats>;
    lastClefChange: number;
    recentRange: { min: number; max: number } | null;
  } {
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
  reset(): void {
    this.recentNotes = [];
    this.currentClef = 'treble';
    this.lastClefChange = 0;
    console.log('RegisterDetector reset to default state');
  }
}