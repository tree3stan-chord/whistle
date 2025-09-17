/**
 * Unified Score Configuration System
 * Single source of truth for all staff, tempo, layout, and rendering settings
 * Replaces magic numbers with configurable values
 */

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface KeySignature {
  key: string; // e.g., 'C', 'G', 'F', 'D', etc.
  mode: 'major' | 'minor';
  sharps: number; // positive for sharps, negative for flats
  accidentals: string[]; // e.g., ['F#', 'C#'] for G major
}

export interface StaffLayoutConfig {
  // Staff line configuration
  linesPerStaff: number;
  lineSpacing: number;
  staffMargin: number;
  staffLineHeight: number;

  // Measure configuration
  measuresPerStaffLine: number;
  beatsPerMeasure: number; // from time signature, but cached here
  showBarlines: boolean;
  showMeasureNumbers: boolean;

  // Note layout
  defaultNoteSpacing: number;
  noteRadius: number;
  maxNotesPerLine: number;

  // Typography
  clefFontSize: number;
  noteNameFontSize: number;
  measureNumberFontSize: number;
}

export interface RenderingConfig {
  // Canvas dimensions
  baseWidth: number;
  baseHeight: number;

  // Responsive scaling
  minScaleFactor: number;
  maxScaleFactor: number;
  scaleReduction: number; // percentage to reduce for better fit

  // Animation
  pitchProcessInterval: number;
  playheadUpdateInterval: number;

  // Sustain detection
  pitchTolerance: number;
  minSustainDuration: number;
  confidenceThreshold: number;
}

export interface TempoConfig {
  bpm: number;
  timeSignature: TimeSignature;
  subdivision: 'eighth' | 'sixteenth';
  quantizeToGrid: boolean;
}

export interface ScoreConfig {
  tempo: TempoConfig;
  keySignature: KeySignature;
  staffLayout: StaffLayoutConfig;
  rendering: RenderingConfig;
}

/**
 * Default configuration values - replaces all magic numbers
 */
export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  tempo: {
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'eighth',
    quantizeToGrid: true
  },

  keySignature: {
    key: 'C',
    mode: 'major',
    sharps: 0,
    accidentals: []
  },

  staffLayout: {
    linesPerStaff: 5,
    lineSpacing: 12,
    staffMargin: 50,
    staffLineHeight: 120,

    measuresPerStaffLine: 4,
    beatsPerMeasure: 4, // will sync with timeSignature.numerator
    showBarlines: true,
    showMeasureNumbers: true,

    defaultNoteSpacing: 20,
    noteRadius: 4,
    maxNotesPerLine: 16, // fallback when not using measures

    clefFontSize: 32,
    noteNameFontSize: 8,
    measureNumberFontSize: 12
  },

  rendering: {
    baseWidth: 1200,
    baseHeight: 600,

    minScaleFactor: 0.5,
    maxScaleFactor: 2.0,
    scaleReduction: 0.15, // 15% reduction for better fit

    pitchProcessInterval: 50,
    playheadUpdateInterval: 50,

    pitchTolerance: 50,
    minSustainDuration: 300,
    confidenceThreshold: 0.4
  }
};

/**
 * Time Translation Utilities
 * Critical for accurate note placement and sustain handling
 */
export interface TimePosition {
  absoluteMs: number;      // Time from recording start
  beat: number;           // Beat position (decimal)
  measure: number;        // Measure number
  beatInMeasure: number;  // Beat within current measure (1-based)
  staffLine: number;      // Which staff line this falls on
  pixelX: number;         // X coordinate for rendering
  pixelY: number;         // Y coordinate for rendering
}

export interface SustainState {
  isActive: boolean;
  startTime: number;
  currentDuration: number;
  noteValue: string;
  confidenceHistory: number[];
}

/**
 * Score Configuration Manager
 * Handles configuration updates and ensures consistency
 * CRITICAL: Provides unified time translation for note placement and sustain
 */
export class ScoreConfigManager {
  private config: ScoreConfig;
  private listeners: Array<(config: ScoreConfig) => void> = [];

