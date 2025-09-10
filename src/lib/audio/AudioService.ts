/**
 * Clean AudioService implementation with proper lifecycle management
 * Solves the AudioContext conflicts that plagued the vanilla JS version
 */
import { YinPitchDetector } from './YinPitchDetector.js';
import { SpeechService } from './SpeechService.js';
import { VocalIsolationProcessor } from './VocalIsolationProcessor.js';
import { TempoManager } from './TempoManager.js';
import { audioStateActions } from '../stores/audioStore.js';
import type { AudioConfig, PitchDetectionResult } from './types.js';

export class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private pitchDetector: YinPitchDetector | null = null;
  private speechService: SpeechService | null = null;
  private vocalIsolation: VocalIsolationProcessor | null = null;
  private tempoManager: TempoManager;
  
  private animationFrameId: number | null = null;
  private isAnalyzing = false;
  
  private config: AudioConfig = {
    deviceId: null,
    sampleRate: 48000,
    bufferSize: 4096,
    minFrequency: 60,
    maxFrequency: 2000,
    vocalIsolationEnabled: true
  };

  constructor(config?: Partial<AudioConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Initialize tempo manager
    this.tempoManager = new TempoManager();
    
    // Initialize speech service
    this.speechService = new SpeechService();
    this.setupSpeechCallbacks();
  }

  /**
   * Setup speech recognition callbacks
   */
  private setupSpeechCallbacks(): void {
    if (!this.speechService) return;

    this.speechService.onResult = (result) => {
      audioStateActions.setSpeechResult(result);
      if (result.isFinal) {
        // Update transcript with final results
        audioStateActions.setSpeechTranscript(result.text);
      }
    };

    this.speechService.onStart = () => {
      audioStateActions.setSpeechListening(true);
    };

    this.speechService.onEnd = () => {
      audioStateActions.setSpeechListening(false);
    };

    this.speechService.onError = (error) => {
      console.error('Speech recognition error:', error);
      audioStateActions.setSpeechListening(false);
    };
  }

  /**
   * Initialize audio system - clean, no conflicts
   */
  async initialize(): Promise<void> {
    try {
      audioStateActions.setError(null);
      
      // Clean up any existing resources first
      await this.cleanup();
      
      // Step 1: Get MediaStream with simple constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: this.config.deviceId ? { exact: this.config.deviceId } : undefined,
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false
        }
      };
      
      console.log('Requesting microphone access...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const track = this.mediaStream.getAudioTracks()[0];
      const settings = track.getSettings();
      console.log('MediaStream acquired:', {
        label: track.label,
        sampleRate: settings.sampleRate
      });
      
      // Step 2: Create AudioContext (let it use default sample rate)
      console.log('Creating AudioContext...');
      this.audioContext = new AudioContext();
      
      // Resume if suspended (required by modern browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('AudioContext created:', {
        sampleRate: this.audioContext.sampleRate,
        state: this.audioContext.state
      });
      
      // Step 3: Create audio nodes
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.bufferSize;
      this.analyser.smoothingTimeConstant = 0; // No smoothing for pitch detection
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      
      // Step 4: Create MediaStreamSource and connect
      console.log('Creating MediaStreamSource...');
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Connect audio pipeline: microphone -> gain -> analyser
      this.microphone.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      
      console.log('Audio pipeline connected successfully!');
      
      // Step 5: Initialize pitch detector
      this.pitchDetector = new YinPitchDetector(
        this.audioContext.sampleRate,
        this.config.bufferSize,
        {
          minFreq: this.config.minFrequency,
          maxFreq: this.config.maxFrequency
        }
      );
      
      // Step 6: Initialize vocal isolation processor
      this.vocalIsolation = new VocalIsolationProcessor(
        this.audioContext.sampleRate,
        this.config.bufferSize,
        {
          enabled: this.config.vocalIsolationEnabled,
          vad: {
            energyThreshold: 0.02,
            minVoiceDuration: 100,
            hangoverTime: 200
          },
          spectralSubtraction: {
            alpha: 2.0,
            beta: 0.05,
            noiseUpdateRate: 0.05
          }
        }
      );
      
      // Update state
      audioStateActions.setInitialized(true);
      audioStateActions.setDeviceLabel(track.label);
      audioStateActions.setVocalIsolationEnabled(this.config.vocalIsolationEnabled);
      
      console.log('AudioService initialized successfully!');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown audio error';
      console.error('AudioService initialization failed:', errorMessage);
      audioStateActions.setError(errorMessage);
      await this.cleanup();
      throw new Error(`Audio initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Start recording and pitch analysis
   */
  async startRecording(): Promise<void> {
    if (!this.isInitialized()) {
      throw new Error('AudioService not initialized');
    }
    
    audioStateActions.setRecording(true);
    this.isAnalyzing = true;
    this.startAnalysisLoop();
    
    // Start speech recognition if available
    if (this.speechService && this.speechService.isAvailable()) {
      this.speechService.start();
      console.log('Speech recognition started');
    }
    
    console.log('Recording started');
  }

  /**
   * Stop recording
   */
  stopRecording(): void {
    audioStateActions.setRecording(false);
    this.isAnalyzing = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Stop speech recognition
    if (this.speechService) {
      this.speechService.stop();
    }
    
    console.log('Recording stopped');
  }

  /**
   * Analysis loop for real-time pitch detection
   */
  private startAnalysisLoop = (): void => {
    if (!this.isAnalyzing || !this.analyser || !this.pitchDetector) {
      console.log(`Analysis loop stopped: analyzing=${this.isAnalyzing}, analyser=${!!this.analyser}, pitchDetector=${!!this.pitchDetector}`);
      return;
    }
    
    // Debug: Log that analysis loop is running (very occasionally)
    if (Math.random() < 0.001) {
      console.log('Analysis loop running...');
    }
    
    // Get time domain data
    const bufferLength = this.analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(dataArray);
    
    // Apply vocal isolation if enabled
    let processedData = dataArray;
    if (this.vocalIsolation && this.config.vocalIsolationEnabled) {
      const isolationResult = this.vocalIsolation.process(dataArray, this.analyser);
      processedData = isolationResult.processedAudio;
      
      // Update vocal isolation state
      audioStateActions.setVocalIsolationReady(isolationResult.noiseProfileReady);
      audioStateActions.setVoiceActivity(isolationResult.vadResult.confidence);
    }
    
    // Detect pitch on processed audio
    const pitchResult = this.pitchDetector.detectPitch(processedData);
    
    // Debug: Log pitch results periodically
    if (Math.random() < 0.01) { // Log ~1% of results to avoid spam
      console.log(`AudioService pitch: freq=${pitchResult.frequency?.toFixed(1) || 'null'}Hz, conf=${pitchResult.confidence?.toFixed(3) || 'null'}`);
    }
    
    // Update state
    audioStateActions.setPitchResult(pitchResult);
    
    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.startAnalysisLoop);
  };

  /**
   * Clean shutdown of all audio resources
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up audio resources...');
    
    // Stop analysis loop
    this.isAnalyzing = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Disconnect audio nodes
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    // Reset pitch detector and vocal isolation
    this.pitchDetector = null;
    this.vocalIsolation = null;
    
    // Update state
    audioStateActions.reset();
    
    console.log('Audio cleanup complete');
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return !!(this.audioContext && this.analyser && this.pitchDetector);
  }

  /**
   * Get current audio level for metering
   */
  getCurrentLevel(): number {
    if (!this.analyser) return 0;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    return sum / bufferLength / 255; // Normalized to 0-1
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update pitch detector if it exists
    if (this.pitchDetector && (newConfig.minFrequency || newConfig.maxFrequency)) {
      this.pitchDetector.updateConfig({
        minFreq: newConfig.minFrequency,
        maxFreq: newConfig.maxFrequency
      });
    }
    
    // Update vocal isolation if it exists
    if (this.vocalIsolation && newConfig.vocalIsolationEnabled !== undefined) {
      this.vocalIsolation.setEnabled(newConfig.vocalIsolationEnabled);
      audioStateActions.setVocalIsolationEnabled(newConfig.vocalIsolationEnabled);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AudioConfig {
    return { ...this.config };
  }

  /**
   * Toggle vocal isolation on/off
   */
  setVocalIsolationEnabled(enabled: boolean): void {
    this.config.vocalIsolationEnabled = enabled;
    
    if (this.vocalIsolation) {
      this.vocalIsolation.setEnabled(enabled);
    }
    
    audioStateActions.setVocalIsolationEnabled(enabled);
    console.log(`Vocal isolation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Reset vocal isolation noise profile (useful when environment changes)
   */
  resetVocalIsolationProfile(): void {
    if (this.vocalIsolation) {
      this.vocalIsolation.resetNoiseProfile();
      audioStateActions.setVocalIsolationReady(false);
      console.log('Vocal isolation noise profile reset');
    }
  }

  /**
   * Get vocal isolation statistics
   */
  getVocalIsolationStats(): {
    enabled: boolean;
    ready: boolean;
    stats?: any;
  } {
    if (!this.vocalIsolation) {
      return { enabled: false, ready: false };
    }
    
    return {
      enabled: this.config.vocalIsolationEnabled,
      ready: this.vocalIsolation.isReady(),
      stats: this.vocalIsolation.getStats()
    };
  }

  /**
   * Get tempo manager instance
   */
  getTempoManager(): TempoManager {
    return this.tempoManager;
  }

  /**
   * Start recording timing (when user starts recording)
   */
  startRecordingTiming(): void {
    this.tempoManager.startTiming();
    console.log('Recording timing started');
  }

  /**
   * Reset timing (when user stops/resets recording)
   */
  resetTiming(): void {
    this.tempoManager.reset();
    console.log('Recording timing reset');
  }
}