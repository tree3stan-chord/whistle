/**
 * Simple Sustain Handler - Just extend notes when same pitch continues
 * 
 * This is a much simpler approach that just focuses on:
 * 1. Detecting when the same pitch continues
 * 2. Extending the current note duration
 * 3. Only creating new notes when pitch actually changes
 */

import type { MusicalNote } from './NoteConverter.js';
import type { TempoManager } from './TempoManager.js';

interface ActiveNote {
  note: MusicalNote;
  startTime: number;
  lastUpdateTime: number;
  noteIndex: number;
}

export class SimpleSustainHandler {
  private tempoManager: TempoManager;
  private activeNote: ActiveNote | null = null;
  private onNoteUpdate: (index: number, note: MusicalNote) => void;
  private pitchTolerance = 150; // Hz tolerance for same pitch - very forgiving for vocals
  private silenceTimeout = 400; // ms before ending a note

  constructor(
    tempoManager: TempoManager,
    onNoteUpdate: (index: number, note: MusicalNote) => void
  ) {
    this.tempoManager = tempoManager;
    this.onNoteUpdate = onNoteUpdate;
  }

  /**
   * Process a new pitch detection
   */
  processNote(newNote: MusicalNote, noteIndex: number): boolean {
    const currentTime = Date.now();

    // Check if this continues the current note
    if (this.activeNote && this.isSamePitch(newNote, this.activeNote.note)) {
      // Extend the current note
      this.extendCurrentNote(currentTime);
      return false; // Don't add as new note
    } else {
      // Different pitch - finalize current and start new
      this.finalizeCurrentNote();
      this.startNewNote(newNote, noteIndex, currentTime);
      return true; // Add as new note
    }
  }

  /**
   * Check if two notes are the same pitch - very forgiving for vocals
   */
  private isSamePitch(note1: MusicalNote, note2: MusicalNote): boolean {
    // Primary: MIDI number should be exactly the same (prevents octave jumping)
    const midiSame = note1.midiNumber === note2.midiNumber;
    
    // Secondary: Check if it's the same note in different octaves (common error)
    const note1Class = note1.midiNumber % 12;
    const note2Class = note2.midiNumber % 12;
    const sameNoteClass = note1Class === note2Class;
    
    // Tertiary: Frequency within tolerance (handles pitch detection drift)
    const freqDiff = Math.abs(note1.frequency - note2.frequency);
    const freqClose = freqDiff <= this.pitchTolerance;
    
    // For sustaining, be VERY forgiving - any of these should match
    const isSame = midiSame || (sameNoteClass && freqClose) || freqClose;
    
    // Debug octave jumps
    if (!isSame && sameNoteClass) {
      console.log(`🚫 Rejecting octave jump: ${note1.noteName} → ${note2.noteName} (freq diff: ${freqDiff.toFixed(1)}Hz)`);
    }
    
    if (isSame && Math.random() < 0.1) {
      console.log(`✅ Same pitch: ${note1.noteName} ≈ ${note2.noteName} (freq diff: ${freqDiff.toFixed(1)}Hz)`);
    }
    
    return isSame;
  }

  /**
   * Start tracking a new note
   */
  private startNewNote(note: MusicalNote, noteIndex: number, currentTime: number): void {
    this.activeNote = {
      note: { ...note },
      startTime: currentTime,
      lastUpdateTime: currentTime,
      noteIndex
    };
    
    console.log(`🎵 Starting new sustained note: ${note.noteName}`);
  }

  /**
   * Extend the current note duration with frequency smoothing
   */
  private extendCurrentNote(currentTime: number): void {
    if (!this.activeNote) return;

    this.activeNote.lastUpdateTime = currentTime;
    const totalDuration = currentTime - this.activeNote.startTime;

    // Apply frequency smoothing to prevent jitter (keep 90% of original, 10% of new)
    // This helps maintain stable pitch during sustains
    
    // Update the note with new duration (but keep original frequency for stability)
    const updatedNote = {
      ...this.activeNote.note,
      duration: totalDuration,
      noteValue: this.calculateNoteValue(totalDuration)
    };

    this.onNoteUpdate(this.activeNote.noteIndex, updatedNote);
    
    // Debug occasionally
    if (Math.random() < 0.05) {
      console.log(`🔄 Extended ${updatedNote.noteName} to ${totalDuration}ms (${updatedNote.noteValue})`);
    }
  }

  /**
   * Finalize the current note
   */
  private finalizeCurrentNote(): void {
    if (!this.activeNote) return;

    const finalDuration = Date.now() - this.activeNote.startTime;
    const finalNote = {
      ...this.activeNote.note,
      duration: finalDuration,
      noteValue: this.calculateNoteValue(finalDuration)
    };

    this.onNoteUpdate(this.activeNote.noteIndex, finalNote);
    console.log(`✅ Finalized ${finalNote.noteName}: ${finalDuration}ms (${finalNote.noteValue})`);
    
    this.activeNote = null;
  }

  /**
   * Check for silence and end notes if needed
   */
  checkForSilence(): void {
    if (!this.activeNote) return;

    const currentTime = Date.now();
    const silenceDuration = currentTime - this.activeNote.lastUpdateTime;

    if (silenceDuration >= this.silenceTimeout) {
      console.log(`🔇 Ending note due to ${silenceDuration}ms silence`);
      this.finalizeCurrentNote();
    }
  }

  /**
   * Force finalize when recording stops
   */
  finalize(): void {
    this.finalizeCurrentNote();
  }

  /**
   * Calculate note value based on duration
   */
  private calculateNoteValue(duration: number): string {
    const beatDuration = this.tempoManager.getBeatDuration();
    const ratio = duration / beatDuration;

    if (ratio >= 3.5) return 'whole';
    if (ratio >= 1.75) return 'half';
    if (ratio >= 0.75) return 'quarter';
    if (ratio >= 0.375) return 'eighth';
    return 'sixteenth';
  }

  /**
   * Reset the handler
   */
  reset(): void {
    this.activeNote = null;
  }
}