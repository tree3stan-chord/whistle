class AudioHandler {
    constructor() {
        this.audioContext = null;
        this.microphone = null;
        this.analyser = null;
        this.mediaStream = null;
        this.gainNode = null;
        this.harmonicFilter = null;
        this.signalConditioner = null;
    }
    
    async initialize(config = null) {
        try {
            // Use provided config or defaults
            const audioConfig = config || {
                deviceId: null,
                inputGain: 1.0,
                inputSensitivity: 0.3,
                noiseGate: 0.02,
                sampleRate: 44100
            };
            
            // Request microphone access with specific device if configured
            const constraints = {
                audio: {
                    deviceId: audioConfig.deviceId ? { exact: audioConfig.deviceId } : undefined,
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    sampleRate: audioConfig.sampleRate
                }
            };
            
            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Create audio context with preferred sample rate
            const audioContextOptions = {
                sampleRate: audioConfig.sampleRate
            };
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)(audioContextOptions);
            
            // Create harmonic filter for vocal processing (this creates the analyser internally)
            this.harmonicFilter = new HarmonicFilter(this.audioContext, this.audioContext.sampleRate);
            
            // Create gain node for input level control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.setValueAtTime(audioConfig.inputGain, this.audioContext.currentTime);
            
            // Connect audio pipeline: microphone -> gain -> harmonic filter -> analyser
            this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.microphone.connect(this.gainNode);
            this.analyser = this.harmonicFilter.connectInput(this.gainNode);
            
            // Create signal conditioner with configured parameters
            this.signalConditioner = new SignalConditioner(this.audioContext.sampleRate, 4096);
            this.signalConditioner.setNoiseGate(audioConfig.noiseGate);
            this.signalConditioner.setSensitivity(audioConfig.inputSensitivity);
            
            console.log('Audio initialized successfully');
            console.log('Sample rate:', this.audioContext.sampleRate);
            console.log('FFT size:', this.analyser.fftSize);
            console.log('Input device:', this.mediaStream.getAudioTracks()[0].label);
            
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
    
    getGainNode() {
        return this.gainNode;
    }
    
    setInputGain(gainValue) {
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(gainValue, this.audioContext.currentTime);
        }
    }
    
    getCurrentDevice() {
        if (this.mediaStream) {
            const track = this.mediaStream.getAudioTracks()[0];
            return {
                id: track.getSettings().deviceId,
                label: track.label
            };
        }
        return null;
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
        this.gainNode = null;
        this.harmonicFilter = null;
        this.signalConditioner = null;
        
        console.log('Audio stopped');
    }
}