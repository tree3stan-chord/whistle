/**
 * Offline Phoneme Detection System
 * Advanced browser-based vocal analysis for privacy-focused speech-to-text
 * Uses spectral analysis + machine learning patterns for phoneme recognition
 */

class OfflinePhonemeDetector {
    constructor(forensicAnalyzer) {
        this.forensicAnalyzer = forensicAnalyzer;
        
        // Phoneme classification models (simplified for web implementation)
        this.phonemeModels = {
            vowels: {
                'a': { formants: [730, 1090, 2440], spectralPattern: [0, -12, -24, -30] },
                'e': { formants: [530, 1840, 2480], spectralPattern: [0, -8, -20, -28] },
                'i': { formants: [270, 2290, 3010], spectralPattern: [0, -6, -18, -35] },
                'o': { formants: [570, 840, 2410], spectralPattern: [0, -10, -25, -32] },
                'u': { formants: [300, 870, 2240], spectralPattern: [0, -15, -30, -40] },
                'æ': { formants: [660, 1720, 2410], spectralPattern: [0, -9, -22, -29] }, // 'cat'
                'ɪ': { formants: [390, 1990, 2550], spectralPattern: [0, -7, -19, -30] }, // 'bit'
                'ʊ': { formants: [370, 950, 2390], spectralPattern: [0, -13, -28, -38] }, // 'book'
                'ʌ': { formants: [640, 1190, 2390], spectralPattern: [0, -11, -23, -31] }, // 'but'
                'ə': { formants: [500, 1500, 2500], spectralPattern: [0, -10, -20, -30] }  // schwa
            },
            
            consonants: {
                // Fricatives
                's': { spectralCentroid: 6500, noiseFloor: -20, duration: [0.05, 0.2] },
                'f': { spectralCentroid: 4500, noiseFloor: -25, duration: [0.08, 0.25] },
                'ʃ': { spectralCentroid: 3500, noiseFloor: -22, duration: [0.06, 0.3] }, // 'sh'
                'θ': { spectralCentroid: 5500, noiseFloor: -28, duration: [0.05, 0.2] }, // 'th'
                'z': { spectralCentroid: 5500, f0Present: true, duration: [0.04, 0.18] },
                'v': { spectralCentroid: 3800, f0Present: true, duration: [0.05, 0.2] },
                'ʒ': { spectralCentroid: 3200, f0Present: true, duration: [0.05, 0.25] }, // 'zh'
                
                // Stops
                'p': { burstFreq: 1500, silentClosure: [0.02, 0.15], burstDuration: [0.01, 0.03] },
                'b': { burstFreq: 1200, silentClosure: [0.02, 0.12], voicing: true },
                't': { burstFreq: 4000, silentClosure: [0.03, 0.18], burstDuration: [0.01, 0.04] },
                'd': { burstFreq: 3500, silentClosure: [0.02, 0.15], voicing: true },
                'k': { burstFreq: 2500, silentClosure: [0.04, 0.2], burstDuration: [0.015, 0.05] },
                'g': { burstFreq: 2000, silentClosure: [0.03, 0.17], voicing: true },
                
                // Nasals
                'm': { formants: [400, 1200, 2200], nasalResonance: true, voicing: true },
                'n': { formants: [500, 1500, 2500], nasalResonance: true, voicing: true },
                'ŋ': { formants: [300, 1000, 2000], nasalResonance: true, voicing: true }, // 'ng'
                
                // Liquids
                'l': { formants: [400, 1400, 2600], lateralPattern: true, voicing: true },
                'r': { formants: [300, 1100, 1600], rhoticity: true, voicing: true },
                
                // Glides
                'w': { formants: [300, 800, 2200], transition: true, voicing: true },
                'j': { formants: [250, 2100, 2900], transition: true, voicing: true }, // 'y'
                
                // Affricates
                'tʃ': { stopPhase: 't', fricativePhase: 'ʃ', duration: [0.08, 0.3] }, // 'ch'
                'dʒ': { stopPhase: 'd', fricativePhase: 'ʒ', duration: [0.07, 0.28] }  // 'j'
            }
        };
        
        // Coarticulation rules - how phonemes influence each other
        this.coarticulationRules = {
            vowelToVowel: {
                transitionSmoothing: 0.05, // seconds
                formantBlending: true
            },
            consonantClusters: {
                'st': { timing: [-0.02, 0.02], blending: 0.3 },
                'sp': { timing: [-0.015, 0.015], aspiration: 0.04 },
                'sk': { timing: [-0.025, 0.025], blending: 0.2 }
            },
            nasalization: {
                beforeNasals: { effect: 0.7, duration: 0.03 },
                afterNasals: { effect: 0.5, duration: 0.02 }
            }
        };
        
        // Analysis parameters
        this.analysisConfig = {
            frameSize: 1024,
            hopSize: 256,
            windowType: 'hanning',
            preEmphasis: 0.97,
            formantTracking: {
                maxFormants: 5,
                preEmphasisCutoff: 50, // Hz
                lpcOrder: 12
            },
            spectralFeatures: {
                centroidBands: 32,
                rolloffThreshold: 0.85,
                fluxSmoothingFrames: 3
            },
            voicingDetection: {
                f0Range: [80, 800], // Hz
                voicingThreshold: 0.45,
                periodicityThreshold: 0.7
            }
        };
        
        // Phoneme detection state
        this.detectionState = {
            currentPhoneme: null,
            phonemeConfidence: 0,
            phonemeStartTime: 0,
            segmentBuffer: [],
            formantTracker: null,
            spectralHistory: []
        };
    }
    
