/**
 * Simple Vocal Transcription Engine
 * 
 * Clean, predictable approach:
 * 1. Collect pitch data during recording
 * 2. Process into note segments after recording ends
 * 3. Calculate durations based on tempo
 * 4. Output clean note sequence
 */

import type { MusicalNote } from './NoteConverter.js';
import type { TempoManager } from './TempoManager.js';
import type { ClefType } from './RegisterDetector.js';

interface PitchSample {
  frequency: number;
  midiNumber: number;
  noteName: string;
  confidence: number;
  timestamp: number;
}

interface NoteSegment {
  startTime: number;
  endTime: number;
  duration: number;
  avgFrequency: number;
  avgMidiNumber: number;
  noteName: string;
  confidence: number;
  samples: PitchSample[];
}

export class SimpleTranscriptionEngine {
  private tempoManager: TempoManager;
  private samples: PitchSample[] = [];
  private isRecording = false;
  private recordingStartTime = 0;
  
  // Parameters for note segmentation
  private readonly MIN_NOTE_DURATION = 200; // ms - minimum note length
  private readonly PITCH_TOLERANCE = 100; // Hz - how close pitches must be to group
  private readonly MIN_CONFIDENCE = 0.3; // minimum confidence to consider a sample
  private readonly SILENCE_THRESHOLD = 150; // ms - gap before considering new note

  constructor(tempoManager: TempoManager) {
    this.tempoManager = tempoManager;
  }

  /**
   * Start recording - clear any previous data
   */
  startRecording(): void {
    this.samples = [];
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    console.log('🎤 SimpleTranscriptionEngine: Recording started');
  }

  /**
   * Add a pitch sample during recording
   */
  addPitchSample(note: MusicalNote): void {
    if (!this.isRecording || note.confidence < this.MIN_CONFIDENCE) {
      return;
    }

    const sample: PitchSample = {
      frequency: note.frequency,
      midiNumber: note.midiNumber,
      noteName: note.noteName,
      confidence: note.confidence,
      timestamp: Date.now() - this.recordingStartTime
    };

    this.samples.push(sample);
  }

  /**
   * Stop recording and process into clean note sequence
   */
  stopRecording(): MusicalNote[] {
    this.isRecording = false;
    console.log(`🎤 SimpleTranscriptionEngine: Recording stopped, processing ${this.samples.length} samples`);
    
    if (this.samples.length === 0) {
      return [];
    }

    // Step 1: Group samples into note segments
    const segments = this.groupSamplesIntoSegments();
    console.log(`📊 Created ${segments.length} note segments`);

    // Step 2: Convert segments to musical notes
    const notes = this.segmentsToNotes(segments);
    console.log(`🎵 Generated ${notes.length} musical notes`);

    return notes;
  }

  /**
   * Group continuous pitch samples into note segments
   */
  private groupSamplesIntoSegments(): NoteSegment[] {
    if (this.samples.length === 0) return [];

    const segments: NoteSegment[] = [];
    let currentSegment: PitchSample[] = [];
    let lastTimestamp = 0;

    for (const sample of this.samples) {
      const timeSinceLastSample = sample.timestamp - lastTimestamp;
      
      // Check if this sample continues the current segment
      const continuesSegment = currentSegment.length > 0 && 
        timeSinceLastSample < this.SILENCE_THRESHOLD &&
        this.isSimilarPitch(sample, currentSegment[currentSegment.length - 1]);

      if (continuesSegment) {
        // Continue current segment
        currentSegment.push(sample);
      } else {
        // Finish previous segment if it's long enough
        if (currentSegment.length > 0) {
          const segment = this.createSegmentFromSamples(currentSegment);
          if (segment.duration >= this.MIN_NOTE_DURATION) {
            segments.push(segment);
          }
        }
        
        // Start new segment
        currentSegment = [sample];
      }

      lastTimestamp = sample.timestamp;
    }

    // Don't forget the last segment
    if (currentSegment.length > 0) {
      const segment = this.createSegmentFromSamples(currentSegment);
      if (segment.duration >= this.MIN_NOTE_DURATION) {
        segments.push(segment);
      }
    }

    return segments;
  }

