/**
 * Sustained Note Handler - Manages extending and tying notes that are held
 * Implements: "if pitch within tolerance range, and pitch longer than 0.5 beats, 
 * sustain pitch by applying a tie or by extending the placed note duration commensurately"
 */

import type { MusicalNote } from './NoteConverter.js';
import { TempoManager } from './TempoManager.js';

interface SustainedNoteConfig {
  pitchTolerance: number;  // Hz - how close pitches need to be to be considered "same"
  minSustainDuration: number;  // ms - minimum duration to consider sustaining (0.5 beats ~ 500ms)
  maxSingleNoteDuration: number;  // ms - max duration for a single note before we tie
  updateInterval: number;  // ms - how often to check for extensions
}

interface ActiveSustainedNote {
  originalNote: MusicalNote;
  startTime: number;
  lastUpdateTime: number;
  currentDuration: number;
  noteIndex: number;  // Index in the notes array
  tiedNotes: MusicalNote[];  // Any tied notes we've added
}

export class SustainedNoteHandler {
  private config: SustainedNoteConfig;
  private activeSustainedNote: ActiveSustainedNote | null = null;
  private onNoteUpdate: (index: number, updatedNote: MusicalNote) => void;
  private onNoteAdd: (note: MusicalNote) => void;
  private tempoManager: TempoManager;

  constructor(
    onNoteUpdate: (index: number, updatedNote: MusicalNote) => void,
    onNoteAdd: (note: MusicalNote) => void,
    tempoManager: TempoManager,
    config: Partial<SustainedNoteConfig> = {}
  ) {
    this.tempoManager = tempoManager;
    
    // Initialize config with tempo-aware defaults
    const beatDuration = tempoManager.getBeatDuration();
    this.config = {
      pitchTolerance: 8,  // Hz - much tighter tolerance (roughly 1/4 semitone)  
      minSustainDuration: beatDuration * 0.5,  // 0.5 beats minimum
      maxSingleNoteDuration: beatDuration * 4,  // 4 beats max before tying (whole note)
      updateInterval: 100,  // Update every 100ms
      ...config
    };

    this.onNoteUpdate = onNoteUpdate;
    this.onNoteAdd = onNoteAdd;
  }

  /**
   * Process a new note - either start sustaining or extend existing sustained note
   */
  processNote(newNote: MusicalNote, noteIndex: number): boolean {
    const currentTime = Date.now();

    // Check if this note should extend the current sustained note (same pitch)
    if (this.activeSustainedNote && this.isSamePitch(newNote, this.activeSustainedNote.originalNote)) {
      this.extendSustainedNote(newNote, currentTime);
      return false; // Don't add this as a separate note
    } else {
      // Finalize any existing sustained note (pitch changed)
      if (this.activeSustainedNote) {
        this.finalizeSustainedNote(currentTime);
      }

      // OPTIMISTIC: Always start sustaining every new note (assume it will be longer)
      this.startOptimisticNote(newNote, noteIndex, currentTime);
      
      return true; // Add this note normally
    }
  }

  /**
   * Check if two notes are the same pitch (within tolerance)
   */
  private isSamePitch(note1: MusicalNote, note2: MusicalNote): boolean {
    const freqDiff = Math.abs(note1.frequency - note2.frequency);
    const isSame = freqDiff <= this.config.pitchTolerance;
    
    // Debug: Log pitch comparisons occasionally to avoid spam
    if (Math.random() < 0.1) {
      console.log(`Pitch compare: ${note1.noteName}(${note1.frequency.toFixed(1)}Hz) vs ${note2.noteName}(${note2.frequency.toFixed(1)}Hz) = ${freqDiff.toFixed(1)}Hz diff, same=${isSame}`);
    }
    
    return isSame;
  }