    async detectPhonemesFromAudio(audioBuffer, pitchEvents = null) {
        console.log('Starting offline phoneme detection...');
        
        // Preprocess audio for phoneme detection
        const processedAudio = this.preprocessAudio(audioBuffer);
        
        // Extract spectral features frame by frame
        const spectralFeatures = this.extractSpectralFeatures(processedAudio);
        
        // Detect formants for vowel classification
        const formantData = this.trackFormants(processedAudio, spectralFeatures);
        
        // Segment audio into phoneme-sized units
        const phoneticSegments = this.segmentIntoPhonemes(spectralFeatures, formantData);
        
        // Classify each segment as a phoneme
        const phonemeSequence = await this.classifyPhonemeSegments(phoneticSegments, pitchEvents);
        
        // Apply coarticulation rules and smoothing
        const refinedPhonemes = this.applyCoarticulationRules(phonemeSequence);
        
        // Convert phonemes to syllables and words
        const linguisticStructure = this.inferLinguisticStructure(refinedPhonemes);
        
        return {
            phonemes: refinedPhonemes,
            syllables: linguisticStructure.syllables,
            words: linguisticStructure.words,
            confidence: this.calculateOverallConfidence(refinedPhonemes),
            method: 'offline_spectral_analysis',
            processingTime: performance.now(),
            analysisMetadata: {
                totalFrames: spectralFeatures.length,
                formantTracking: formantData.trackingQuality,
                voicingConfidence: this.calculateVoicingConfidence(spectralFeatures)
            }
        };
    }
    
    preprocessAudio(audioBuffer) {
        const processed = new Float32Array(audioBuffer.length);
        
        // Apply pre-emphasis filter to balance spectral content
        processed[0] = audioBuffer[0];
        for (let i = 1; i < audioBuffer.length; i++) {
            processed[i] = audioBuffer[i] - this.analysisConfig.preEmphasis * audioBuffer[i - 1];
        }
        
        // Normalize amplitude
        const maxAmplitude = Math.max(...processed.map(Math.abs));
        if (maxAmplitude > 0) {
            for (let i = 0; i < processed.length; i++) {
                processed[i] /= maxAmplitude;
            }
        }
        
        return processed;
    }
    
