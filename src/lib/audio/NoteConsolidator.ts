/**
 * Smart note consolidation that groups rapid pitch detections into sustained notes
 */

import type { MusicalNote } from './NoteConverter.js';

interface ConsolidationConfig {
  // Minimum time to consider notes as "same" (milliseconds)
  pitchTolerance: number;
  // Time window to look for similar pitches (milliseconds) 
  consolidationWindow: number;
  // Minimum duration to create a note (milliseconds)
  minNoteDuration: number;
  // Maximum time gap between detections before ending a note (milliseconds)
  maxGapDuration: number;
}

interface ActiveNote {
  note: MusicalNote;
  startTime: number;
  lastUpdateTime: number;
  detectionCount: number;
}

export class NoteConsolidator {
  private config: ConsolidationConfig;
  private activeNote: ActiveNote | null = null;
  private consolidatedNotes: MusicalNote[] = [];

  constructor(config: Partial<ConsolidationConfig> = {}) {
    this.config = {
      pitchTolerance: 20, // Hz - notes within 20Hz considered same (vocal-friendly)
      consolidationWindow: 150, // 150ms window  
      minNoteDuration: 500, // 500ms minimum note duration (favor longer notes)
      maxGapDuration: 300, // 300ms max gap before ending note (allow brief variations)
      ...config
    };
  }

  /**
   * Process a new pitch detection and return consolidated notes if any are ready
   */
  processPitchDetection(note: MusicalNote, timestamp: number = Date.now()): MusicalNote[] {
    const newNotes: MusicalNote[] = [];

    // Check if we should end the current active note
    if (this.activeNote) {
      const timeSinceLastUpdate = timestamp - this.activeNote.lastUpdateTime;
      const isSamePitch = this.isSimilarPitch(note, this.activeNote.note);

      // End active note if:
      // 1. Too much time has passed (silence)
      // 2. Pitch changed significantly
      if (timeSinceLastUpdate > this.config.maxGapDuration || !isSamePitch) {
        const finishedNote = this.finalizeActiveNote(timestamp);
        if (finishedNote) {
          newNotes.push(finishedNote);
        }
      }
    }

    // Start new active note or extend current one
    if (this.activeNote && this.isSimilarPitch(note, this.activeNote.note)) {
      // Extend current note
      this.activeNote.lastUpdateTime = timestamp;
      this.activeNote.detectionCount++;
      
      // Update note properties with weighted average
      this.updateActiveNoteProperties(note);
    } else {
      // Start new note
      this.activeNote = {
        note: { ...note },
        startTime: timestamp,
        lastUpdateTime: timestamp,
        detectionCount: 1
      };
    }

    return newNotes;
  }

  /**
   * Force finalization of any active note (call when recording stops)
   */
  finalize(timestamp: number = Date.now()): MusicalNote[] {
    const newNotes: MusicalNote[] = [];
    
    if (this.activeNote) {
      const finishedNote = this.finalizeActiveNote(timestamp);
      if (finishedNote) {
        newNotes.push(finishedNote);
      }
    }

    return newNotes;
  }

  /**
   * Clear all state
   */
  reset(): void {
    this.activeNote = null;
    this.consolidatedNotes = [];
  }

  /**
   * Get all consolidated notes
   */
  getAllNotes(): MusicalNote[] {
    return [...this.consolidatedNotes];
  }

  private isSimilarPitch(note1: MusicalNote, note2: MusicalNote): boolean {
    return Math.abs(note1.frequency - note2.frequency) <= this.config.pitchTolerance;
  }

  private updateActiveNoteProperties(newNote: MusicalNote): void {
    if (!this.activeNote) return;

    const weight = 1 / this.activeNote.detectionCount;
    const currentWeight = 1 - weight;

    // Weighted average of frequency and confidence
    this.activeNote.note.frequency = 
      (this.activeNote.note.frequency * currentWeight) + (newNote.frequency * weight);
    
    this.activeNote.note.confidence = 
      (this.activeNote.note.confidence * currentWeight) + (newNote.confidence * weight);

    // Keep the most common note name (could be improved with weighted mode)
    if (newNote.confidence > this.activeNote.note.confidence) {
      this.activeNote.note.noteName = newNote.noteName;
      this.activeNote.note.octave = newNote.octave;
      this.activeNote.note.staffPosition = newNote.staffPosition;
    }
  }

  private finalizeActiveNote(currentTime: number): MusicalNote | null {
    if (!this.activeNote) return null;

    const duration = currentTime - this.activeNote.startTime;

    // Only create note if it meets minimum duration
    if (duration < this.config.minNoteDuration) {
      this.activeNote = null;
      return null;
    }

    // Create consolidated note with duration
    const consolidatedNote: MusicalNote = {
      ...this.activeNote.note,
      timestamp: this.activeNote.startTime,
      duration: duration,
      // Determine note value based on duration
      noteValue: this.calculateNoteValue(duration)
    };

    this.consolidatedNotes.push(consolidatedNote);
    this.activeNote = null;

    return consolidatedNote;
  }

  private calculateNoteValue(duration: number): string {
    // Convert duration to note values - more realistic for vocal performances
    // Vocal notes tend to be longer than instrumental notes
    if (duration >= 3000) return 'whole';        // 3+ seconds = whole note (long sustained)
    if (duration >= 1500) return 'half';         // 1.5+ seconds = half note (medium sustained)
    if (duration >= 800) return 'quarter';       // 0.8+ seconds = quarter note (normal singing)
    if (duration >= 400) return 'eighth';        // 0.4+ seconds = eighth note (quick notes)
    return 'quarter';                            // Default to quarter note (avoid sixteenths for vocals)
  }
}