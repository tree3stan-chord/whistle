/**
 * Tempo Manager - Handles tempo-aware note duration calculations and measure organization
 * Provides context for converting time-based note durations to musical note values
 */

export interface TempoConfig {
  bpm: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  subdivision: 'eighth' | 'sixteenth'; // Smallest division for quantization
}

export interface MeasureInfo {
  measureNumber: number;
  startTime: number;
  endTime: number;
  notes: any[]; // Will contain MusicalNote objects
}

export class TempoManager {
  private config: TempoConfig;
  private startTime: number | null = null;
  private measures: MeasureInfo[] = [];
  
  constructor(config: Partial<TempoConfig> = {}) {
    this.config = {
      bpm: 120, // Default moderate tempo
      timeSignature: { numerator: 4, denominator: 4 }, // 4/4 time
      subdivision: 'eighth', // Quantize to eighth notes
      ...config
    };
  }

  /**
   * Get the duration of one beat in milliseconds
   */
  getBeatDuration(): number {
    return (60 * 1000) / this.config.bpm; // ms per beat
  }

  /**
   * Get the duration of one measure in milliseconds
   */
  getMeasureDuration(): number {
    const beatDuration = this.getBeatDuration();
    const beatsPerMeasure = this.config.timeSignature.numerator;
    return beatDuration * beatsPerMeasure;
  }

  /**
   * Get the duration for a specific note value in milliseconds
   */
  getNoteDuration(noteValue: string): number {
    const beatDuration = this.getBeatDuration();
    
    switch (noteValue) {
      case 'whole': return beatDuration * 4;
      case 'half': return beatDuration * 2;
      case 'quarter': return beatDuration;
      case 'eighth': return beatDuration / 2;
      case 'sixteenth': return beatDuration / 4;
      default: return beatDuration; // Default to quarter note
    }
  }

  /**
   * Convert a time duration (ms) to the closest musical note value
   */
  durationToNoteValue(durationMs: number): string {
    const beatDuration = this.getBeatDuration();
    const ratio = durationMs / beatDuration;

    // More sensible quantization thresholds for vocal performance
    if (ratio >= 3.0) return 'whole';    // 3+ beats = whole note
    if (ratio >= 1.25) return 'half';    // 1.25+ beats = half note (more accessible)
    if (ratio >= 0.6) return 'quarter';  // 0.6+ beats = quarter note 
    if (ratio >= 0.3) return 'eighth';   // 0.3+ beats = eighth note
    return 'sixteenth';
  }

  /**
   * Start timing - sets the reference point for measure calculations
   */
  startTiming(): void {
    this.startTime = Date.now();
    this.measures = [];
  }

  /**
   * Get which measure a timestamp falls into
   */
  getMeasureForTime(timestamp: number): number {
    if (!this.startTime) return 1;
    
    const elapsedTime = timestamp - this.startTime;
    const measureDuration = this.getMeasureDuration();
    
    return Math.floor(elapsedTime / measureDuration) + 1;
  }

  /**
   * Get the position within a measure (0.0 to 1.0)
   */
  getPositionInMeasure(timestamp: number): number {
    if (!this.startTime) return 0;
    
    const elapsedTime = timestamp - this.startTime;
    const measureDuration = this.getMeasureDuration();
    const measureProgress = elapsedTime % measureDuration;
    
    return measureProgress / measureDuration;
  }

  /**
   * Get current playhead position info
   */
  getPlayheadInfo(currentTime: number): {
    measure: number;
    beat: number;
    positionInMeasure: number;
    positionInBeat: number;
  } {
    if (!this.startTime) {
      return { measure: 1, beat: 1, positionInMeasure: 0, positionInBeat: 0 };
    }

    const elapsedTime = currentTime - this.startTime;
    const beatDuration = this.getBeatDuration();
    const measureDuration = this.getMeasureDuration();
    
    const measure = Math.floor(elapsedTime / measureDuration) + 1;
    const positionInMeasure = (elapsedTime % measureDuration) / measureDuration;
    
    const elapsedBeats = elapsedTime / beatDuration;
    const beat = Math.floor(elapsedBeats % this.config.timeSignature.numerator) + 1;
    const positionInBeat = (elapsedBeats % 1);
    
    return { measure, beat, positionInMeasure, positionInBeat };
  }

  /**
   * Update tempo (allows for tempo changes during performance)
   */
  updateTempo(newBpm: number): void {
    console.log(`Tempo changed from ${this.config.bpm} to ${newBpm} BPM`);
    this.config.bpm = newBpm;
  }

  /**
   * Update time signature
   */
  updateTimeSignature(numerator: number, denominator: number): void {
    console.log(`Time signature changed to ${numerator}/${denominator}`);
    this.config.timeSignature = { numerator, denominator };
  }

  /**
   * Get configuration for UI display
   */
  getConfig(): TempoConfig {
    return { ...this.config };
  }

  /**
   * Get suggested note value based on sustained duration and tempo context
   */
  getSuggestedNoteValue(durationMs: number, confidence: number = 1.0): string {
    // For very short durations or low confidence, use shortest reasonable note
    if (durationMs < this.getBeatDuration() * 0.2 || confidence < 0.5) {
      return 'eighth';
    }

    return this.durationToNoteValue(durationMs);
  }

  /**
   * Calculate how many measures are needed for a given duration
   */
  getMeasuresNeeded(totalDurationMs: number): number {
    const measureDuration = this.getMeasureDuration();
    return Math.ceil(totalDurationMs / measureDuration);
  }

  /**
   * Get grid positions for measure lines
   */
  getMeasurePositions(totalWidth: number, totalDurationMs: number): number[] {
    const measuresNeeded = this.getMeasuresNeeded(totalDurationMs);
    const positions: number[] = [];
    
    for (let i = 1; i <= measuresNeeded; i++) {
      const position = (i / measuresNeeded) * totalWidth;
      positions.push(position);
    }
    
    return positions;
  }

  /**
   * Reset the tempo manager
   */
  reset(): void {
    this.startTime = null;
    this.measures = [];
  }
}