    extractSpectralFeatures(audioBuffer) {
        const features = [];
        const frameSize = this.analysisConfig.frameSize;
        const hopSize = this.analysisConfig.hopSize;
        const sampleRate = 44100; // Assuming standard sample rate
        
        // Create window function
        const window = this.createWindow(frameSize, this.analysisConfig.windowType);
        
        for (let frameStart = 0; frameStart < audioBuffer.length - frameSize; frameStart += hopSize) {
            const frame = audioBuffer.slice(frameStart, frameStart + frameSize);
            
            // Apply window
            const windowedFrame = frame.map((sample, i) => sample * window[i]);
            
            // Compute FFT
            const spectrum = this.computeFFT(windowedFrame);
            const magnitude = spectrum.map(complex => Math.sqrt(complex.real ** 2 + complex.imag ** 2));
            const power = magnitude.map(mag => mag ** 2);
            
            // Extract key spectral features
            const spectralCentroid = this.computeSpectralCentroid(magnitude, sampleRate);
            const spectralRolloff = this.computeSpectralRolloff(magnitude, sampleRate);
            const spectralFlux = this.computeSpectralFlux(magnitude, features.length > 0 ? features[features.length - 1].magnitude : null);
            const zeroCrossingRate = this.computeZeroCrossingRate(frame);
            const voicing = this.detectVoicing(frame, power, sampleRate);
            
            features.push({
                timestamp: frameStart / sampleRate,
                magnitude,
                power,
                spectralCentroid,
                spectralRolloff,
                spectralFlux,
                zeroCrossingRate,
                voicing,
                energy: power.reduce((sum, p) => sum + p, 0),
                formantCandidates: this.findFormantCandidates(magnitude, sampleRate)
            });
        }
        
        return features;
    }
    
    createWindow(size, type) {
        const window = new Float32Array(size);
        
        if (type === 'hanning') {
            for (let i = 0; i < size; i++) {
                window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
            }
        } else {
            // Default to rectangular window
            window.fill(1.0);
        }
        
        return window;
    }
    
    computeFFT(frame) {
        // Simplified FFT implementation for web
        // In production, would use a more optimized FFT library
        const N = frame.length;
        const spectrum = new Array(N);
        
        for (let k = 0; k < N; k++) {
            let realSum = 0;
            let imagSum = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = -2 * Math.PI * k * n / N;
                realSum += frame[n] * Math.cos(angle);
                imagSum += frame[n] * Math.sin(angle);
            }
            
            spectrum[k] = { real: realSum, imag: imagSum };
        }
        
