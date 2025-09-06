/**
 * Speech Recognition Service for capturing lyrics while singing
 * Uses Web Speech API for real-time speech-to-text
 */

export interface SpeechResult {
  text: string;
  confidence: number;
  timestamp: number;
  isFinal: boolean;
}

export interface SpeechWord {
  word: string;
  confidence: number;
  startTime: number;
  endTime?: number;
}

export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private currentTranscript = '';
  
  // Callbacks for speech events
  onResult?: (result: SpeechResult) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;

  constructor() {
    // Check for Web Speech API support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    // Use prefixed version for Chrome/Safari compatibility
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition;
    
    this.recognition = new SpeechRecognition();
    this.setupRecognition();
  }

  private setupRecognition(): void {
    if (!this.recognition) return;

    // Configuration for continuous vocal transcription
    this.recognition.continuous = true;           // Keep listening
    this.recognition.interimResults = true;       // Get partial results
    this.recognition.maxAlternatives = 1;         // One best guess
    this.recognition.lang = 'en-US';             // Default to English

    // Event handlers
    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      this.onStart?.();
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isListening = false;
      this.onEnd?.();
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      this.onError?.(event.error);
    };

    this.recognition.onresult = (event) => {
      this.processResults(event);
    };
  }

  private processResults(event: SpeechRecognitionEvent): void {
    let interimTranscript = '';
    let finalTranscript = '';

    // Process all results from this recognition session
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence || 0.9;

      if (result.isFinal) {
        finalTranscript += transcript;
        console.log('Final speech result:', transcript);
        
        this.onResult?.({
          text: transcript.trim(),
          confidence,
          timestamp: Date.now(),
          isFinal: true
        });
      } else {
        interimTranscript += transcript;
        
        // Send interim results for real-time display
        this.onResult?.({
          text: transcript.trim(),
          confidence: confidence * 0.7, // Lower confidence for interim
          timestamp: Date.now(),
          isFinal: false
        });
      }
    }

    // Update current transcript
    if (finalTranscript) {
      this.currentTranscript = finalTranscript;
    }
  }

  /**
   * Start speech recognition
   */
  start(): void {
    if (!this.recognition) {
      this.onError?.('Speech recognition not available');
      return;
    }

    if (this.isListening) {
      console.warn('Speech recognition already running');
      return;
    }

    try {
      this.currentTranscript = '';
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.onError?.('Failed to start speech recognition');
    }
  }

  /**
   * Stop speech recognition
   */
  stop(): void {
    if (!this.recognition || !this.isListening) {
      return;
    }

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }

  /**
   * Check if speech recognition is available
   */
  isAvailable(): boolean {
    return this.recognition !== null;
  }

  /**
   * Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Get current transcript
   */
  getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  /**
   * Set language for recognition
   */
  setLanguage(lang: string): void {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  /**
   * Clear current transcript
   */
  clearTranscript(): void {
    this.currentTranscript = '';
  }
}