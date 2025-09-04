class AudioHandler {
    constructor() {
        this.audioContext = null;
        this.microphone = null;
        this.analyser = null;
        this.mediaStream = null;
    }
    
    async initialize() {
        try {
            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    sampleRate: 44100
                }
            });
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create harmonic filter for vocal processing (this creates the analyser internally)
            this.harmonicFilter = new HarmonicFilter(this.audioContext, this.audioContext.sampleRate);
            
            // Connect audio pipeline: microphone -> harmonic filter -> analyser
            this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.harmonicFilter.connectInput(this.microphone);
            
            // Create signal conditioner with fixed buffer size (matches HarmonicFilter's 4096 fftSize)
            this.signalConditioner = new SignalConditioner(this.audioContext.sampleRate, 4096);
            
            console.log('Audio initialized successfully');
            console.log('Sample rate:', this.audioContext.sampleRate);
            console.log('FFT size:', this.analyser.fftSize);
            
        } catch (error) {
            throw new Error(`Audio initialization failed: ${error.message}`);
        }
    }
    
    getAnalyser() {
        return this.analyser;
    }
    
    getAudioContext() {
        return this.audioContext;
    }
    
    getSampleRate() {
        return this.audioContext ? this.audioContext.sampleRate : 44100;
    }
    
    getTimeDataArray() {
        // Get enhanced time data from harmonic filter
        let timeData;
        if (this.harmonicFilter) {
            timeData = this.harmonicFilter.getFilteredTimeData();
        } else {
            // Fallback to direct analyser data
            const bufferLength = this.analyser.fftSize;
            timeData = new Float32Array(bufferLength);
            this.analyser.getFloatTimeDomainData(timeData);
        }
        
        // Apply signal conditioning
        if (this.signalConditioner) {
            timeData = this.signalConditioner.processSignal(timeData);
        }
        
        return timeData;
    }
    
    getHarmonicFilter() {
        return this.harmonicFilter;
    }
    
    getSignalConditioner() {
        return this.signalConditioner;
    }
    
    setVocalMode(isVocal) {
        if (this.harmonicFilter) {
            this.harmonicFilter.setVocalMode(isVocal);
        }
        if (this.signalConditioner) {
            this.signalConditioner.setVocalMode(isVocal);
        }
    }
    
    stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.microphone = null;
        this.analyser = null;
        
        console.log('Audio stopped');
    }
}