/**
 * Musical Phrase Analyzer - Intelligent note duration assignment
 * 
 * This system works retrospectively to analyze musical phrases and assign
 * appropriate note values based on actual timing relationships rather than
 * trying to predict duration in real-time.
 */

import type { MusicalNote } from './NoteConverter.js';
import type { TempoManager } from './TempoManager.js';

interface NoteEvent {
  note: MusicalNote;
  startTime: number;
  endTime?: number;
  actualDuration?: number;
  assignedDuration?: number;
  noteValue?: string;
}

interface MusicalPhrase {
  events: NoteEvent[];
  startTime: number;
  endTime: number;
  totalDuration: number;
}

export class MusicalPhraseAnalyzer {
  private tempoManager: TempoManager;
  private activeEvents: Map<string, NoteEvent> = new Map(); // keyed by pitch
  private completedPhrases: MusicalPhrase[] = [];
  private onNoteUpdate: (index: number, note: MusicalNote) => void;
  private onNoteAdd: (note: MusicalNote) => void;
  private silenceThreshold = 300; // ms of silence before analyzing phrase
  private lastActivityTime = 0;

  constructor(
    tempoManager: TempoManager,
    onNoteUpdate: (index: number, note: MusicalNote) => void,
    onNoteAdd: (note: MusicalNote) => void
  ) {
    this.tempoManager = tempoManager;
    this.onNoteUpdate = onNoteUpdate;
    this.onNoteAdd = onNoteAdd;
  }

  /**
   * Process a new note detection
   */
  processNote(note: MusicalNote, noteIndex: number): boolean {
    const currentTime = Date.now();
    this.lastActivityTime = currentTime;
    
    const pitchKey = `${note.midiNumber}`;
    
    // Check if this extends an existing note
    if (this.activeEvents.has(pitchKey)) {
      const existingEvent = this.activeEvents.get(pitchKey)!;
      console.log(`🔄 Extending note: ${note.noteName}`);
      
      // Update the end time (keep extending)
      existingEvent.endTime = currentTime;
      existingEvent.actualDuration = currentTime - existingEvent.startTime;
      
      // Update the note with current duration (real-time feedback)
      const updatedNote = {
        ...existingEvent.note,
        duration: existingEvent.actualDuration,
        noteValue: this.calculateTemporaryNoteValue(existingEvent.actualDuration)
      };
      
      this.onNoteUpdate(noteIndex, updatedNote);
      return false; // Don't add as new note
    } else {
      // New note - finalize any existing notes and start this one
      this.finalizeActiveNotes();
      
      console.log(`🎵 Starting new note: ${note.noteName}`);
      const noteEvent: NoteEvent = {
        note: { ...note },
        startTime: currentTime,
        endTime: currentTime,
        actualDuration: 0
      };
      
      this.activeEvents.set(pitchKey, noteEvent);
      return true; // Add as new note
    }
  }

  /**
   * Check for silence and finalize phrases
   */
  checkForSilence(): void {
    const currentTime = Date.now();
    const silenceDuration = currentTime - this.lastActivityTime;
    
    if (silenceDuration >= this.silenceThreshold && this.activeEvents.size > 0) {
      console.log(`🔇 Silence detected (${silenceDuration}ms) - finalizing phrase`);
      this.finalizeActiveNotes();
      this.analyzePhraseAndReassignDurations();
    }
  }

  /**
   * Force finalization (when recording stops)
   */
  finalize(): void {
    this.finalizeActiveNotes();
    this.analyzePhraseAndReassignDurations();
  }

  /**
   * Finalize all currently active notes
   */
  private finalizeActiveNotes(): void {
    const currentTime = Date.now();
    
    for (const [pitchKey, event] of this.activeEvents) {
      event.endTime = currentTime;
      event.actualDuration = currentTime - event.startTime;
      console.log(`✅ Finalized note: ${event.note.noteName} (${event.actualDuration}ms)`);
    }
    
    this.activeEvents.clear();
  }

  /**
   * Analyze completed phrase and reassign note durations intelligently
   */
  private analyzePhraseAndReassignDurations(): void {
    if (this.activeEvents.size === 0) return;
    
    const events = Array.from(this.activeEvents.values());
    console.log(`🎼 Analyzing phrase with ${events.length} notes`);
    
    // Sort events by start time
    events.sort((a, b) => a.startTime - b.startTime);
    
    // Calculate the total phrase duration
    const phraseStart = events[0].startTime;
    const phraseEnd = Math.max(...events.map(e => e.endTime || e.startTime));
    const totalPhraseDuration = phraseEnd - phraseStart;
    
    console.log(`📏 Phrase duration: ${totalPhraseDuration}ms`);
    
    // Get beat duration from tempo manager
    const beatDuration = this.tempoManager.getBeatDuration();
    const totalBeats = totalPhraseDuration / beatDuration;
    
    console.log(`🎵 Total beats in phrase: ${totalBeats.toFixed(2)}`);
    
    // Apply intelligent duration assignment
    this.assignOptimalDurations(events, totalBeats, beatDuration);
  }

  /**
   * Assign optimal note durations based on musical context
   */
  private assignOptimalDurations(events: NoteEvent[], totalBeats: number, beatDuration: number): void {
    // Strategy: Distribute the total phrase duration among notes
    // while respecting musical note value conventions
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const actualBeats = (event.actualDuration || 0) / beatDuration;
      
      // Apply musical rounding rules
      let assignedNoteValue: string;
      let assignedDuration: number;
      
      if (actualBeats >= 3.5) {
        assignedNoteValue = 'whole';
        assignedDuration = beatDuration * 4;
      } else if (actualBeats >= 1.75) {
        assignedNoteValue = 'half';
        assignedDuration = beatDuration * 2;
      } else if (actualBeats >= 0.75) {
        assignedNoteValue = 'quarter';
        assignedDuration = beatDuration;
      } else if (actualBeats >= 0.375) {
        assignedNoteValue = 'eighth';
        assignedDuration = beatDuration / 2;
      } else {
        assignedNoteValue = 'sixteenth';
        assignedDuration = beatDuration / 4;
      }
      
      console.log(`🎯 ${event.note.noteName}: ${actualBeats.toFixed(2)} beats → ${assignedNoteValue}`);
      
      // Update the note with the assigned duration
      const finalNote = {
        ...event.note,
        duration: assignedDuration,
        noteValue: assignedNoteValue
      };
      
      // Find the note index and update it
      // Note: This is simplified - in practice you'd need to track note indices
      this.onNoteUpdate(i, finalNote);
    }
  }

  /**
   * Calculate temporary note value for real-time feedback
   */
  private calculateTemporaryNoteValue(duration: number): string {
    const beatDuration = this.tempoManager.getBeatDuration();
    const ratio = duration / beatDuration;
    
    if (ratio >= 3.0) return 'whole';
    if (ratio >= 1.5) return 'half';
    if (ratio >= 0.75) return 'quarter';
    if (ratio >= 0.375) return 'eighth';
    return 'sixteenth';
  }

  /**
   * Reset the analyzer
   */
  reset(): void {
    this.activeEvents.clear();
    this.completedPhrases = [];
    this.lastActivityTime = 0;
  }
}