  /**
   * Check if two pitch samples are similar enough to be the same note
   */
  private isSimilarPitch(sample1: PitchSample, sample2: PitchSample): boolean {
    const freqDiff = Math.abs(sample1.frequency - sample2.frequency);
    const midiDiff = Math.abs(sample1.midiNumber - sample2.midiNumber);
    
    // Allow either frequency tolerance OR same MIDI note
    return freqDiff <= this.PITCH_TOLERANCE || midiDiff <= 0.5;
  }

  /**
   * Create a note segment from a group of samples
   */
  private createSegmentFromSamples(samples: PitchSample[]): NoteSegment {
    if (samples.length === 0) {
      throw new Error('Cannot create segment from empty samples');
    }

    // Calculate averages
    const avgFrequency = samples.reduce((sum, s) => sum + s.frequency, 0) / samples.length;
    const avgMidiNumber = Math.round(samples.reduce((sum, s) => sum + s.midiNumber, 0) / samples.length);
    const avgConfidence = samples.reduce((sum, s) => sum + s.confidence, 0) / samples.length;
    
    // Use the most common note name
    const noteNames = samples.map(s => s.noteName);
    const mostCommonNoteName = this.getMostFrequent(noteNames);

    return {
      startTime: samples[0].timestamp,
      endTime: samples[samples.length - 1].timestamp,
      duration: samples[samples.length - 1].timestamp - samples[0].timestamp,
      avgFrequency,
      avgMidiNumber,
      noteName: mostCommonNoteName,
      confidence: avgConfidence,
      samples
    };
  }

  /**
   * Convert note segments to MusicalNote objects
   */
  private segmentsToNotes(segments: NoteSegment[]): MusicalNote[] {
    return segments.map((segment, index) => {
      const noteValue = this.calculateNoteValue(segment.duration);
      
      return {
        frequency: segment.avgFrequency,
        midiNumber: segment.avgMidiNumber,
        noteName: segment.noteName,
        octave: Math.floor(segment.avgMidiNumber / 12) - 1,
        cents: 0, // Could calculate from frequency difference
        confidence: segment.confidence,
        timestamp: segment.startTime,
        duration: segment.duration,
        noteValue,
        // These will be set by the staff notation component
        staffPosition: 0,
        clef: 'treble' as ClefType,
        noteIndex: index
      };
    });
  }

  /**
   * Calculate note value based on duration and tempo
   */
  private calculateNoteValue(duration: number): string {
    const beatDuration = this.tempoManager.getBeatDuration();
    const ratio = duration / beatDuration;

    if (ratio >= 3.5) return 'whole';
    if (ratio >= 1.75) return 'half';
    if (ratio >= 0.875) return 'quarter';
    if (ratio >= 0.4375) return 'eighth';
    return 'sixteenth';
  }

  /**
   * Helper to find most frequent item in array
   */
  private getMostFrequent<T>(arr: T[]): T {
    const frequency: { [key: string]: number } = {};
    let maxCount = 0;
    let mostFrequent = arr[0];

    for (const item of arr) {
      const key = String(item);
      frequency[key] = (frequency[key] || 0) + 1;
      
      if (frequency[key] > maxCount) {
        maxCount = frequency[key];
        mostFrequent = item;
      }
    }

    return mostFrequent;
  }

  /**
   * Get current recording status
   */
  getRecordingStatus(): { isRecording: boolean; sampleCount: number; duration: number } {
    return {
      isRecording: this.isRecording,
      sampleCount: this.samples.length,
      duration: this.isRecording ? Date.now() - this.recordingStartTime : 0
    };
  }

  /**
   * Reset the engine
   */
  reset(): void {
    this.samples = [];
    this.isRecording = false;
    this.recordingStartTime = 0;
  }
}