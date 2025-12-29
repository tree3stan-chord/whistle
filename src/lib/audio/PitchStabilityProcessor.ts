/**
 * PitchStabilityProcessor - Central authority for pitch stability and note detection
 *
 * Solves the "notes flying everywhere" problem by:
 * 1. Median filtering of incoming pitch values
 * 2. MIDI-based pitch comparison (semitone-aware, not raw Hz)
 * 3. Hysteresis for note transitions (require sustained change before switching)
 * 4. Configurable stability window (200-300ms for balanced responsiveness)
 * 5. Confidence floor enforcement
 */

export interface PitchStabilityConfig {
  // Timing
  stabilityWindowMs: number;       // Time window for stability checking (default: 250ms)
  analysisIntervalMs: number;      // How often we receive samples (default: 50ms)

  // Confidence
  minConfidence: number;           // Minimum confidence to accept (default: 0.35)
  highConfidence: number;          // High confidence for faster acceptance (default: 0.6)

  // Pitch comparison (MIDI-based, in semitones)
  sustainTolerance: number;        // Tolerance for sustaining same note (default: 1.0 semitone)
  changeThreshold: number;         // Threshold to trigger new note (default: 1.5 semitones)

  // Hysteresis
  minFramesForNewNote: number;     // Frames required for new note (default: 5 = 250ms)
  minFramesForSustain: number;     // Frames required to confirm sustain (default: 2 = 100ms)
}

export interface StablePitchResult {
  frequency: number;               // Filtered/stable frequency
  midiNumber: number;              // Rounded MIDI note number
  confidence: number;              // Average confidence over window
  isNewNote: boolean;              // True if this is a new note (not sustain)
  isSustaining: boolean;           // True if sustaining current note
  sustainDurationMs: number;       // How long we've been on this note
  rawFrequency: number;            // Unfiltered input frequency
}

interface PitchSample {
  frequency: number;
  midiNumber: number;
  confidence: number;
  timestamp: number;
}

export class PitchStabilityProcessor {
  private config: PitchStabilityConfig;
  private sampleHistory: PitchSample[] = [];
  private currentStableNote: { midiNumber: number; startTime: number } | null = null;
  private lastEmittedMidi: number | null = null;
  private silenceStartTime: number | null = null;

  constructor(config: Partial<PitchStabilityConfig> = {}) {
    this.config = {
      stabilityWindowMs: 250,
      analysisIntervalMs: 50,
      minConfidence: 0.35,
      highConfidence: 0.6,
      sustainTolerance: 1.0,
      changeThreshold: 1.5,
      minFramesForNewNote: 5,    // 5 * 50ms = 250ms
      minFramesForSustain: 2,    // 2 * 50ms = 100ms
      ...config
    };
  }

  /**
   * Process incoming pitch detection result
   * Returns stable pitch result or null if no stable pitch
   */
  process(
    frequency: number | null,
    confidence: number,
    timestamp: number = Date.now()
  ): StablePitchResult | null {

    // GATE 1: Reject null or low-confidence detections
    if (frequency === null || confidence < this.config.minConfidence) {
      this.trackSilence(timestamp);

      // Check for note end (sustained silence)
      if (this.currentStableNote !== null && this.shouldEndNote(timestamp)) {
        console.log('Ending note due to sustained silence');
        this.endCurrentNote();
      }

      return null;
    }

    // Clear silence tracking - we have a valid pitch
    this.silenceStartTime = null;

    // Convert to MIDI for semitone-based comparison
    const midiNumber = this.frequencyToMidi(frequency);

    // Add to history
    this.addSample({ frequency, midiNumber, confidence, timestamp });

    // Prune old samples
    this.pruneOldSamples(timestamp);

    // GATE 2: Check stability using median filter
    const medianMidi = this.getMedianMidi();
    if (medianMidi === null) {
      return null;
    }

    // GATE 3: Check if we have enough stable frames
    const stableFrames = this.countStableFrames(medianMidi);
    const requiredFrames = confidence >= this.config.highConfidence
      ? Math.ceil(this.config.minFramesForNewNote * 0.6)  // Fast path for high confidence
      : this.config.minFramesForNewNote;

    if (stableFrames < requiredFrames) {
      // Not stable yet - don't emit
      return null;
    }

    // We have a stable pitch - determine if it's new or sustaining
    const isNewNote = this.determineIfNewNote(medianMidi, timestamp);

    if (isNewNote) {
      this.startNewNote(medianMidi, timestamp);
    }

    const avgConfidence = this.getAverageConfidence();
    const avgFrequency = this.getMedianFrequency();

    return {
      frequency: avgFrequency,
      midiNumber: Math.round(medianMidi),
      confidence: avgConfidence,
      isNewNote,
      isSustaining: !isNewNote && this.currentStableNote !== null,
      sustainDurationMs: this.currentStableNote
        ? timestamp - this.currentStableNote.startTime
        : 0,
      rawFrequency: frequency
    };
  }

  /**
   * Convert frequency to MIDI note number (floating point for precision)
   */
  private frequencyToMidi(freq: number): number {
    return 69 + 12 * Math.log2(freq / 440);
  }