  /**
   * Start optimistic sustaining for any new note (assume it will be longer)
   */
  private startOptimisticNote(note: MusicalNote, noteIndex: number, currentTime: number): void {
    console.log(`Starting optimistic sustain for ${note.noteName}`);
    
    this.activeSustainedNote = {
      originalNote: note,
      startTime: currentTime,
      lastUpdateTime: currentTime,
      currentDuration: note.duration || 0,
      noteIndex,
      tiedNotes: []
    };

    // Set an initial optimistic duration - start with quarter note (reasonable assumption)
    const optimisticDuration = this.tempoManager.getNoteDuration('quarter');
    const optimisticNote = {
      ...note,
      duration: optimisticDuration,
      noteValue: this.tempoManager.getSuggestedNoteValue(optimisticDuration, note.confidence)
    };

    // Update the note immediately with optimistic duration
    this.onNoteUpdate(noteIndex, optimisticNote);
  }

  /**
   * Check if we should extend the current sustained note
   */
  private shouldExtendSustainedNote(newNote: MusicalNote, currentTime: number): boolean {
    if (!this.activeSustainedNote) return false;

    const timeSinceLastUpdate = currentTime - this.activeSustainedNote.lastUpdateTime;
    
    // With optimistic approach, we're more lenient about extending
    // Don't extend if too much time has passed (silence gap) - but be more generous
    return timeSinceLastUpdate <= 500; // More lenient timing for optimistic approach
  }

  /**
   * Check if we should start sustaining this note
   */
  private shouldStartSustaining(note: MusicalNote): boolean {
    // Only start sustaining notes that have reasonable confidence
    return note.confidence > 0.6;
  }

  /**
   * Start sustaining a new note
   */
  private startSustaining(note: MusicalNote, noteIndex: number, currentTime: number): void {
    this.activeSustainedNote = {
      originalNote: { ...note },
      startTime: currentTime,
      lastUpdateTime: currentTime,
      currentDuration: 0,
      noteIndex,
      tiedNotes: []
    };

    console.log(`Starting to sustain note: ${note.noteName} at ${note.frequency}Hz`);
  }

  /**
   * Extend the current sustained note
   */
  private extendSustainedNote(newNote: MusicalNote, currentTime: number): void {
    if (!this.activeSustainedNote) return;

    const totalDuration = currentTime - this.activeSustainedNote.startTime;
    this.activeSustainedNote.currentDuration = totalDuration;
    this.activeSustainedNote.lastUpdateTime = currentTime;

    // Update the note's duration and note value
    const updatedNote = {
      ...this.activeSustainedNote.originalNote,
      duration: totalDuration,
      noteValue: this.calculateNoteValue(totalDuration),
      // Use weighted average for frequency refinement
      frequency: this.weightedAverage(
        this.activeSustainedNote.originalNote.frequency,
        newNote.frequency,
        0.9  // 90% weight to original, 10% to new
      ),
      // Update confidence with new detection
      confidence: Math.max(this.activeSustainedNote.originalNote.confidence, newNote.confidence)
    };

    // Check if we need to add a tied note instead of extending
    if (totalDuration > this.config.maxSingleNoteDuration) {
      this.handleLongSustainedNote(updatedNote, currentTime);
    } else {
      // Update the original note
      this.onNoteUpdate(this.activeSustainedNote.noteIndex, updatedNote);
    }

    console.log(`Extended sustained note to ${totalDuration}ms (${updatedNote.noteValue})`);
  }

