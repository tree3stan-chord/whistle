/**
 * Vocal Speech-to-Text Engine
 * Specialized STT system optimized for sung vocals with syllable-level timing
 * Integrates Web Speech API with fallback phoneme detection
 */

class VocalSTTEngine {
    constructor(audioHandler) {
        this.audioHandler = audioHandler;
        this.recognition = null;
        this.isListening = false;
        this.currentLanguage = 'en-US';
        this.confidence = 0;
        
        // Syllable and timing data
        this.syllableBuffer = [];
        this.wordBuffer = [];
        this.timingBuffer = [];
        
        // Recognition settings optimized for singing
        this.recognitionConfig = {
            continuous: true,
            interimResults: true,
            maxAlternatives: 3,
            grammars: null // Will be populated with vocal-specific grammar
        };
        
        // Language detection patterns
        this.languagePatterns = {
            'en-US': /^[a-zA-Z\s\'\-\.]+$/,
            'it-IT': /^[a-zA-ZàáèéìíòóùúÀÁÈÉÌÍÒÓÙÚ\s\'\-\.]+$/,
            'de-DE': /^[a-zA-ZäöüßÄÖÜ\s\'\-\.]+$/,
            'fr-FR': /^[a-zA-ZàâäçéèêëïîôùûüÿÀÂÄÇÉÈÊËÏÎÔÙÛÜŸ\s\'\-\.]+$/,
            'es-ES': /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s\'\-\.]+$/
        };
        
        // Vocal-specific adaptations
        this.vocalAdaptations = {
            melismaThreshold: 0.3, // seconds - multiple notes per syllable
            breathPauseThreshold: 0.5, // seconds
            vibratoTolerance: 0.1, // frequency variance tolerance
            sustainedVowelMinDuration: 0.8 // seconds
        };
        
        this.initializeRecognition();
    }
    
    initializeRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition not supported, falling back to phoneme detection');
            this.useOfflineFallback = true;
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure for vocal recognition
        this.recognition.continuous = this.recognitionConfig.continuous;
        this.recognition.interimResults = this.recognitionConfig.interimResults;
        this.recognition.maxAlternatives = this.recognitionConfig.maxAlternatives;
        this.recognition.lang = this.currentLanguage;
        
        this.setupRecognitionHandlers();
        console.log('Vocal STT Engine initialized with Web Speech API');
    }
    
    setupRecognitionHandlers() {
        this.recognition.onstart = () => {
            console.log('Vocal recognition started');
            this.isListening = true;
        };
        
        this.recognition.onresult = (event) => {
            this.handleRecognitionResult(event);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'network') {
                console.log('Network error, switching to offline mode');
                this.useOfflineFallback = true;
            }
        };
        
        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            this.isListening = false;
            
            // Restart recognition if still needed
            if (this.shouldContinueListening) {
                setTimeout(() => this.startRecognition(), 100);
            }
        };
    }
    
    handleRecognitionResult(event) {
        const timestamp = performance.now();
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            const confidence = result[0].confidence || 0.5;
            const isFinal = result.isFinal;
            
            console.log(`Recognition result: "${transcript}" (confidence: ${confidence}, final: ${isFinal})`);
            
            if (isFinal) {
                this.processFinalTranscript(transcript, confidence, timestamp);
            } else {
                this.processInterimTranscript(transcript, confidence, timestamp);
            }
        }
    }
    
    processFinalTranscript(transcript, confidence, timestamp) {
        const words = this.parseTranscriptIntoWords(transcript);
        const syllables = this.extractSyllables(words);
        
        // Store with timing information
        this.wordBuffer.push({
            transcript,
            confidence,
            timestamp,
            words,
            syllables,
            isFinal: true
        });
        
        // Trigger alignment with pitch data
        this.alignWithPitchEvents(syllables, timestamp);
    }
    
    processInterimTranscript(transcript, confidence, timestamp) {
        // Use interim results for real-time feedback
        const event = new CustomEvent('interim-transcript', {
            detail: { transcript, confidence, timestamp }
        });
        document.dispatchEvent(event);
    }
    
    parseTranscriptIntoWords(transcript) {
        // Clean and split transcript
        const cleaned = transcript.trim().toLowerCase();
        const words = cleaned.split(/\s+/).filter(word => word.length > 0);
        
        return words.map(word => ({
            text: word,
            syllables: this.syllabify(word),
            estimated_duration: this.estimateWordDuration(word)
        }));
    }
    
    syllabify(word) {
        // Enhanced syllabification algorithm for singing
        // This is a simplified version - could be enhanced with linguistic rules
        const vowels = 'aeiouAEIOUàáèéìíòóùúÀÁÈÉÌÍÒÓÙÚäöüÄÖÜâêîôûÂÊÎÔÛ';
        const syllables = [];
        let currentSyllable = '';
        let lastWasVowel = false;
        
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            const isVowel = vowels.includes(char);
            
            if (isVowel && lastWasVowel && currentSyllable.length > 1) {
                // Vowel cluster - split here
                syllables.push(currentSyllable);
                currentSyllable = char;
            } else if (isVowel && !lastWasVowel && currentSyllable.length > 0) {
                // Consonant to vowel transition
                if (currentSyllable.length > 1) {
                    syllables.push(currentSyllable.slice(0, -1));
                    currentSyllable = currentSyllable.slice(-1) + char;
                } else {
                    currentSyllable += char;
                }
            } else {
                currentSyllable += char;
            }
            
            lastWasVowel = isVowel;
        }
        