        return spectrum;
    }
    
    computeSpectralCentroid(magnitude, sampleRate) {
        let numerator = 0;
        let denominator = 0;
        
        for (let bin = 0; bin < magnitude.length / 2; bin++) {
            const frequency = bin * sampleRate / magnitude.length;
            numerator += frequency * magnitude[bin];
            denominator += magnitude[bin];
        }
        
        return denominator > 0 ? numerator / denominator : 0;
    }
    
    computeSpectralRolloff(magnitude, sampleRate, threshold = 0.85) {
        const totalEnergy = magnitude.reduce((sum, mag) => sum + mag ** 2, 0);
        const rolloffEnergy = totalEnergy * threshold;
        
        let cumulativeEnergy = 0;
        for (let bin = 0; bin < magnitude.length / 2; bin++) {
            cumulativeEnergy += magnitude[bin] ** 2;
            if (cumulativeEnergy >= rolloffEnergy) {
                return bin * sampleRate / magnitude.length;
            }
        }
        
        return sampleRate / 2; // Nyquist frequency
    }
    
    computeSpectralFlux(currentMagnitude, previousMagnitude) {
        if (!previousMagnitude) return 0;
        
        let flux = 0;
        for (let i = 0; i < Math.min(currentMagnitude.length, previousMagnitude.length); i++) {
            const diff = currentMagnitude[i] - previousMagnitude[i];
            flux += diff > 0 ? diff : 0; // Only positive changes
        }
        
        return flux;
    }
    
    computeZeroCrossingRate(frame) {
        let crossings = 0;
        
        for (let i = 1; i < frame.length; i++) {
            if ((frame[i] >= 0) !== (frame[i - 1] >= 0)) {
                crossings++;
            }
        }
        
        return crossings / frame.length;
    }
    
    detectVoicing(frame, powerSpectrum, sampleRate) {
        // Autocorrelation-based voicing detection
        const autocorr = this.computeAutocorrelation(frame);
        const f0Range = this.analysisConfig.voicingDetection.f0Range;
        const minLag = Math.floor(sampleRate / f0Range[1]);
        const maxLag = Math.floor(sampleRate / f0Range[0]);
        
        // Find the best autocorrelation peak in F0 range
        let maxCorr = 0;
        let bestLag = 0;
        
        for (let lag = minLag; lag <= Math.min(maxLag, autocorr.length - 1); lag++) {
            if (autocorr[lag] > maxCorr) {
                maxCorr = autocorr[lag];
                bestLag = lag;
            }
        }
        
        const f0 = bestLag > 0 ? sampleRate / bestLag : 0;
        const periodicity = maxCorr / autocorr[0]; // Normalized correlation
        
        return {
            isVoiced: periodicity > this.analysisConfig.voicingDetection.periodicityThreshold,
            f0,
            periodicity,
            confidence: Math.min(1, periodicity * 2)
        };
    }
    
    computeAutocorrelation(signal) {
        const N = signal.length;
        const result = new Float32Array(N);
        
        for (let lag = 0; lag < N; lag++) {
            let correlation = 0;
            for (let i = 0; i < N - lag; i++) {
                correlation += signal[i] * signal[i + lag];
            }
            result[lag] = correlation;
        }
        
        return result;
    }
    
    findFormantCandidates(magnitude, sampleRate) {
        const candidates = [];
        const minFormantFreq = 200; // Hz
        const maxFormantFreq = 4000; // Hz
        const minBin = Math.floor(minFormantFreq * magnitude.length / sampleRate);
        const maxBin = Math.floor(maxFormantFreq * magnitude.length / sampleRate);
        
        // Find local maxima in spectrum (potential formants)
        for (let bin = minBin + 1; bin < maxBin - 1; bin++) {
            if (magnitude[bin] > magnitude[bin - 1] && magnitude[bin] > magnitude[bin + 1]) {
                const frequency = bin * sampleRate / magnitude.length;
                const amplitude = magnitude[bin];
                
                if (amplitude > 0.1) { // Minimum amplitude threshold
                    candidates.push({ frequency, amplitude, bin });
                }
            }
        }
        
        // Sort by amplitude and keep top candidates
        return candidates
            .sort((a, b) => b.amplitude - a.amplitude)
            .slice(0, this.analysisConfig.formantTracking.maxFormants);
    }
    
    trackFormants(audioBuffer, spectralFeatures) {
        const formantTracks = [];
        let trackingQuality = 0;
        
        // Simple formant tracking - connect formant candidates across frames
        spectralFeatures.forEach((frame, frameIndex) => {
            const formants = frame.formantCandidates.slice(0, 4); // F1-F4
            
            if (frameIndex === 0) {
                // Initialize tracks
                formants.forEach((formant, index) => {
                    formantTracks.push([{
                        ...formant,
                        timestamp: frame.timestamp,
                        trackIndex: index
                    }]);
                });
            } else {
                // Continue or start new tracks
                formants.forEach(formant => {
                    let bestTrack = null;
                    let bestDistance = Infinity;
                    
                    // Find best matching track (closest frequency)
                    formantTracks.forEach((track, trackIndex) => {
                        if (track.length > 0) {
                            const lastFormant = track[track.length - 1];
                            const freqDistance = Math.abs(formant.frequency - lastFormant.frequency);
                            
                            if (freqDistance < bestDistance && freqDistance < 200) { // 200 Hz max jump
                                bestDistance = freqDistance;
                                bestTrack = trackIndex;
                            }
                        }
                    });
                    
                    if (bestTrack !== null) {
                        formantTracks[bestTrack].push({
                            ...formant,
                            timestamp: frame.timestamp,
                            trackIndex: bestTrack
                        });
                    } else {
                        // Start new track
                        formantTracks.push([{
                            ...formant,
                            timestamp: frame.timestamp,
                            trackIndex: formantTracks.length
                        }]);
                    }
                });
            }
        });
        
        // Calculate tracking quality
        const totalExpectedPoints = spectralFeatures.length * 3; // Expect F1, F2, F3
        const totalTrackedPoints = formantTracks.reduce((sum, track) => sum + track.length, 0);
        trackingQuality = Math.min(1, totalTrackedPoints / totalExpectedPoints);
        
        return {
            tracks: formantTracks,
            trackingQuality
        };
    }
    
    segmentIntoPhonemes(spectralFeatures, formantData) {
        const segments = [];
        let currentSegment = null;
        const changeThreshold = 0.3; // Spectral change threshold
        
        spectralFeatures.forEach((frame, index) => {
            if (index === 0 || !currentSegment) {
                // Start new segment
                currentSegment = {
                    startTime: frame.timestamp,
                    startIndex: index,
                    features: [frame],
                    avgSpectralCentroid: frame.spectralCentroid,
                    avgEnergy: frame.energy,
                    voicingPattern: [frame.voicing.isVoiced]
                };
            } else {
                // Check if we should continue current segment
                const spectralChange = Math.abs(frame.spectralCentroid - currentSegment.avgSpectralCentroid) / currentSegment.avgSpectralCentroid;
                const energyChange = Math.abs(frame.energy - currentSegment.avgEnergy) / Math.max(currentSegment.avgEnergy, 0.001);
                const voicingChange = frame.voicing.isVoiced !== currentSegment.voicingPattern[currentSegment.voicingPattern.length - 1];
                
                if (spectralChange > changeThreshold || energyChange > 0.5 || voicingChange) {
                    // Finalize current segment
                    currentSegment.endTime = spectralFeatures[index - 1].timestamp;
                    currentSegment.endIndex = index - 1;
                    currentSegment.duration = currentSegment.endTime - currentSegment.startTime;
                    segments.push(currentSegment);
                    
                    // Start new segment
                    currentSegment = {
                        startTime: frame.timestamp,
                        startIndex: index,
                        features: [frame],
                        avgSpectralCentroid: frame.spectralCentroid,
                        avgEnergy: frame.energy,
                        voicingPattern: [frame.voicing.isVoiced]
                    };
                } else {
                    // Continue current segment
                    currentSegment.features.push(frame);
                    currentSegment.avgSpectralCentroid = (currentSegment.avgSpectralCentroid * (currentSegment.features.length - 1) + frame.spectralCentroid) / currentSegment.features.length;
                    currentSegment.avgEnergy = (currentSegment.avgEnergy * (currentSegment.features.length - 1) + frame.energy) / currentSegment.features.length;
                    currentSegment.voicingPattern.push(frame.voicing.isVoiced);
                }
            }
        });
        
        // Finalize last segment
        if (currentSegment) {
            currentSegment.endTime = spectralFeatures[spectralFeatures.length - 1].timestamp;
            currentSegment.endIndex = spectralFeatures.length - 1;
            currentSegment.duration = currentSegment.endTime - currentSegment.startTime;
            segments.push(currentSegment);
        }
        
        return segments;
    }
    
    async classifyPhonemeSegments(segments, pitchEvents = null) {
        const phonemeSequence = [];
        
        for (const segment of segments) {
            // Extract key features for classification
            const isVoiced = segment.voicingPattern.filter(v => v).length > segment.voicingPattern.length / 2;
            const avgSpectralCentroid = segment.avgSpectralCentroid;
            const duration = segment.duration;
            const avgEnergy = segment.avgEnergy;
            
            // Get formant values for this segment
            const segmentFormants = this.extractSegmentFormants(segment);
            
            let phoneme = null;
            let confidence = 0;
            
            if (isVoiced && segmentFormants.length >= 2) {
                // Classify as vowel based on formants
                const vowelResult = this.classifyVowel(segmentFormants, avgSpectralCentroid);
                phoneme = vowelResult.phoneme;
                confidence = vowelResult.confidence;
            } else if (!isVoiced && avgSpectralCentroid > 3000) {
                // High-frequency unvoiced = fricative
                const fricativeResult = this.classifyFricative(avgSpectralCentroid, duration);
                phoneme = fricativeResult.phoneme;
                confidence = fricativeResult.confidence;
            } else if (duration < 0.1 && avgEnergy > segment.avgEnergy * 1.5) {
                // Short, high-energy = stop consonant
                const stopResult = this.classifyStop(avgSpectralCentroid, duration);
                phoneme = stopResult.phoneme;
                confidence = stopResult.confidence;
            } else {
                // Default classification logic
                phoneme = this.classifyGenericPhoneme(segment, isVoiced, avgSpectralCentroid);
                confidence = 0.3; // Lower confidence for generic classification
            }
            
            phonemeSequence.push({
                phoneme,
                confidence,
                startTime: segment.startTime,
                endTime: segment.endTime,
                duration,
                features: {
                    isVoiced,
                    spectralCentroid: avgSpectralCentroid,
                    formants: segmentFormants,
                    energy: avgEnergy
                },
                segment
            });
        }
        
        return phonemeSequence;
    }
    
    extractSegmentFormants(segment) {
        // Average formants across the segment
        const allFormants = segment.features.flatMap(frame => frame.formantCandidates);
        
        if (allFormants.length === 0) return [];
        
        // Group formants by frequency ranges (F1: 200-800, F2: 800-2500, F3: 2500-4000)
        const f1Candidates = allFormants.filter(f => f.frequency >= 200 && f.frequency <= 800);
        const f2Candidates = allFormants.filter(f => f.frequency > 800 && f.frequency <= 2500);
        const f3Candidates = allFormants.filter(f => f.frequency > 2500 && f.frequency <= 4000);
        
        const formants = [];
        
        if (f1Candidates.length > 0) {
            const avgF1 = f1Candidates.reduce((sum, f) => sum + f.frequency, 0) / f1Candidates.length;
            formants.push(avgF1);
        }
        
        if (f2Candidates.length > 0) {
            const avgF2 = f2Candidates.reduce((sum, f) => sum + f.frequency, 0) / f2Candidates.length;
            formants.push(avgF2);
        }
        
        if (f3Candidates.length > 0) {
            const avgF3 = f3Candidates.reduce((sum, f) => sum + f.frequency, 0) / f3Candidates.length;
            formants.push(avgF3);
        }
        
        return formants;
    }
    
    classifyVowel(formants, spectralCentroid) {
        let bestMatch = null;
        let bestScore = -Infinity;
        
        for (const [vowel, model] of Object.entries(this.phonemeModels.vowels)) {
            if (formants.length >= 2) {
                // Score based on formant proximity
                let score = 0;
                const modelFormants = model.formants;
                
                for (let i = 0; i < Math.min(formants.length, modelFormants.length); i++) {
                    const diff = Math.abs(formants[i] - modelFormants[i]);
                    score -= diff / modelFormants[i]; // Normalized difference
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = vowel;
                }
            }
        }
        
        return {
            phoneme: bestMatch || 'ə', // Default to schwa
            confidence: Math.max(0.1, Math.min(1, (bestScore + 1) * 0.5))
        };
    }
    
    classifyFricative(spectralCentroid, duration) {
        let bestMatch = 's'; // Default
        let bestScore = 0;
        
        for (const [consonant, model] of Object.entries(this.phonemeModels.consonants)) {
            if (model.spectralCentroid) {
                const centroidDiff = Math.abs(spectralCentroid - model.spectralCentroid);
                const score = 1 / (1 + centroidDiff / 1000); // Normalized score
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = consonant;
                }
            }
        }
        
        return {
            phoneme: bestMatch,
            confidence: Math.max(0.2, bestScore)
        };
    }
    
    classifyStop(spectralCentroid, duration) {
        // Simple stop classification based on burst frequency
        if (spectralCentroid > 3500) return { phoneme: 't', confidence: 0.6 };
        if (spectralCentroid > 2000) return { phoneme: 'k', confidence: 0.6 };
        return { phoneme: 'p', confidence: 0.5 };
    }
    
    classifyGenericPhoneme(segment, isVoiced, spectralCentroid) {
        if (isVoiced) {
            if (spectralCentroid < 2000) return 'l'; // Likely liquid
            return 'm'; // Likely nasal
        } else {
            return 'h'; // Likely aspirated
        }
    }
    
    applyCoarticulationRules(phonemeSequence) {
        // Apply phonetic rules and smoothing
        const refined = [...phonemeSequence];
        
        // Simple smoothing - remove very short segments that are likely noise
        return refined.filter(p => p.duration > 0.02 || p.confidence > 0.7);
    }
    
    inferLinguisticStructure(phonemeSequence) {
        // Convert phoneme sequence to syllables and words
        const syllables = [];
        const words = [];
        
        let currentSyllable = [];
        let currentWord = [];
        
        phonemeSequence.forEach((phoneme, index) => {
            currentSyllable.push(phoneme);
            currentWord.push(phoneme);
            
            // Simple syllable boundary detection (vowel + consonant(s) or pause)
            const isVowel = this.phonemeModels.vowels.hasOwnProperty(phoneme.phoneme);
            const nextPhoneme = phonemeSequence[index + 1];
            const nextIsVowel = nextPhoneme ? this.phonemeModels.vowels.hasOwnProperty(nextPhoneme.phoneme) : false;
            
            if (isVowel && (!nextPhoneme || !nextIsVowel)) {
                // End of syllable
                syllables.push({
                    phonemes: [...currentSyllable],
                    startTime: currentSyllable[0].startTime,
                    endTime: currentSyllable[currentSyllable.length - 1].endTime,
                    text: this.phonemsToText(currentSyllable),
                    confidence: currentSyllable.reduce((sum, p) => sum + p.confidence, 0) / currentSyllable.length
                });
                currentSyllable = [];
            }
            
            // Simple word boundary detection (longer pause)
            if (!nextPhoneme || (nextPhoneme.startTime - phoneme.endTime) > 0.3) {
                // End of word
                if (currentWord.length > 0) {
                    words.push({
                        phonemes: [...currentWord],
                        startTime: currentWord[0].startTime,
                        endTime: currentWord[currentWord.length - 1].endTime,
                        text: this.phonemesToText(currentWord),
                        confidence: currentWord.reduce((sum, p) => sum + p.confidence, 0) / currentWord.length
                    });
                    currentWord = [];
                }
            }
        });
        
        return { syllables, words };
    }
    
    phonemesToText(phonemes) {
        // Convert phoneme symbols to approximate text
        // This is a simplified mapping - would be enhanced with proper IPA to text conversion
        return phonemes.map(p => p.phoneme).join('');
    }
    
    calculateOverallConfidence(phonemeSequence) {
        if (phonemeSequence.length === 0) return 0;
        return phonemeSequence.reduce((sum, p) => sum + p.confidence, 0) / phonemeSequence.length;
    }
    
    calculateVoicingConfidence(spectralFeatures) {
        const voicedFrames = spectralFeatures.filter(f => f.voicing.isVoiced);
        return voicedFrames.length / spectralFeatures.length;
    }
}