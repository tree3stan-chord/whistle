/**
 * Real-Time Sustain Handler - Direct approach for true sustain
 * 
 * Simple strategy:
 * 1. When pitch detected -> start new note OR extend current note
 * 2. When pitch stops -> immediately end current note
 * 3. When pitch changes -> end current note and start new one
 * 
 * No post-processing, no delays, no guessing - just direct real-time response.
 */

import type { MusicalNote } from './NoteConverter.js';
import type { TempoManager } from './TempoManager.js';

interface ActiveSustain {
  note: MusicalNote;
  noteIndex: number;
  startTime: number;
  lastPitchTime: number;
}

export class RealTimeSustainHandler {
  private tempoManager: TempoManager;
  private onNoteUpdate: (index: number, note: MusicalNote) => void;
  private onNoteAdd: (note: MusicalNote) => void;
  private onNoteRemove: (index: number) => void;
  private activeSustain: ActiveSustain | null = null;
  
  // More forgiving tolerances for better sustain detection
  private pitchTolerance = 150; // Hz tolerance for same pitch - much more forgiving
  private silenceTimeout = 600; // ms - longer timeout to prevent premature cutoff
  private minNoteDuration = 300; // ms - minimum duration before creating a note
  private lastUpdateTime = 0;

  constructor(
    tempoManager: TempoManager,
    onNoteUpdate: (index: number, note: MusicalNote) => void,
    onNoteAdd: (note: MusicalNote) => void,
    onNoteRemove: (index: number) => void
  ) {
    this.tempoManager = tempoManager;
    this.onNoteUpdate = onNoteUpdate;
    this.onNoteAdd = onNoteAdd;
    this.onNoteRemove = onNoteRemove;
  }

  /**
   * Process incoming pitch - main entry point
   */
  processNote(newNote: MusicalNote, noteIndex: number): boolean {
    const currentTime = Date.now();
    this.lastUpdateTime = currentTime;

    console.log(`🎵 SUSTAIN PROCESS: ${newNote.noteName} (${newNote.frequency.toFixed(1)}Hz, conf: ${newNote.confidence.toFixed(3)})`);

    // If we have an active sustain, check if this continues it
    if (this.activeSustain) {
      console.log(`🔍 ACTIVE SUSTAIN: ${this.activeSustain.note.noteName} → checking if ${newNote.noteName} matches`);
      
      if (this.isSamePitch(newNote, this.activeSustain.note)) {
        // Same pitch - extend the current note
        console.log(`✅ SAME PITCH: Extending sustain`);
        this.extendCurrentNote(currentTime);
        return false; // Don't add new note
      } else {
        // Different pitch - end current and start new
        console.log(`❌ DIFFERENT PITCH: Ending current sustain and starting new`);
        this.endCurrentNote();
        this.startNewNote(newNote, noteIndex, currentTime);
        return true; // Add new note
      }
    } else {
      // No active sustain - start new note
      console.log(`🆕 NO ACTIVE SUSTAIN: Starting new sustain`);
      this.startNewNote(newNote, noteIndex, currentTime);
      return true; // Add new note
    }
  }

  /**
   * Check for silence and end notes immediately
   */
  checkForSilence(): void {
    if (!this.activeSustain) return;

    const currentTime = Date.now();
    const silenceDuration = currentTime - this.lastUpdateTime;

    // Log silence checking occasionally for debugging
    if (Math.random() < 0.02) {
      console.log(`🔇 SILENCE CHECK: ${silenceDuration}ms since last update (timeout: ${this.silenceTimeout}ms)`);
    }

    if (silenceDuration >= this.silenceTimeout) {
      console.log(`🔇 SILENCE TIMEOUT: ${silenceDuration}ms silence - ending note`);
      this.endCurrentNote();
    }
  }

  /**
   * Force end current note (when recording stops)
   */
  forceEnd(): void {
    if (this.activeSustain) {
      console.log('🛑 FORCE END: Recording stopped');
      this.endCurrentNote();
    }
  }

