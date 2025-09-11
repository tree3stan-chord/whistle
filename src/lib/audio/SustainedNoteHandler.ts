/**
 * Sustained Note Handler - Manages extending and tying notes that are held
 * Implements: "if pitch within tolerance range, and pitch longer than 0.5 beats, 
 * sustain pitch by applying a tie or by extending the placed note duration commensurately"
 */

import type { MusicalNote } from './NoteConverter.js';
import { TempoManager } from './TempoManager.js';

interface SustainedNoteConfig {
  pitchTolerance: number;  // Hz - how close pitches need to be to be considered "same"
  minSustainDuration: number;  // ms - minimum duration to consider sustaining
  maxSingleNoteDuration: number;  // ms - max duration for a single note before we tie
  updateInterval: number;  // ms - how often to check for extensions
  silenceThreshold: number;  // ms - how long silence before ending a note
  confidenceThreshold: number;  // minimum confidence to process a note
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
      pitchTolerance: 50,  // Hz - much more forgiving for human pitch variations
      minSustainDuration: 150,  // 150ms minimum - shorter for responsive transcription
      maxSingleNoteDuration: beatDuration * 4,  // 4 beats max before tying (whole note)
      updateInterval: 50,  // Update every 50ms for smoother response
      silenceThreshold: 400,  // 400ms silence to end a note (very forgiving)
      confidenceThreshold: 0.5,  // Even lower confidence threshold
      ...config
    };

    this.onNoteUpdate = onNoteUpdate;
    this.onNoteAdd = onNoteAdd;
  }

  /**
   * Process a new note - either start sustaining or extend existing sustained note
   * Returns: true if should add as new note, false if handled as sustain
   */
  processNote(newNote: MusicalNote, noteIndex: number): boolean {
    const currentTime = Date.now();

    // Filter out low confidence notes early to prevent octave jumping
    if (newNote.confidence < this.config.confidenceThreshold) {
      console.log(`🚫 Rejecting low confidence note: ${newNote.noteName} (${newNote.confidence.toFixed(3)} < ${this.config.confidenceThreshold})`);
      // Check if we have an active note that needs finalization due to silence
      this.checkForSilenceEnd(currentTime);
      return false; // Don't add low confidence notes
    }

    console.log(`🎤 Processing note: ${newNote.noteName} (MIDI: ${newNote.midiNumber}, ${newNote.frequency.toFixed(1)}Hz, conf: ${newNote.confidence.toFixed(3)})`);

    // Check if this extends the current sustained note
    if (this.activeSustainedNote) {
      const isSame = this.isSamePitch(newNote, this.activeSustainedNote.originalNote);
      console.log(`🔍 Checking sustain: ${newNote.noteName} vs ${this.activeSustainedNote.originalNote.noteName} = ${isSame}`);
      
      if (isSame) {
        console.log(`🔄 Extending sustained note: ${this.activeSustainedNote.originalNote.noteName}`);
        // Extend the current note
        this.extendSustainedNote(newNote, currentTime);
        return false; // Don't add as separate note
      }
    }
    
    // This is a different pitch or no active note - finalize current note and start new one
    if (this.activeSustainedNote) {
      console.log(`🔚 Finalizing previous note: ${this.activeSustainedNote.originalNote.noteName}`);
      this.finalizeSustainedNote(currentTime);
    }
    
    // Start sustaining the new note
    this.startSustaining(newNote, noteIndex, currentTime);
    return true; // Add this note
  }

  /**
   * Check if two notes are the same pitch (within tolerance)
   * Uses both frequency and MIDI number for better octave stability
   */
  private isSamePitch(note1: MusicalNote, note2: MusicalNote): boolean {
    // Primary check: MIDI number should be exactly the same (prevents octave jumping)
    const midiSame = note1.midiNumber === note2.midiNumber;
    
    // Secondary check: frequency within tolerance (handles minor pitch variations)
    const freqDiff = Math.abs(note1.frequency - note2.frequency);
    const freqSame = freqDiff <= this.config.pitchTolerance;
    
    // For sustaining, we should be more forgiving - use MIDI OR frequency match
    // This helps when pitch detection varies slightly but is essentially the same note
    const isSame = midiSame || freqSame;
    
    // Debug: Log pitch comparisons occasionally
    if (Math.random() < 0.02) {
      console.log(`🎯 ${note1.noteName} vs ${note2.noteName} = same=${isSame} (freqDiff=${freqDiff.toFixed(1)}Hz)`);
    }
    
    return isSame;
  }

  /**
   * Check if silence has lasted long enough to end the current note
   */
  private checkForSilenceEnd(currentTime: number): void {
    if (!this.activeSustainedNote) return;
    
    const silenceDuration = currentTime - this.activeSustainedNote.lastUpdateTime;
    if (silenceDuration >= this.config.silenceThreshold) {
      console.log(`🔇 Ending note due to ${silenceDuration}ms silence`);
      this.finalizeSustainedNote(currentTime);
    }
  }

  /**
   * Start sustaining a new note with proper initial duration
   */
  private startSustaining(note: MusicalNote, noteIndex: number, currentTime: number): void {
    console.log(`🎵 Starting sustain for ${note.noteName} (MIDI: ${note.midiNumber}) at ${note.frequency.toFixed(1)}Hz`);
    
    this.activeSustainedNote = {
      originalNote: { ...note },
      startTime: currentTime,
      lastUpdateTime: currentTime,
      currentDuration: 0,
      noteIndex,
      tiedNotes: []
    };

    // Start with a short initial duration that will extend as the note continues
    const initialDuration = this.config.updateInterval * 2; // Slightly longer initial duration
    const initialNote = {
      ...note,
      duration: initialDuration,
      noteValue: this.calculateNoteValue(initialDuration), // Use tempo-aware calculation
      timestamp: currentTime
    };

    // Update the note immediately
    this.onNoteUpdate(noteIndex, initialNote);
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
   * Extend the current sustained note
   */
  private extendSustainedNote(newNote: MusicalNote, currentTime: number): void {
    if (!this.activeSustainedNote) return;

    const totalDuration = currentTime - this.activeSustainedNote.startTime;
    this.activeSustainedNote.currentDuration = totalDuration;
    this.activeSustainedNote.lastUpdateTime = currentTime;

    // Use frequency smoothing for more stable pitch representation
    const smoothedFrequency = this.weightedAverage(
      this.activeSustainedNote.originalNote.frequency,
      newNote.frequency,
      0.85  // 85% weight to original, 15% to new (more stability)
    );

    // Keep the original MIDI number to prevent octave jumping
    const updatedNote = {
      ...this.activeSustainedNote.originalNote,
      duration: totalDuration,
      noteValue: this.calculateNoteValue(totalDuration),
      frequency: smoothedFrequency, // Use smoothed frequency
      // Boost confidence as note sustains (more data = higher confidence)
      confidence: Math.min(
        Math.max(this.activeSustainedNote.originalNote.confidence, newNote.confidence), 
        0.95 // Cap confidence at 95%
      )
    };

    // Update the active note's frequency for future comparisons
    this.activeSustainedNote.originalNote.frequency = smoothedFrequency;

    // Check if we need to add a tied note instead of extending
    if (totalDuration > this.config.maxSingleNoteDuration) {
      this.handleLongSustainedNote(updatedNote, currentTime);
    } else {
      // Update the original note
      this.onNoteUpdate(this.activeSustainedNote.noteIndex, updatedNote);
    }

    // Debug occasionally - show duration calculations
    if (Math.random() < 0.05) {
      const beatDuration = this.tempoManager.getBeatDuration();
      const ratio = totalDuration / beatDuration;
      console.log(`🎼 Extended ${updatedNote.noteName} to ${totalDuration}ms (${updatedNote.noteValue}) - ratio: ${ratio.toFixed(2)} beats`);
    }
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
   * Check for ongoing sustains that need updating (call regularly from outside)
   */
  public checkForUpdates(): void {
    if (!this.activeSustainedNote) return;

    const currentTime = Date.now();
    this.checkForSilenceEnd(currentTime);
  }

  /**
   * Check if there's currently an active sustained note
   */
  public hasActiveSustainedNote(): boolean {
    return this.activeSustainedNote !== null;
  }

  /**
   * Get the current note being sustained (for debugging/display)
   */
  public getActiveSustainedNote(): MusicalNote | null {
    return this.activeSustainedNote ? this.activeSustainedNote.originalNote : null;
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