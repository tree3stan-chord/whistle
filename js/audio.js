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
            
            // Create analyser node (optimized for YIN)
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 4096; // Larger for better frequency resolution
            this.analyser.smoothingTimeConstant = 0.0; // No smoothing for YIN algorithm
            
            // Create additional nodes for advanced processing
            this.preEmphasisFilter = this.audioContext.createBiquadFilter();
            this.preEmphasisFilter.type = 'highpass';
            this.preEmphasisFilter.frequency.setValueAtTime(80, this.audioContext.currentTime); // High-pass for vocals
            
            // Connect audio pipeline: microphone -> pre-emphasis -> analyser
            this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.microphone.connect(this.preEmphasisFilter);
            this.preEmphasisFilter.connect(this.analyser);
            
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
        const bufferLength = this.analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);
        return dataArray;
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