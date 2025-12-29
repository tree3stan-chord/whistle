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
  timestamp?: number;    // When the note was detected/started
  duration?: number;     // Duration in milliseconds
  noteValue?: string;    // Duration type: 'whole', 'half', 'quarter', 'eighth', 'sixteenth'
  tied?: 'start' | 'continue' | 'end';  // Tie information for sustained notes
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
    // FIXED: More accurate frequency to MIDI conversion
    // Formula: MIDI = 69 + 12 * log2(f/440)
    const exactMidi = 69 + 12 * Math.log2(frequency / 440);
    const midiNumber = Math.round(exactMidi);
    
    
    // Extract note information
    const octave = Math.floor(midiNumber / 12) - 1;
    const pitchClass = this.NOTE_NAMES[midiNumber % 12];
    const noteName = `${pitchClass}${octave}`;
    
    // Calculate staff position using corrected logic
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

  // Map chromatic pitch class (0-11) to diatonic step (0-6)
  // C=0, C#=0, D=1, D#=1, E=2, F=3, F#=3, G=4, G#=4, A=5, A#=5, B=6
  private static readonly PITCH_CLASS_TO_DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

  /**
   * Convert MIDI number to staff position for treble clef
   * Uses DIATONIC positions (C,D,E,F,G,A,B), not chromatic semitones
   * 0 = middle line (B4), positive = above, negative = below
   */
  private static midiToStaffPosition(midiNumber: number): number {
    // Convert MIDI to diatonic position
    const octave = Math.floor(midiNumber / 12) - 1;
    const pitchClass = midiNumber % 12;
    const diatonic = this.PITCH_CLASS_TO_DIATONIC[pitchClass];

    // Total diatonic position from C0 (7 notes per octave)
    const totalDiatonic = octave * 7 + diatonic;

    // Reference: B4 (MIDI 71) = position 0 (middle line of treble clef)
    // B4 diatonic position = 4*7 + 6 = 34
    const B4_DIATONIC = 34;

    return totalDiatonic - B4_DIATONIC;
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