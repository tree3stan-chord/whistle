/**
 * Note Cleanup Processor - Post-processing approach to fix vocal transcription
 * 
 * Instead of trying to detect sustains in real-time (which is unreliable),
 * this system records everything and then cleans it up afterwards.
 * 
 * Strategy:
 * 1. Record all pitch detections as short notes
 * 2. After recording stops, analyze the sequence 
 * 3. Merge consecutive similar notes into sustained notes
 * 4. Remove octave jumps and artifacts
 * 5. Assign proper note values
 */

import type { MusicalNote } from './NoteConverter.js';
import type { TempoManager } from './TempoManager.js';

export class NoteCleanupProcessor {
  private tempoManager: TempoManager;
  private onNotesUpdate: (notes: MusicalNote[]) => void;

  constructor(
    tempoManager: TempoManager,
    onNotesUpdate: (notes: MusicalNote[]) => void
  ) {
    this.tempoManager = tempoManager;
    this.onNotesUpdate = onNotesUpdate;
  }

  /**
   * Clean up a sequence of notes recorded during a session
   */
  cleanupNotes(rawNotes: MusicalNote[]): MusicalNote[] {
    if (rawNotes.length === 0) return [];

    console.log(`🧹 Starting cleanup of ${rawNotes.length} raw notes`);

    // Step 1: Remove obvious artifacts (very short notes, extreme outliers)
    let filteredNotes = this.removeArtifacts(rawNotes);
    console.log(`🗑️ After artifact removal: ${filteredNotes.length} notes`);

    // Step 2: Merge consecutive similar notes into sustained notes
    let mergedNotes = this.mergeConsecutiveNotes(filteredNotes);
    console.log(`🔗 After merging: ${mergedNotes.length} notes`);

    // Step 3: Fix octave jumps (notes that are the same pitch class but wrong octave)
    let octaveFixed = this.fixOctaveJumps(mergedNotes);
    console.log(`🎵 After octave fixes: ${octaveFixed.length} notes`);

    // Step 4: Assign proper note values based on actual durations
    let finalNotes = this.assignNoteValues(octaveFixed);
    console.log(`✅ Final cleanup result: ${finalNotes.length} notes`);

    return finalNotes;
  }

  /**
   * Remove obvious artifacts and noise
   */
  private removeArtifacts(notes: MusicalNote[]): MusicalNote[] {
    return notes.filter((note, index) => {
      // Remove notes that are too short (likely artifacts)
      if (note.duration && note.duration < 100) {
        console.log(`🗑️ Removing short artifact: ${note.noteName} (${note.duration}ms)`);
        return false;
      }

      // Remove notes with very low confidence if we have a sequence
      if (note.confidence < 0.3 && notes.length > 3) {
        console.log(`🗑️ Removing low confidence note: ${note.noteName} (${note.confidence})`);
        return false;
      }

      return true;
    });
  }

  /**
   * Merge consecutive notes that are essentially the same pitch
   */
  private mergeConsecutiveNotes(notes: MusicalNote[]): MusicalNote[] {
    if (notes.length <= 1) return notes;

    const merged: MusicalNote[] = [];
    let currentGroup = [notes[0]];

    for (let i = 1; i < notes.length; i++) {
      const current = notes[i];
      const previous = notes[i - 1];

      if (this.shouldMergeNotes(previous, current)) {
        currentGroup.push(current);
        console.log(`🔗 Merging ${previous.noteName} with ${current.noteName}`);
      } else {
        // Finalize the current group
        const mergedNote = this.createMergedNote(currentGroup);
        merged.push(mergedNote);
        
        // Start new group
        currentGroup = [current];
      }
    }

    // Don't forget the last group
    if (currentGroup.length > 0) {
      const mergedNote = this.createMergedNote(currentGroup);
      merged.push(mergedNote);
    }

    return merged;
  }

