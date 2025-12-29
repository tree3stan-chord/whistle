/**
 * Clean AudioService implementation with proper lifecycle management
 * Solves the AudioContext conflicts that plagued the vanilla JS version
 */
import { AutocorrelationPitchDetector } from './AutocorrelationPitchDetector.js';
import { SpeechService } from './SpeechService.js';
import { VocalIsolationProcessor } from './VocalIsolationProcessor.js';
import { TempoManager } from './TempoManager.js';
import { PitchStabilityProcessor } from './PitchStabilityProcessor.js';
import { audioStateActions } from '../stores/audioStore.js';
import type { AudioConfig, PitchDetectionResult } from './types.js';

export class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private pitchDetector: AutocorrelationPitchDetector | null = null;
  private speechService: SpeechService | null = null;
  private vocalIsolation: VocalIsolationProcessor | null = null;
  private pitchStabilityProcessor: PitchStabilityProcessor | null = null;
  private tempoManager: TempoManager;
  
  private animationFrameId: number | null = null;
  private isAnalyzing = false;
  private lastAnalysisTime = 0;
  private analysisInterval = 50; // Analyze every 50ms for stability

  // Noise floor tracking for phantom note prevention
  private noiseFloor = 0;
  private noiseFloorSamples: number[] = [];
  private readonly NOISE_FLOOR_WINDOW = 100; // samples to average for noise floor
  private readonly SIGNAL_TO_NOISE_RATIO = 1.5; // signal must be 50% louder than noise floor (lowered for debugging)

  // Pitch stability filtering to reduce jitter
  private pitchHistory: { frequency: number; confidence: number; timestamp: number }[] = [];
  private readonly PITCH_STABILITY_WINDOW = 5; // frames to consider for stability
  private readonly PITCH_STABILITY_TOLERANCE = 30; // Hz tolerance for "same" pitch
  private readonly MIN_STABLE_FRAMES = 3; // minimum frames before accepting a pitch (lowered for debugging)
  private readonly MIN_CONFIDENCE_FLOOR = 0.2; // minimum confidence to consider a pitch valid (lowered for debugging)
  
  private config: AudioConfig = {
    deviceId: null,
    sampleRate: 48000,
    bufferSize: 4096,  // Larger buffer for better frequency resolution
    minFrequency: 80,   // E2 (male low)
    maxFrequency: 800,  // G5 (optimal vocal range, prevents octave confusion)
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

    // Initialize pitch stability processor for smooth note detection
    // Tightened settings to filter transients - requires sustained pitch before emitting note
    this.pitchStabilityProcessor = new PitchStabilityProcessor({
      stabilityWindowMs: 300,      // 300ms window for stability checking
      minConfidence: 0.45,         // Reject low-confidence detections
      highConfidence: 0.7,         // High confidence for fast-path
      sustainTolerance: 1.5,       // 1.5 semitones tolerance for sustain
      changeThreshold: 2.0,        // 2 semitones to trigger new note
      minFramesForNewNote: 6       // Require ~300ms sustained pitch (6 * 50ms)
    });

    // SAFETY: Ensure analysis is stopped on initialization
    this.isAnalyzing = false;
    console.log('🔧 AudioService initialized - analysis STOPPED until startRecording()');
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

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser does not support microphone access. Please use a modern browser like Chrome, Firefox, or Edge.');
      }

      // Enumerate available audio devices first
      console.log('Enumerating audio devices...');
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        console.log('Available audio input devices:', audioInputs.map(d => ({
          deviceId: d.deviceId,
          label: d.label || '(unlabeled - permissions may be needed)',
          groupId: d.groupId
        })));

        if (audioInputs.length === 0) {
          throw new Error('No microphone detected. Please connect a microphone and try again.');
        }
      } catch (enumError) {
        console.warn('Could not enumerate devices (this is normal before permission grant):', enumError);
      }

      // Step 1: Get MediaStream with simple constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: this.config.deviceId ? { exact: this.config.deviceId } : undefined,
          echoCancellation: false,
          autoGainControl: true,  // Enable auto gain control for proper levels
          noiseSuppression: false
        }
      };

      console.log('Requesting microphone access with constraints:', constraints);
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
      this.gainNode.gain.setValueAtTime(2.0, this.audioContext.currentTime); // Moderate boost to avoid noise amplification
      
      // Step 4: Create MediaStreamSource and connect
      console.log('Creating MediaStreamSource...');
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Connect audio pipeline: microphone -> gain -> analyser
      this.microphone.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      
      console.log('Audio pipeline connected successfully!');
      
      // Step 5: Initialize autocorrelation pitch detector for accurate pitch tracking
      this.pitchDetector = new AutocorrelationPitchDetector(
        this.audioContext.sampleRate,
        this.config.bufferSize
      );
      
      // Step 6: Initialize vocal isolation processor with tuned parameters for voice detection
      this.vocalIsolation = new VocalIsolationProcessor(
        this.audioContext.sampleRate,
        this.config.bufferSize,
        {
          enabled: this.config.vocalIsolationEnabled,
          vad: {
            energyThreshold: 0.05, // Increased to reduce false positives
            minVoiceDuration: 150, // Longer minimum to avoid transients
            hangoverTime: 300 // Longer hangover for sustained notes
          },
          spectralSubtraction: {
            alpha: 1.5, // Reduced aggression
            beta: 0.1, // Higher floor to preserve vocal characteristics
            noiseUpdateRate: 0.03 // Slower adaptation to prevent voice suppression
          }
        }
      );
      
      // Update state
      audioStateActions.setInitialized(true);
      audioStateActions.setDeviceLabel(track.label);
      audioStateActions.setVocalIsolationEnabled(this.config.vocalIsolationEnabled);
      
      console.log('AudioService initialized successfully!');
      
    } catch (error) {
      let errorMessage = 'Unknown audio error';

      if (error instanceof Error) {
        // Provide user-friendly messages for common errors
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone permission denied. Please allow microphone access and try again.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Microphone is in use by another application. Please close other apps using the microphone.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Microphone constraints could not be satisfied. Try a different microphone.';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Microphone access blocked. This site must be served over HTTPS.';
        } else {
          errorMessage = error.message;
        }
      }

      console.error('AudioService initialization failed:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'unknown',
        message: errorMessage
      });

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
      console.log('❌ AudioService not initialized');
      throw new Error('AudioService not initialized');
    }

    console.log('🔍 AudioService: Pre-recording state check:', {
      hasAnalyser: !!this.analyser,
      hasPitchDetector: !!this.pitchDetector,
      analyserType: this.analyser?.constructor?.name,
      pitchDetectorType: this.pitchDetector?.constructor?.name
    });

    // SAFETY: Stop any existing analysis loop first
    this.stopAnalysis();

    console.log('🎤 AudioService: Starting recording with pitch detection');
    audioStateActions.setRecording(true);
    this.isAnalyzing = true;
    console.log('🔍 AudioService: About to start analysis loop with isAnalyzing:', this.isAnalyzing);
    this.startAnalysisLoop();
    console.log('🔄 AudioService: Analysis loop started');
    
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
    console.log('🛑 AudioService: Stopping recording');
    this.stopAnalysis();
    audioStateActions.setRecording(false);

    // Stop speech recognition
    if (this.speechService) {
      this.speechService.stop();
    }

    console.log('🛑 Recording stopped');
  }

  /**
   * Stop analysis loop and clear pitch results
   */
  private stopAnalysis(): void {
    this.isAnalyzing = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Reset pitch stability processor
    if (this.pitchStabilityProcessor) {
      this.pitchStabilityProcessor.reset();
    }

    // Clear any stale pitch results
    audioStateActions.setPitchResult(null);
    console.log('🛑 Analysis loop stopped and cleared');
  }

  // Debug counter for loop monitoring
  private loopCallCount = 0;

  /**
   * Analysis loop for real-time pitch detection
   */
  private startAnalysisLoop = (): void => {
    // DEBUG: Log every 100th call to see if loop is running
    this.loopCallCount++;
    if (this.loopCallCount % 100 === 1) {
      console.log('🔁 Analysis loop heartbeat, call #' + this.loopCallCount);
    }

    // SAFETY: Multiple checks to prevent runaway loops
    if (!this.isAnalyzing || !this.analyser || !this.pitchDetector) {
      console.log(`❌ Analysis loop stopped: analyzing=${this.isAnalyzing}, analyser=${!!this.analyser}, pitchDetector=${!!this.pitchDetector}`);
      console.log('❌ Analysis loop debug:', {
        isAnalyzing: this.isAnalyzing,
        hasAnalyser: !!this.analyser,
        hasPitchDetector: !!this.pitchDetector,
        analyserType: this.analyser?.constructor?.name,
        pitchDetectorType: this.pitchDetector?.constructor?.name
      });
      this.stopAnalysis(); // Ensure complete cleanup
      return;
    }

    const currentTime = Date.now();

    // Throttle analysis to prevent excessive processing
    if (currentTime - this.lastAnalysisTime >= this.analysisInterval) {
      this.lastAnalysisTime = currentTime;

      try {
      // Log every few seconds to show loop is running
      if (currentTime % 2000 < this.analysisInterval) {
        console.log('🔄 Analysis loop running - checking for pitch');
      }

      // Get time domain data
      const bufferLength = this.analyser!.fftSize;
      const dataArray = new Float32Array(bufferLength);
      this.analyser!.getFloatTimeDomainData(dataArray);

      // Calculate RMS to see actual signal level
      const rms = Math.sqrt(dataArray.reduce((sum, x) => sum + x * x, 0) / dataArray.length);
      const peak = Math.max(...dataArray.map(Math.abs));

      // Update noise floor calculation
      this.updateNoiseFloor(rms);

      // Check if signal is above noise floor threshold
      const signalAboveNoise = rms > (this.noiseFloor * this.SIGNAL_TO_NOISE_RATIO);

      // Log audio levels every 2 seconds
      if (currentTime % 2000 < this.analysisInterval) {
        console.log('🎵 Audio Levels:', {
          rms: rms.toFixed(6),
          peak: peak.toFixed(6),
          noiseFloor: this.noiseFloor.toFixed(6),
          signalAboveNoise: signalAboveNoise,
          snrRatio: (rms / this.noiseFloor).toFixed(2),
          rmsPct: (rms * 100).toFixed(2) + '%',
          peakPct: (peak * 100).toFixed(2) + '%'
        });
      }

      // Skip pitch detection if signal is not significantly above noise floor
      if (!signalAboveNoise) {
        // Clear any existing pitch result to stop phantom notes
        audioStateActions.setPitchResult(null);
        if (currentTime % 5000 < this.analysisInterval) {
          console.log('🔇 Signal below noise threshold, skipping pitch detection');
        }
        // Continue loop but skip pitch processing
        this.animationFrameId = requestAnimationFrame(this.startAnalysisLoop);
        return;
      }

      // Enable vocal isolation for voice activity detection
      let processedData = dataArray;
      let voiceActivity = 0;

      // TEMPORARILY DISABLED: Vocal isolation is broken (always returns 0 voice activity)
      // Skip straight to pitch detection using raw audio data
      console.log('🔊 Skipping vocal isolation (disabled for debugging), using raw audio');

      // TODO: Fix VocalIsolationProcessor - noiseProfileReady never becomes true
      // if (this.vocalIsolation && this.config.vocalIsolationEnabled) { ... }
      
      // Detect pitch using autocorrelation on time-domain data (or processed data if vocal isolation is enabled)
      console.log('🎤 Running pitch detection...');
      const rawPitchResult = this.pitchDetector!.detectPitch(processedData);
      console.log('🎤 Raw pitch result:', rawPitchResult);

      // GATE: Check raw confidence floor before any processing
      if (!rawPitchResult || rawPitchResult.confidence < this.MIN_CONFIDENCE_FLOOR) {
        // Process null through stability processor to track silence
        this.pitchStabilityProcessor?.process(null, 0, currentTime);
        audioStateActions.setPitchResult(null);
        if (currentTime % 2000 < this.analysisInterval) {
          console.log('🔍 AudioService: Low confidence or no pitch detected');
        }
        this.animationFrameId = requestAnimationFrame(this.startAnalysisLoop);
        return;
      }

      // Apply octave error correction
      const octaveCorrectedResult = this.correctOctaveErrors(rawPitchResult);

      // Process through PitchStabilityProcessor for median filtering and hysteresis
      const stableResult = this.pitchStabilityProcessor?.process(
        octaveCorrectedResult?.frequency ?? null,
        octaveCorrectedResult?.confidence ?? 0,
        currentTime
      );

      // Only emit if we have a stable pitch
      if (!stableResult) {
        audioStateActions.setPitchResult(null);
        if (currentTime % 2000 < this.analysisInterval) {
          console.log('🔍 AudioService: Waiting for pitch stability...');
        }
        this.animationFrameId = requestAnimationFrame(this.startAnalysisLoop);
        return;
      }

      // Convert stable result back to PitchDetectionResult format
      const finalPitchResult: PitchDetectionResult = {
        frequency: stableResult.frequency,
        confidence: stableResult.confidence,
        period: this.audioContext!.sampleRate / stableResult.frequency
      };

      // Log pitch detection results
      if (stableResult.isNewNote) {
        console.log('🎵 NEW NOTE:', {
          freq: stableResult.frequency.toFixed(1) + 'Hz',
          midi: stableResult.midiNumber,
          confidence: stableResult.confidence.toFixed(2)
        });
      } else if (currentTime % 2000 < this.analysisInterval) {
        console.log('🎯 Sustaining:', {
          freq: stableResult.frequency.toFixed(1) + 'Hz',
          duration: stableResult.sustainDurationMs + 'ms'
        });
      }

      // Update state with the stable pitch result
      audioStateActions.setPitchResult(finalPitchResult);

      } catch (error) {
        // Catch any errors in the analysis loop to prevent it from dying
        console.error('❌ Analysis loop error:', error);
      }
    }

    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.startAnalysisLoop);
  };

  /**
   * Detect and correct octave errors in pitch detection
   */
  private correctOctaveErrors(pitchResult: PitchDetectionResult | null): PitchDetectionResult | null {
    if (!pitchResult) return null;

    let correctedFrequency = pitchResult.frequency;

    // Check for common octave errors in vocal range
    // If frequency seems too high (above 600Hz), check if it's an octave up
    if (correctedFrequency > 600) {
      const octaveDown = correctedFrequency / 2;
      if (octaveDown >= this.config.minFrequency && octaveDown <= 400) {
        console.log(`🔧 Octave correction: ${correctedFrequency.toFixed(1)}Hz → ${octaveDown.toFixed(1)}Hz`);
        correctedFrequency = octaveDown;
      }
    }

    // If frequency seems too low (below 120Hz), check if it's an octave down
    if (correctedFrequency < 120) {
      const octaveUp = correctedFrequency * 2;
      if (octaveUp <= this.config.maxFrequency && octaveUp >= 150) {
        console.log(`🔧 Octave correction: ${correctedFrequency.toFixed(1)}Hz → ${octaveUp.toFixed(1)}Hz`);
        correctedFrequency = octaveUp;
      }
    }

    return {
      ...pitchResult,
      frequency: correctedFrequency
    };
  }

  /**
   * Apply pitch stability filtering to reduce jitter
   */
  private applyPitchStabilityFilter(pitchResult: PitchDetectionResult | null): PitchDetectionResult | null {
    const currentTime = Date.now();

    // If no pitch detected, clear history and return null
    if (!pitchResult) {
      this.pitchHistory = [];
      return null;
    }

    // Add current pitch to history
    this.pitchHistory.push({
      frequency: pitchResult.frequency,
      confidence: pitchResult.confidence,
      timestamp: currentTime
    });

    // Remove old entries (older than 1 second)
    this.pitchHistory = this.pitchHistory.filter(
      entry => currentTime - entry.timestamp < 1000
    );

    // Keep only recent frames for stability check
    const recentFrames = this.pitchHistory.slice(-this.PITCH_STABILITY_WINDOW);

    if (recentFrames.length < this.MIN_STABLE_FRAMES) {
      // Not enough history, don't return anything yet
      return null;
    }

    // Check if recent frames are stable (within tolerance)
    const referenceFreq = recentFrames[0].frequency;
    const isStable = recentFrames.every(frame =>
      Math.abs(frame.frequency - referenceFreq) <= this.PITCH_STABILITY_TOLERANCE
    );

    if (!isStable) {
      // Pitch is not stable, wait for stability
      return null;
    }

    // Calculate stable average frequency and confidence
    const avgFrequency = recentFrames.reduce((sum, frame) => sum + frame.frequency, 0) / recentFrames.length;
    const avgConfidence = recentFrames.reduce((sum, frame) => sum + frame.confidence, 0) / recentFrames.length;

    return {
      frequency: avgFrequency,
      confidence: avgConfidence,
      period: pitchResult.period // Use original period for now
    };
  }

  /**
   * Update noise floor calculation with rolling average
   */
  private updateNoiseFloor(currentRms: number): void {
    // Only update noise floor when recording is NOT active (during silence)
    // This prevents the noise floor from tracking actual vocal input
    if (!this.isAnalyzing) {
      this.noiseFloorSamples.push(currentRms);

      // Keep only the most recent samples
      if (this.noiseFloorSamples.length > this.NOISE_FLOOR_WINDOW) {
        this.noiseFloorSamples.shift();
      }

      // Calculate noise floor as the 10th percentile of recent samples
      // This helps ignore occasional loud sounds and focuses on baseline
      const sorted = [...this.noiseFloorSamples].sort((a, b) => a - b);
      const percentile10Index = Math.floor(sorted.length * 0.10);
      this.noiseFloor = sorted[percentile10Index] || 0.001; // minimum noise floor

      // Ensure minimum noise floor to prevent division by zero
      this.noiseFloor = Math.max(this.noiseFloor, 0.001);
    }

    // If we don't have a good noise floor yet, use a reasonable default
    if (this.noiseFloor < 0.001) {
      this.noiseFloor = 0.002; // Reasonable default for most environments
    }
  }

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

    // Reset noise floor tracking
    this.noiseFloor = 0;
    this.noiseFloorSamples = [];

    // Reset pitch stability tracking
    this.pitchHistory = [];
    
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
    
    // Autocorrelation detector doesn't need runtime config updates
    
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