  /**
   * Handle very long sustained notes by adding tied notes
   */
  private handleLongSustainedNote(updatedNote: MusicalNote, currentTime: number): void {
    if (!this.activeSustainedNote) return;

    const remainingDuration = this.activeSustainedNote.currentDuration - this.config.maxSingleNoteDuration;

    // If this is the first time we're adding a tie
    if (this.activeSustainedNote.tiedNotes.length === 0) {
      // Update the original note to max duration and mark as tied
      const originalNoteWithTie = {
        ...updatedNote,
        duration: this.config.maxSingleNoteDuration,
        noteValue: this.calculateNoteValue(this.config.maxSingleNoteDuration),
        tied: 'start'  // Mark as start of tie
      };
      
      this.onNoteUpdate(this.activeSustainedNote.noteIndex, originalNoteWithTie);
    }

    // Add or update the tied note
    const tiedNoteDuration = Math.min(remainingDuration, this.config.maxSingleNoteDuration);
    const tiedNote: MusicalNote = {
      ...updatedNote,
      duration: tiedNoteDuration,
      noteValue: this.calculateNoteValue(tiedNoteDuration),
      tied: remainingDuration > this.config.maxSingleNoteDuration ? 'continue' : 'end',
      timestamp: currentTime - remainingDuration
    };

    if (this.activeSustainedNote.tiedNotes.length === 0) {
      // Add the first tied note
      this.activeSustainedNote.tiedNotes.push(tiedNote);
      this.onNoteAdd(tiedNote);
    } else {
      // Update the existing tied note
      this.activeSustainedNote.tiedNotes[this.activeSustainedNote.tiedNotes.length - 1] = tiedNote;
      // Would need a way to update the tied note in the display
    }

    console.log(`Added/updated tied note: ${tiedNoteDuration}ms`);
  }

  /**
   * Finalize the current sustained note when it ends
   */
  private finalizeSustainedNote(currentTime: number): void {
    if (!this.activeSustainedNote) return;

    const finalDuration = currentTime - this.activeSustainedNote.startTime;

    // Only finalize if we actually sustained for the minimum duration
    if (finalDuration >= this.config.minSustainDuration) {
      const finalNote = {
        ...this.activeSustainedNote.originalNote,
        duration: Math.min(finalDuration, this.config.maxSingleNoteDuration),
        noteValue: this.calculateNoteValue(Math.min(finalDuration, this.config.maxSingleNoteDuration)),
        tied: this.activeSustainedNote.tiedNotes.length > 0 ? 'start' : undefined
      };

      this.onNoteUpdate(this.activeSustainedNote.noteIndex, finalNote);
      
      console.log(`Finalized sustained note: ${finalNote.noteName} for ${finalDuration}ms (${finalNote.noteValue})`);
    }

    this.activeSustainedNote = null;
  }

  /**
   * Force finalization (call when recording stops)
   */
  public finalize(): void {
    if (this.activeSustainedNote) {
      this.finalizeSustainedNote(Date.now());
    }
  }

  /**
   * Check for ongoing sustains that need updating
   */
  public checkForUpdates(): void {
    if (!this.activeSustainedNote) return;

    const currentTime = Date.now();
    const timeSinceUpdate = currentTime - this.activeSustainedNote.lastUpdateTime;

    // If no new pitch data for a while, finalize the sustained note
    if (timeSinceUpdate > 400) {  // 400ms silence gap
      this.finalizeSustainedNote(currentTime);
    }
  }

  /**
   * Reset the handler state
   */
  public reset(): void {
    this.activeSustainedNote = null;
  }

  /**
   * Calculate note value based on duration using tempo context
   */
  private calculateNoteValue(duration: number): string {
    return this.tempoManager.getSuggestedNoteValue(duration);
  }

  /**
   * Calculate weighted average of two frequencies
   */
  private weightedAverage(freq1: number, freq2: number, weight1: number): number {
    return freq1 * weight1 + freq2 * (1 - weight1);
  }

  /**
   * Get current sustained note info for debugging
   */
  public getSustainedNoteInfo(): any {
    if (!this.activeSustainedNote) return null;

    return {
      note: this.activeSustainedNote.originalNote.noteName,
      frequency: this.activeSustainedNote.originalNote.frequency,
      duration: Date.now() - this.activeSustainedNote.startTime,
      tiedNotesCount: this.activeSustainedNote.tiedNotes.length
    };
  }
}