  /**
   * Check if two notes are the same pitch (very forgiving for sustains)
   */
  private isSamePitch(note1: MusicalNote, note2: MusicalNote): boolean {
    // Layer 1: Exact MIDI match (same note, same octave)
    const midiSame = note1.midiNumber === note2.midiNumber;
    
    // Layer 2: Same pitch class (same note, any octave)
    const pitchClass1 = note1.midiNumber % 12;
    const pitchClass2 = note2.midiNumber % 12;
    const sameNoteClass = pitchClass1 === pitchClass2;
    
    // Layer 3: Frequency tolerance (handles pitch drift)
    const freqDiff = Math.abs(note1.frequency - note2.frequency);
    const freqClose = freqDiff <= this.pitchTolerance;
    
    // Layer 4: Adjacent semitones (for very close pitches)
    const midiDiff = Math.abs(note1.midiNumber - note2.midiNumber);
    const closelyRelated = midiDiff <= 1; // Within 1 semitone
    
    // Be VERY forgiving for sustains - any of these should count as same pitch
    const isSame = midiSame || (sameNoteClass && freqClose) || freqClose || (closelyRelated && freqClose);
    
    // Always log pitch comparison for debugging
    console.log(`🎯 PITCH COMPARE: ${note1.noteName} vs ${note2.noteName} = ${isSame}`);
    console.log(`   - MIDI: ${note1.midiNumber} vs ${note2.midiNumber} (diff: ${midiDiff})`);
    console.log(`   - Freq: ${note1.frequency.toFixed(1)} vs ${note2.frequency.toFixed(1)} (diff: ${freqDiff.toFixed(1)}Hz)`);
    console.log(`   - Checks: MIDI=${midiSame}, Class=${sameNoteClass}, Freq=${freqClose}, Adjacent=${closelyRelated}`);
    console.log(`   - Result: ${isSame ? 'MATCH' : 'NO MATCH'}`);
    console.log(`---`);
    
    return isSame;
  }

  /**
   * Start a new sustained note
   */
  private startNewNote(note: MusicalNote, noteIndex: number, currentTime: number): void {
    this.activeSustain = {
      note: { ...note },
      noteIndex,
      startTime: currentTime,
      lastPitchTime: currentTime
    };

    console.log(`🎵 START SUSTAIN: ${note.noteName} at index ${noteIndex}`);
  }

  /**
   * Extend the current sustained note
   */
  private extendCurrentNote(currentTime: number): void {
    if (!this.activeSustain) return;

    this.activeSustain.lastPitchTime = currentTime;
    const totalDuration = currentTime - this.activeSustain.startTime;

    // Create updated note with new duration
    const updatedNote: MusicalNote = {
      ...this.activeSustain.note,
      duration: totalDuration,
      noteValue: this.calculateNoteValue(totalDuration)
    };

    // Update the existing note in place
    this.onNoteUpdate(this.activeSustain.noteIndex, updatedNote);

    // Always log extends for debugging
    console.log(`🔄 EXTEND: ${updatedNote.noteName} → ${totalDuration}ms (${updatedNote.noteValue})`);
    console.log(`   Index: ${this.activeSustain.noteIndex}, Duration: ${totalDuration}ms`);
  }

  /**
   * End the current sustained note immediately
   */
  private endCurrentNote(): void {
    if (!this.activeSustain) return;

    const endTime = Date.now();
    const finalDuration = endTime - this.activeSustain.startTime;

    // Only keep notes that meet minimum duration
    if (finalDuration < this.minNoteDuration) {
      console.log(`🗑️ DISCARDING short note: ${this.activeSustain.note.noteName} (${finalDuration}ms < ${this.minNoteDuration}ms)`);
      // Remove the note entirely if it's too short
      this.onNoteRemove(this.activeSustain.noteIndex);
      this.activeSustain = null;
      return;
    }

    // Final update with exact duration
    const finalNote: MusicalNote = {
      ...this.activeSustain.note,
      duration: finalDuration,
      noteValue: this.calculateNoteValue(finalDuration)
    };

    this.onNoteUpdate(this.activeSustain.noteIndex, finalNote);
    
    console.log(`✅ END SUSTAIN: ${finalNote.noteName} → ${finalDuration}ms (${finalNote.noteValue})`);
    
    this.activeSustain = null;
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
   * Reset handler
   */
  reset(): void {
    this.activeSustain = null;
    this.lastUpdateTime = 0;
  }

  /**
   * Get current sustain info for debugging
   */
  getCurrentSustain(): ActiveSustain | null {
    return this.activeSustain;
  }
}