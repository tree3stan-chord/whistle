/**
 * Reactive audio state management with Svelte stores
 */
import { writable, derived, type Readable } from 'svelte/store';
import type { AudioState, PitchDetectionResult, AudioConfig } from '../audio/types.js';
import type { SpeechResult } from '../audio/SpeechService.js';

// Core audio state
export const audioState = writable<AudioState>({
  isRecording: false,
  isInitialized: false,
  currentFrequency: null,
  currentConfidence: 0,
  error: null,
  deviceLabel: null
});

// Audio configuration
export const audioConfig = writable<AudioConfig>({
  deviceId: null,
  sampleRate: 48000,
  bufferSize: 4096,
  minFrequency: 60,
  maxFrequency: 2000
});

// Current pitch detection result
export const pitchResult = writable<PitchDetectionResult | null>(null);

// Speech recognition state
export const speechResult = writable<SpeechResult | null>(null);
export const speechTranscript = writable<string>('');
export const isSpeechListening = writable<boolean>(false);

// Derived stores for convenience
export const isRecording: Readable<boolean> = derived(
  audioState,
  ($audioState) => $audioState.isRecording
);

export const isInitialized: Readable<boolean> = derived(
  audioState,
  ($audioState) => $audioState.isInitialized
);

export const currentFrequency: Readable<number | null> = derived(
  pitchResult,
  ($pitchResult) => $pitchResult?.frequency ?? null
);

export const currentConfidence: Readable<number> = derived(
  pitchResult,
  ($pitchResult) => $pitchResult?.confidence ?? 0
);

// Helper functions for updating state
export const audioStateActions = {
  setRecording(recording: boolean) {
    audioState.update(state => ({ ...state, isRecording: recording }));
  },
  
  setInitialized(initialized: boolean) {
    audioState.update(state => ({ ...state, isInitialized: initialized }));
  },
  
  setError(error: string | null) {
    audioState.update(state => ({ ...state, error }));
  },
  
  setDeviceLabel(deviceLabel: string | null) {
    audioState.update(state => ({ ...state, deviceLabel }));
  },
  
  setPitchResult(result: PitchDetectionResult | null) {
    pitchResult.set(result);
    audioState.update(state => ({
      ...state,
      currentFrequency: result?.frequency ?? null,
      currentConfidence: result?.confidence ?? 0
    }));
  },
  
  setSpeechResult(result: SpeechResult | null) {
    speechResult.set(result);
  },
  
  setSpeechTranscript(transcript: string) {
    speechTranscript.set(transcript);
  },
  
  setSpeechListening(listening: boolean) {
    isSpeechListening.set(listening);
  },
  
  reset() {
    audioState.set({
      isRecording: false,
      isInitialized: false,
      currentFrequency: null,
      currentConfidence: 0,
      error: null,
      deviceLabel: null
    });
    pitchResult.set(null);
    speechResult.set(null);
    speechTranscript.set('');
    isSpeechListening.set(false);
  }
};