  constructor(initialConfig: Partial<ScoreConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_SCORE_CONFIG, initialConfig);
    this.ensureConsistency();
  }

  /**
   * Get the current configuration
   */
  getConfig(): ScoreConfig {
    return { ...this.config };
  }

  /**
   * Update tempo settings
   */
  updateTempo(tempoUpdate: Partial<TempoConfig>): void {
    this.config.tempo = { ...this.config.tempo, ...tempoUpdate };

    // Sync beats per measure with time signature
    if (tempoUpdate.timeSignature) {
      this.config.staffLayout.beatsPerMeasure = tempoUpdate.timeSignature.numerator;
    }

    this.ensureConsistency();
    this.notifyListeners();
  }

  /**
   * Update key signature
   */
  updateKeySignature(keyUpdate: Partial<KeySignature>): void {
    this.config.keySignature = { ...this.config.keySignature, ...keyUpdate };
    this.ensureConsistency();
    this.notifyListeners();
  }

  /**
   * Update staff layout
   */
  updateStaffLayout(layoutUpdate: Partial<StaffLayoutConfig>): void {
    this.config.staffLayout = { ...this.config.staffLayout, ...layoutUpdate };
    this.ensureConsistency();
    this.notifyListeners();
  }

  /**
   * Update rendering settings
   */
  updateRendering(renderingUpdate: Partial<RenderingConfig>): void {
    this.config.rendering = { ...this.config.rendering, ...renderingUpdate };
    this.ensureConsistency();
    this.notifyListeners();
  }

  /**
   * Update time signature to sync with TempoManager
   */
  updateTimeSignature(numerator: number, denominator: number): void {
    this.config.timeSignature.numerator = numerator;
    this.config.timeSignature.denominator = denominator;
    this.config.staffLayout.beatsPerMeasure = numerator; // Sync staff layout
    this.ensureConsistency();
    this.notifyListeners();
  }

  /**
   * Calculate derived values for rendering
   */
  getCalculatedValues() {
    const { tempo, staffLayout, rendering } = this.config;

    return {
      // Beat timing
      beatDurationMs: (60 * 1000) / tempo.bpm,
      measureDurationMs: ((60 * 1000) / tempo.bpm) * tempo.timeSignature.numerator,

      // Layout calculations
      notesPerStaffLine: staffLayout.measuresPerStaffLine * staffLayout.beatsPerMeasure,
      totalStaffWidth: (staffLayout.defaultNoteSpacing * staffLayout.measuresPerStaffLine * staffLayout.beatsPerMeasure),

      // Grid positions
      beatSpacing: (rendering.baseWidth - (staffLayout.staffMargin * 2)) /
                   (staffLayout.measuresPerStaffLine * staffLayout.beatsPerMeasure),
      measureWidth: (rendering.baseWidth - (staffLayout.staffMargin * 2)) /
                    staffLayout.measuresPerStaffLine
    };
  }

  /**
   * Get staff line Y position for a given line index
   */
  getStaffY(lineIndex: number): number {
    return 150 + (lineIndex * this.config.staffLayout.staffLineHeight);
  }

  /**
   * CRITICAL: Convert timestamp to complete time position
   * This is the single source of truth for time→position translation
   */
  timestampToPosition(timestampMs: number, recordingStartMs: number, staffWidth: number): TimePosition {
    const { tempo, staffLayout } = this.config;
    const absoluteMs = timestampMs - recordingStartMs;

    // Calculate beat position (decimal)
    const beatDurationMs = (60 * 1000) / tempo.bpm;
    const beat = absoluteMs / beatDurationMs;

    // Calculate measure and beat within measure
    const measure = Math.floor(beat / tempo.timeSignature.numerator) + 1;
    const beatInMeasure = (beat % tempo.timeSignature.numerator) + 1;

    // Calculate which staff line
    const measureIndex = measure - 1;
    const staffLine = Math.floor(measureIndex / staffLayout.measuresPerStaffLine);

    // Calculate pixel positions
    const pixelY = this.getStaffY(staffLine);
    const pixelX = this.beatToPixelX(beat, staffWidth, staffLine);

    return {
      absoluteMs,
      beat,
      measure,
      beatInMeasure,
      staffLine,
      pixelX,
      pixelY
    };
  }

  /**
   * Convert beat position to pixel X coordinate using unified layout
   */
  beatToPixelX(beat: number, staffWidth: number, staffLine: number): number {
    const { staffLayout } = this.config;
    const layout = this.getLayoutCalculations(staffWidth);

    // Calculate which measure on the current staff line
    const beatsPerStaffLine = staffLayout.measuresPerStaffLine * staffLayout.beatsPerMeasure;
    const beatOnLine = beat - (staffLine * beatsPerStaffLine);

    const measureOnLine = Math.floor(beatOnLine / staffLayout.beatsPerMeasure);
    const beatInMeasure = beatOnLine % staffLayout.beatsPerMeasure;

    return layout.staffStart + (measureOnLine * layout.measureWidth) + (beatInMeasure * layout.beatSpacing);
  }

  /**
   * CRITICAL: Convert pixel position back to time
   * Essential for click-to-time functionality
   */
  pixelToTimestamp(pixelX: number, pixelY: number, staffWidth: number, recordingStartMs: number): number {
    const staffLine = this.pixelYToStaffLine(pixelY);
    const beat = this.pixelXToBeat(pixelX, staffWidth, staffLine);

    const beatDurationMs = (60 * 1000) / this.config.tempo.bpm;
    const absoluteMs = beat * beatDurationMs;

    return recordingStartMs + absoluteMs;
  }

  /**
   * CRITICAL: Calculate note value from duration with sustain awareness
   */
  calculateNoteValueForSustain(durationMs: number, confidence: number): string {
    const { tempo, rendering } = this.config;
    const beatDurationMs = (60 * 1000) / tempo.bpm;
    const ratio = durationMs / beatDurationMs;

    // Confidence-based thresholds
    const minDurationForValue = confidence > 0.7 ? 0.8 : 1.0;

    if (ratio >= 3.0 * minDurationForValue) return 'whole';
    if (ratio >= 1.5 * minDurationForValue) return 'half';
    if (ratio >= 0.6 * minDurationForValue) return 'quarter';
    if (ratio >= 0.3 * minDurationForValue) return 'eighth';
    return 'sixteenth';
  }

  /**
   * CRITICAL: Manage sustain state transitions
   */
  updateSustainState(currentState: SustainState, newTimestamp: number, confidence: number): SustainState {
    if (!currentState.isActive) {
      // Start new sustain
      return {
        isActive: true,
        startTime: newTimestamp,
        currentDuration: 0,
        noteValue: 'eighth', // Start with shortest
        confidenceHistory: [confidence]
      };
    }

    // Update existing sustain
    const currentDuration = newTimestamp - currentState.startTime;
    const noteValue = this.calculateNoteValueForSustain(currentDuration, confidence);

    return {
      ...currentState,
      currentDuration,
      noteValue,
      confidenceHistory: [...currentState.confidenceHistory.slice(-10), confidence] // Keep last 10
    };
  }

  /**
   * Helper: Convert pixel Y to staff line index
   */
  private pixelYToStaffLine(pixelY: number): number {
    return Math.round((pixelY - 150) / this.config.staffLayout.staffLineHeight);
  }

  /**
   * Helper: Convert pixel X to beat position on specific staff line
   */
  private pixelXToBeat(pixelX: number, staffWidth: number, staffLine: number): number {
    const { staffLayout } = this.config;
    const layout = this.getLayoutCalculations(staffWidth);

    const xFromStaffStart = pixelX - layout.staffStart;
    const beatOnLine = xFromStaffStart / layout.beatSpacing;

    const beatsPerStaffLine = staffLayout.measuresPerStaffLine * staffLayout.beatsPerMeasure;
    return (staffLine * beatsPerStaffLine) + beatOnLine;
  }

  /**
   * Get unified layout calculations for consistent positioning
   */
  getLayoutCalculations(staffWidth: number): {
    clefSpace: number;
    staffStart: number;
    staffEnd: number;
    availableWidth: number;
    measureWidth: number;
    beatSpacing: number;
  } {
    const { staffLayout } = this.config;
    const clefSpace = staffLayout.clefFontSize * 1.5;
    const staffStart = staffLayout.staffMargin + clefSpace;
    const staffEnd = staffWidth - staffLayout.staffMargin;
    const availableWidth = staffEnd - staffStart;
    const measureWidth = availableWidth / staffLayout.measuresPerStaffLine;
    const beatSpacing = measureWidth / staffLayout.beatsPerMeasure;

    return {
      clefSpace,
      staffStart,
      staffEnd,
      availableWidth,
      measureWidth,
      beatSpacing
    };
  }

  /**
   * Get measure positions for barlines
   */
  getMeasurePositions(staffWidth: number): number[] {
    const { staffLayout } = this.config;
    const layout = this.getLayoutCalculations(staffWidth);
    const positions: number[] = [];

    for (let i = 1; i <= staffLayout.measuresPerStaffLine; i++) {
      positions.push(layout.staffStart + (i * layout.measureWidth));
    }

    return positions;
  }

  /**
   * Subscribe to configuration changes
   */
  onChange(listener: (config: ScoreConfig) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_SCORE_CONFIG };
    this.ensureConsistency();
    this.notifyListeners();
  }

  /**
   * Export configuration for persistence
   */
  export(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  import(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      this.config = this.mergeConfig(DEFAULT_SCORE_CONFIG, importedConfig);
      this.ensureConsistency();
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to import score configuration:', error);
      throw new Error('Invalid configuration format');
    }
  }

  /**
   * Ensure configuration consistency and validation
   */
  private ensureConsistency(): void {
    // Sync beats per measure with time signature
    this.config.staffLayout.beatsPerMeasure = this.config.tempo.timeSignature.numerator;

    // Validate BPM range
    this.config.tempo.bpm = Math.max(40, Math.min(200, this.config.tempo.bpm));

    // Validate time signature
    if (this.config.tempo.timeSignature.numerator < 1) {
      this.config.tempo.timeSignature.numerator = 4;
    }
    if (![2, 4, 8, 16].includes(this.config.tempo.timeSignature.denominator)) {
      this.config.tempo.timeSignature.denominator = 4;
    }

    // Validate measures per line
    this.config.staffLayout.measuresPerStaffLine = Math.max(1, Math.min(8, this.config.staffLayout.measuresPerStaffLine));
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(base: ScoreConfig, update: Partial<ScoreConfig>): ScoreConfig {
    return {
      tempo: { ...base.tempo, ...update.tempo },
      keySignature: { ...base.keySignature, ...update.keySignature },
      staffLayout: { ...base.staffLayout, ...update.staffLayout },
      rendering: { ...base.rendering, ...update.rendering }
    };
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.config));
  }
}

// Global configuration instance
export const scoreConfig = new ScoreConfigManager();