  /**
   * Determine if two consecutive notes should be merged
   */
  private shouldMergeNotes(note1: MusicalNote, note2: MusicalNote): boolean {
    // Same MIDI number (exact match)
    if (note1.midiNumber === note2.midiNumber) return true;

    // Same pitch class (same note, different octave) with close frequencies
    const pitchClass1 = note1.midiNumber % 12;
    const pitchClass2 = note2.midiNumber % 12;
    const sameNoteClass = pitchClass1 === pitchClass2;
    
    const freqDiff = Math.abs(note1.frequency - note2.frequency);
    const closeFrequency = freqDiff <= 100; // Hz tolerance

    if (sameNoteClass && closeFrequency) {
      console.log(`🎯 Octave merge candidate: ${note1.noteName} + ${note2.noteName} (freq diff: ${freqDiff.toFixed(1)}Hz)`);
      return true;
    }

    // Very close frequencies (probably pitch detection drift)
    if (freqDiff <= 50) {
      console.log(`🎯 Frequency merge: ${note1.noteName} + ${note2.noteName} (freq diff: ${freqDiff.toFixed(1)}Hz)`);
      return true;
    }

    return false;
  }

  /**
   * Create a merged note from a group of similar notes
   */
  private createMergedNote(noteGroup: MusicalNote[]): MusicalNote {
    if (noteGroup.length === 1) return noteGroup[0];

    // Use the first note as the base (most stable detection)
    const baseNote = noteGroup[0];
    
    // Calculate total duration
    const startTime = baseNote.timestamp || 0;
    const endTimes = noteGroup.map(n => (n.timestamp || 0) + (n.duration || 200));
    const endTime = Math.max(...endTimes);
    const totalDuration = endTime - startTime;

    // Average the frequency for stability (weighted toward first detection)
    const avgFrequency = noteGroup.reduce((sum, note, index) => {
      const weight = index === 0 ? 0.5 : 0.5 / (noteGroup.length - 1);
      return sum + (note.frequency * weight);
    }, 0);

    const mergedNote: MusicalNote = {
      ...baseNote,
      frequency: avgFrequency,
      duration: totalDuration,
      noteValue: this.calculateNoteValue(totalDuration)
    };

    console.log(`✨ Merged ${noteGroup.length} notes into ${mergedNote.noteName} (${totalDuration}ms, ${mergedNote.noteValue})`);
    return mergedNote;
  }

  /**
   * Fix octave jumps by choosing the most consistent octave
   */
  private fixOctaveJumps(notes: MusicalNote[]): MusicalNote[] {
    if (notes.length <= 2) return notes;

    // For each note, check if it's an octave outlier
    return notes.map((note, index) => {
      if (index === 0 || index === notes.length - 1) return note;

      const prev = notes[index - 1];
      const next = notes[index + 1];

      // Check if this note is an octave jump compared to neighbors
      const prevOctaveDiff = Math.abs(note.midiNumber - prev.midiNumber);
      const nextOctaveDiff = Math.abs(note.midiNumber - next.midiNumber);

      // If both neighbors suggest this is an octave error
      if (prevOctaveDiff === 12 && nextOctaveDiff === 12) {
        // Choose the octave that's more common among neighbors
        const targetMidi = prev.midiNumber;
        const correctedNote = {
          ...note,
          midiNumber: targetMidi,
          octave: Math.floor(targetMidi / 12) - 1,
          noteName: `${note.pitchClass}${Math.floor(targetMidi / 12) - 1}`
        };
        
        console.log(`🔧 Fixed octave jump: ${note.noteName} → ${correctedNote.noteName}`);
        return correctedNote;
      }

      return note;
    });
  }

  /**
   * Assign proper note values based on durations
   */
  private assignNoteValues(notes: MusicalNote[]): MusicalNote[] {
    return notes.map(note => ({
      ...note,
      noteValue: this.calculateNoteValue(note.duration || 200)
    }));
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
}