  /**
   * Add a pitch sample to history
   */
  private addSample(sample: PitchSample): void {
    this.sampleHistory.push(sample);
  }

  /**
   * Remove samples older than 1 second
   */
  private pruneOldSamples(currentTime: number): void {
    const cutoff = currentTime - 1000;
    this.sampleHistory = this.sampleHistory.filter(s => s.timestamp > cutoff);
  }

  /**
   * Get samples within the stability window
   */
  private getRecentSamples(): PitchSample[] {
    const now = Date.now();
    const windowStart = now - this.config.stabilityWindowMs;
    return this.sampleHistory.filter(s => s.timestamp >= windowStart);
  }

  /**
   * Calculate median MIDI value from recent samples
   */
  private getMedianMidi(): number | null {
    const recent = this.getRecentSamples();
    if (recent.length < this.config.minFramesForSustain) {
      return null;
    }

    const sortedMidi = recent.map(s => s.midiNumber).sort((a, b) => a - b);
    const mid = Math.floor(sortedMidi.length / 2);

    return sortedMidi.length % 2 === 0
      ? (sortedMidi[mid - 1] + sortedMidi[mid]) / 2
      : sortedMidi[mid];
  }

  /**
   * Calculate median frequency from recent samples
   */
  private getMedianFrequency(): number {
    const recent = this.getRecentSamples();
    if (recent.length === 0) return 0;

    const sortedFreq = recent.map(s => s.frequency).sort((a, b) => a - b);
    const mid = Math.floor(sortedFreq.length / 2);

    return sortedFreq.length % 2 === 0
      ? (sortedFreq[mid - 1] + sortedFreq[mid]) / 2
      : sortedFreq[mid];
  }

  /**
   * Calculate average confidence from recent samples
   */
  private getAverageConfidence(): number {
    const recent = this.getRecentSamples();
    if (recent.length === 0) return 0;
    return recent.reduce((sum, s) => sum + s.confidence, 0) / recent.length;
  }

  /**
   * Count how many recent samples are within tolerance of target MIDI
   */
  private countStableFrames(targetMidi: number): number {
    const recent = this.getRecentSamples();
    let count = 0;

    for (const sample of recent) {
      const diff = Math.abs(sample.midiNumber - targetMidi);
      if (diff <= this.config.sustainTolerance) {
        count++;
      }
    }

    return count;
  }

  /**
   * Track silence start time
   */
  private trackSilence(timestamp: number): void {
    if (this.silenceStartTime === null) {
      this.silenceStartTime = timestamp;
    }
  }

  /**
   * Check if we should end the current note due to sustained silence
   */
  private shouldEndNote(timestamp: number): boolean {
    if (this.silenceStartTime === null) return false;

    const silenceDuration = timestamp - this.silenceStartTime;
    // End note after ~150ms of silence (3 frames)
    return silenceDuration >= this.config.analysisIntervalMs * 3;
  }

  /**
   * Determine if current pitch represents a new note or continuation of sustain
   */
  private determineIfNewNote(currentMidi: number, timestamp: number): boolean {
    if (this.currentStableNote === null) {
      return true; // No current note, this is new
    }

    const midiDiff = Math.abs(currentMidi - this.currentStableNote.midiNumber);

    // Use hysteresis: require larger change to switch notes
    if (midiDiff >= this.config.changeThreshold) {
      return true; // Significant pitch change - new note
    }

    // Within sustain tolerance - continue sustaining
    return false;
  }

  /**
   * Start tracking a new note
   */
  private startNewNote(midiNumber: number, timestamp: number): void {
    const roundedMidi = Math.round(midiNumber);
    console.log(`PitchStability: New note started - MIDI ${roundedMidi}`);

    this.currentStableNote = {
      midiNumber: roundedMidi,
      startTime: timestamp
    };
    this.lastEmittedMidi = roundedMidi;
  }

  /**
   * End the current note
   */
  private endCurrentNote(): void {
    if (this.currentStableNote) {
      const duration = Date.now() - this.currentStableNote.startTime;
      console.log(`PitchStability: Note ended - MIDI ${this.currentStableNote.midiNumber}, duration ${duration}ms`);
    }
    this.currentStableNote = null;
  }

  /**
   * Get the current stable note (if any)
   */
  getCurrentNote(): { midiNumber: number; startTime: number } | null {
    return this.currentStableNote;
  }

  /**
   * Reset all state (call when recording stops)
   */
  reset(): void {
    this.sampleHistory = [];
    this.currentStableNote = null;
    this.lastEmittedMidi = null;
    this.silenceStartTime = null;
    console.log('PitchStability: Reset');
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<PitchStabilityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PitchStabilityConfig {
    return { ...this.config };
  }

  /**
   * Get debug info about current state
   */
  getDebugInfo(): object {
    return {
      historyLength: this.sampleHistory.length,
      recentSamplesCount: this.getRecentSamples().length,
      currentNote: this.currentStableNote,
      lastEmitted: this.lastEmittedMidi,
      medianMidi: this.getMedianMidi(),
      medianFreq: this.getMedianFrequency(),
      avgConfidence: this.getAverageConfidence()
    };
  }
}
