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
            
            // Create analyser node (optimized settings)
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048; // Reduced for better performance
            this.analyser.smoothingTimeConstant = 0.8; // Increased for more stable readings
            
            // Connect microphone to analyser
            this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.microphone.connect(this.analyser);
            
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