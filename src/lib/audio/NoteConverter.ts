/**
 * Convert frequencies to musical notes and staff positions
 */

export interface MusicalNote {
  frequency: number;
  noteName: string;      // e.g., "C4", "F#5"
  midiNumber: number;    // MIDI note number (60 = C4)
  octave: number;
  pitchClass: string;    // e.g., "C", "F#"
  staffPosition: number; // Position on treble clef staff (0 = middle line)
  confidence: number;
}

export class NoteConverter {
  // A4 = 440Hz = MIDI 69
  private static readonly A4_FREQUENCY = 440;
  private static readonly A4_MIDI = 69;
  
  private static readonly NOTE_NAMES = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
  ];

  /**
   * Convert frequency to musical note information
   */
  static frequencyToNote(frequency: number, confidence: number = 1.0): MusicalNote {
    // Convert frequency to MIDI number using equal temperament
    const midiNumber = Math.round(12 * Math.log2(frequency / this.A4_FREQUENCY) + this.A4_MIDI);
    
    // Extract note information
    const octave = Math.floor(midiNumber / 12) - 1;
    const pitchClass = this.NOTE_NAMES[midiNumber % 12];
    const noteName = `${pitchClass}${octave}`;
    
    // Calculate staff position (treble clef, middle line = B4 = position 0)
    const staffPosition = this.midiToStaffPosition(midiNumber);
    
    return {
      frequency,
      noteName,
      midiNumber,
      octave,
      pitchClass,
      staffPosition,
      confidence
    };
  }

  /**
   * Convert MIDI number to staff position for treble clef
   * 0 = middle line (B4), positive = above, negative = below
   */
  private static midiToStaffPosition(midiNumber: number): number {
    // B4 = MIDI 71 = staff position 0 (middle line)
    // Each semitone is not a full staff position - we need to map to staff lines/spaces
    
    // Convert MIDI to chromatic staff position, then adjust for treble clef
    const b4Midi = 71; // B4 on middle line
    const semitonesFromB4 = midiNumber - b4Midi;
    
    // Map semitones to staff positions (treble clef)
    // This is a simplified mapping - in reality you'd want to handle key signatures
    return Math.round(semitonesFromB4 * 0.5); // Approximate staff line/space mapping
  }

  /**
   * Get note name from MIDI number
   */
  static midiToNoteName(midiNumber: number): string {
    const octave = Math.floor(midiNumber / 12) - 1;
    const pitchClass = this.NOTE_NAMES[midiNumber % 12];
    return `${pitchClass}${octave}`;
  }

  /**
   * Check if frequency is in a reasonable vocal range
   */
  static isVocalRange(frequency: number): boolean {
    // Typical vocal range: ~80Hz (E2) to ~1200Hz (D6)
    return frequency >= 80 && frequency <= 1200;
  }

  /**
   * Quantize frequency to nearest semitone
   */
  static quantizeToSemitone(frequency: number): number {
    const midiNumber = Math.round(12 * Math.log2(frequency / this.A4_FREQUENCY) + this.A4_MIDI);
    return this.A4_FREQUENCY * Math.pow(2, (midiNumber - this.A4_MIDI) / 12);
  }
}