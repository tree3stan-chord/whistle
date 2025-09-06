// Audio processing type definitions

export interface PitchDetectionResult {
  frequency: number;
  confidence: number;
  period: number;
}

export interface AudioConfig {
  deviceId?: string | null;
  sampleRate: number;
  bufferSize: number;
  minFrequency: number;
  maxFrequency: number;
}

export interface AudioState {
  isRecording: boolean;
  isInitialized: boolean;
  currentFrequency: number | null;
  currentConfidence: number;
  error: string | null;
  deviceLabel: string | null;
}

export interface YinConfig {
  threshold: number;
  probabilityThreshold: number;
  minFreq: number;
  maxFreq: number;
}