        if (currentSyllable.length > 0) {
            syllables.push(currentSyllable);
        }
        
        return syllables.length > 0 ? syllables : [word];
    }
    
    estimateWordDuration(word) {
        // Estimate duration based on syllable count and complexity
        const syllableCount = this.syllabify(word).length;
        const baseTimePerSyllable = 0.4; // seconds
        const complexityFactor = word.length / syllableCount;
        
        return syllableCount * baseTimePerSyllable * Math.max(1, complexityFactor * 0.2);
    }
    
    extractSyllables(words) {
        const syllables = [];
        let cumulativeTime = 0;
        
        words.forEach(word => {
            word.syllables.forEach((syllable, index) => {
                syllables.push({
                    text: syllable,
                    word: word.text,
                    wordIndex: words.indexOf(word),
                    syllableIndex: index,
                    estimatedStartTime: cumulativeTime,
                    estimatedDuration: word.estimated_duration / word.syllables.length,
                    isWordStart: index === 0,
                    isWordEnd: index === word.syllables.length - 1
                });
                
                cumulativeTime += word.estimated_duration / word.syllables.length;
            });
        });
        
        return syllables;
    }
    
    alignWithPitchEvents(syllables, transcriptTimestamp) {
        // This will be connected to the forensic analyzer's pitch events
        // For now, emit an event that the integration layer can handle
        const alignmentEvent = new CustomEvent('syllable-alignment-needed', {
            detail: {
                syllables,
                transcriptTimestamp,
                requestAlignment: true
            }
        });
        document.dispatchEvent(alignmentEvent);
    }
    
    async transcribeVocal(audioBuffer, pitchEvents = null) {
        // Main transcription method that can be called externally
        if (!this.recognition && !this.useOfflineFallback) {
            throw new Error('Speech recognition not available');
        }
        
        if (this.useOfflineFallback) {
            return this.transcribeOffline(audioBuffer, pitchEvents);
        }
        
        // Start real-time transcription if not already running
        if (!this.isListening) {
            this.startRecognition();
        }
        
        // Return current buffer state for immediate results
        return this.getCurrentTranscriptionState(pitchEvents);
    }
    
    async transcribeOffline(audioBuffer, pitchEvents) {
        // Fallback phoneme detection for offline use
        console.log('Using offline phoneme detection...');
        
        // Simplified phoneme detection - would be enhanced with actual DSP
        const estimatedSyllables = Math.max(1, Math.floor(audioBuffer.length / 22050)); // Rough estimate
        
        return {
            lyrics: [{
                word: "[Humming]", // Placeholder for offline detection
                syllables: Array(estimatedSyllables).fill("hm"),
                timing: Array(estimatedSyllables).fill(0).map((_, i) => i * 0.5),
                noteIndices: pitchEvents ? pitchEvents.map((_, i) => i) : [0],
                confidence: 0.3,
                offline: true
            }],
            language: 'unknown',
            wordBoundaries: [0, audioBuffer.length / 44100], // Convert to seconds
            confidence: 0.3,
            method: 'offline_phoneme'
        };
    }
    
    getCurrentTranscriptionState(pitchEvents) {
        // Return current state of transcription buffer
        if (this.wordBuffer.length === 0) {
            return {
                lyrics: [],
                language: this.currentLanguage,
                wordBoundaries: [],
                confidence: 0,
                status: 'listening'
            };
        }
        
        const latestTranscript = this.wordBuffer[this.wordBuffer.length - 1];
        
        return {
            lyrics: latestTranscript.words.map(word => ({
                word: word.text,
                syllables: word.syllables,
                timing: [], // Will be populated by alignment system
                noteIndices: [], // Will be populated by alignment system
                confidence: latestTranscript.confidence,
                estimated_duration: word.estimated_duration
            })),
            language: this.currentLanguage,
            wordBoundaries: this.estimateWordBoundaries(latestTranscript),
            confidence: latestTranscript.confidence,
            status: this.isListening ? 'active' : 'inactive'
        };
    }
    
    estimateWordBoundaries(transcript) {
        // Estimate word boundaries based on timing
        const boundaries = [];
        let currentTime = 0;
        
        transcript.words.forEach(word => {
            boundaries.push(currentTime);
            currentTime += word.estimated_duration;
        });
        boundaries.push(currentTime); // Final boundary
        
        return boundaries;
    }
    
    startRecognition() {
        if (this.recognition && !this.isListening) {
            this.shouldContinueListening = true;
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Failed to start recognition:', error);
            }
        }
    }
    
    stopRecognition() {
        this.shouldContinueListening = false;
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    setLanguage(language) {
        this.currentLanguage = language;
        if (this.recognition) {
            this.recognition.lang = language;
        }
        console.log(`STT language set to: ${language}`);
    }
    
    detectLanguage(text) {
        // Auto-detect language from text patterns
        for (const [lang, pattern] of Object.entries(this.languagePatterns)) {
            if (pattern.test(text)) {
                return lang;
            }
        }
        return 'en-US'; // Default fallback
    }
    
    clearBuffer() {
        this.syllableBuffer = [];
        this.wordBuffer = [];
        this.timingBuffer = [];
    }
    
    getRecognitionStatus() {
        return {
            isListening: this.isListening,
            language: this.currentLanguage,
            bufferSize: this.wordBuffer.length,
            useOfflineFallback: this.useOfflineFallback || false,
            supported: !!this.recognition || this.useOfflineFallback
        };
    }
}