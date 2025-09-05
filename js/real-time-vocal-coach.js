/**
 * RealTimeVocalCoach - Intelligent vocal training and performance feedback
 * Provides real-time coaching feedback including:
 * - Pitch accuracy analysis with visual feedback
 * - Rhythm timing coaching with metronome integration
 * - Vocal technique guidance (breath support, vibrato consistency)
 * - Performance scoring and improvement tracking
 * - Practice mode with target phrases
 */

class RealTimeVocalCoach {
    constructor(audioHandler, pitchDetector, articulationIntegration) {
        this.audioHandler = audioHandler;
        this.pitchDetector = pitchDetector;
        this.articulationIntegration = articulationIntegration;
        
        // Coaching state
        this.isCoachingEnabled = true;
        this.coachingMode = 'performance'; // 'performance', 'practice', 'assessment'
        this.targetPhrase = null;
        this.practiceSession = null;
        
        // Performance tracking
        this.currentSession = {
            startTime: null,
            pitchAccuracy: [],
            rhythmAccuracy: [],
            breathSupport: [],
            vocalTechnique: [],
            overallScore: 0,
            feedbackHistory: []
        };
        
        // Coaching thresholds and parameters
        this.pitchTolerance = {
            excellent: 5,   // cents
            good: 15,       // cents  
            fair: 30,       // cents
            poor: 50        // cents
        };
        
        this.rhythmTolerance = {
            excellent: 0.02, // seconds
            good: 0.05,      // seconds
            fair: 0.1,       // seconds
            poor: 0.2        // seconds
        };
        
        // Feedback display system
        this.feedbackQueue = [];
        this.lastFeedbackTime = 0;
        this.feedbackCooldown = 1000; // ms between feedback messages
        
        // Visual feedback elements
        this.pitchIndicator = null;
        this.rhythmIndicator = null;
        this.breathIndicator = null;
        this.scoreDisplay = null;
        this.feedbackDisplay = null;
        
        // Metronome integration
        this.metronome = {
            enabled: false,
            bpm: 120,
            clickTrack: null,
            visualBeat: null,
            lastBeatTime: 0,
            beatCount: 0
        };
        
        // Practice mode
        this.practiceTargets = new Map();
        this.practiceProgress = new Map();
        
        this.initializeCoachingSystem();
    }

    /**
     * Initialize the coaching system and UI elements
     */
    initializeCoachingSystem() {
        this.createCoachingUI();
        this.initializeMetronome();
        this.setupEventListeners();
        
        console.log('🎓 Real-time vocal coach initialized');
    }

    /**
     * Create coaching UI elements
     */
    createCoachingUI() {
        // Create coaching panel
        const coachingPanel = document.createElement('div');
        coachingPanel.id = 'coachingPanel';
        coachingPanel.className = 'coaching-panel';
        coachingPanel.innerHTML = `
            <div class="coaching-header">
                <h3>🎓 Vocal Coach</h3>
                <button id="toggleCoaching" class="icon-btn">
                    <span>👁️</span>
                </button>
            </div>
            <div class="coaching-content">
                <div class="coaching-section">
                    <h4>Pitch Accuracy</h4>
                    <div id="pitchFeedback" class="feedback-indicator">
                        <div class="pitch-target"></div>
                        <div class="pitch-current"></div>
                        <span class="accuracy-text">--</span>
                    </div>
                </div>
                
                <div class="coaching-section">
                    <h4>Rhythm Timing</h4>
                    <div id="rhythmFeedback" class="feedback-indicator">
                        <div class="beat-indicator"></div>
                        <div class="timing-accuracy">--</div>
                    </div>
                </div>
                
                <div class="coaching-section">
                    <h4>Vocal Technique</h4>
                    <div id="techniqueFeedback" class="technique-feedback">
                        <div class="breath-support">
                            <span>Breath Support:</span>
                            <div class="support-meter"></div>
                        </div>
                        <div class="vibrato-consistency">
                            <span>Vibrato:</span>
                            <div class="vibrato-meter"></div>
                        </div>
                    </div>
                </div>
                
                <div class="coaching-section">
                    <h4>Performance Score</h4>
                    <div id="performanceScore" class="score-display">
                        <div class="score-number">--</div>
                        <div class="score-grade">--</div>
                    </div>
                </div>
                
                <div class="coaching-section">
                    <h4>Live Feedback</h4>
                    <div id="liveFeedback" class="live-feedback">
                        <div class="feedback-message">Ready to begin...</div>
                    </div>
                </div>
            </div>
            
            <div class="coaching-controls">
                <button id="enableMetronome" class="control-btn">
                    <span>🎼</span> Metronome
                </button>
                <button id="practiceMode" class="control-btn">
                    <span>🎯</span> Practice
                </button>
                <button id="assessmentMode" class="control-btn">
                    <span>📊</span> Assess
                </button>
            </div>
        `;
        
        // Add coaching panel to the page (after debug panel)
        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) {
            debugPanel.parentNode.insertBefore(coachingPanel, debugPanel.nextSibling);
        } else {
            document.querySelector('.app-main').appendChild(coachingPanel);
        }
        
        // Store references to UI elements
        this.pitchIndicator = document.getElementById('pitchFeedback');
        this.rhythmIndicator = document.getElementById('rhythmFeedback');
        this.breathIndicator = document.querySelector('.support-meter');
        this.scoreDisplay = document.getElementById('performanceScore');
        this.feedbackDisplay = document.getElementById('liveFeedback');
    }

    /**
     * Initialize metronome system
     */
    initializeMetronome() {
        // Create audio context for metronome clicks
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.metronome.clickTrack = this.createMetronomeSound();
        } catch (e) {
            console.warn('Could not initialize metronome audio:', e);
        }
    }

    /**
     * Create metronome click sound
     */
    createMetronomeSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        return { oscillator, gainNode };
    }

    /**
     * Setup event listeners for coaching controls
     */
    setupEventListeners() {
        // Toggle coaching visibility
        const toggleBtn = document.getElementById('toggleCoaching');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleCoachingPanel());
        }
        
        // Metronome control
        const metronomeBtn = document.getElementById('enableMetronome');
        if (metronomeBtn) {
            metronomeBtn.addEventListener('click', () => this.toggleMetronome());
        }
        
        // Practice mode
        const practiceModeBtn = document.getElementById('practiceMode');
        if (practiceModeBtn) {
            practiceModeBtn.addEventListener('click', () => this.enterPracticeMode());
        }
        
        // Assessment mode
        const assessmentBtn = document.getElementById('assessmentMode');
        if (assessmentBtn) {
            assessmentBtn.addEventListener('click', () => this.enterAssessmentMode());
        }
    }

    /**
     * Start coaching session
     */
    startCoachingSession() {
        this.currentSession = {
            startTime: Date.now(),
            pitchAccuracy: [],
            rhythmAccuracy: [],
            breathSupport: [],
            vocalTechnique: [],
            overallScore: 0,
            feedbackHistory: []
        };
        
        this.isCoachingEnabled = true;
        this.showFeedback('🎓 Coaching session started!', 'success');
        
        console.log('🎓 Vocal coaching session started');
    }

    /**
     * Stop coaching session and provide summary
     */
    stopCoachingSession() {
        if (!this.currentSession.startTime) return;
        
        const sessionDuration = (Date.now() - this.currentSession.startTime) / 1000;
        const summary = this.generateSessionSummary(sessionDuration);
        
        this.isCoachingEnabled = false;
        this.showFeedback('📊 Session complete! Check your results.', 'info');
        
        console.log('🎓 Coaching session summary:', summary);
        return summary;
    }

    /**
     * Analyze current performance and provide real-time feedback
     * @param {Object} pitchData - Current pitch detection data
     * @param {Object} rhythmData - Current rhythm analysis data
     * @param {Object} articulationData - Current articulation data
     */
    analyzePerformance(pitchData, rhythmData = null, articulationData = null) {
        if (!this.isCoachingEnabled) return;
        
        const feedback = {
            timestamp: Date.now(),
            pitch: this.analyzePitchAccuracy(pitchData),
            rhythm: rhythmData ? this.analyzeRhythmTiming(rhythmData) : null,
            technique: articulationData ? this.analyzeVocalTechnique(articulationData) : null
        };
        
        // Update UI with feedback
        this.updateCoachingUI(feedback);
        
        // Generate live coaching feedback
        this.generateLiveFeedback(feedback);
        
        // Record performance data
        this.recordPerformanceData(feedback);
        
        return feedback;
    }

    /**
     * Analyze pitch accuracy against target or reference
     * @param {Object} pitchData - Current pitch data
     */
    analyzePitchAccuracy(pitchData) {
        if (!pitchData || !pitchData.frequency) {
            return { accuracy: 0, deviation: 0, grade: 'none' };
        }
        
        let targetFreq = null;
        let deviation = 0;
        
        // If in practice mode with target phrase
        if (this.coachingMode === 'practice' && this.targetPhrase) {
            targetFreq = this.getTargetFrequency();
        } else {
            // Use note center frequency as reference
            const noteInfo = this.pitchDetector.frequencyToNote(pitchData.frequency);
            targetFreq = this.pitchDetector.noteToFrequency(noteInfo.note, noteInfo.octave);
        }
        
        if (targetFreq) {
            // Calculate cents deviation
            deviation = 1200 * Math.log2(pitchData.frequency / targetFreq);
        }
        
        const absDeviation = Math.abs(deviation);
        let accuracy = 0;
        let grade = 'poor';
        
        if (absDeviation <= this.pitchTolerance.excellent) {
            accuracy = 100;
            grade = 'excellent';
        } else if (absDeviation <= this.pitchTolerance.good) {
            accuracy = 85;
            grade = 'good';
        } else if (absDeviation <= this.pitchTolerance.fair) {
            accuracy = 70;
            grade = 'fair';
        } else if (absDeviation <= this.pitchTolerance.poor) {
            accuracy = 50;
            grade = 'poor';
        }
        
        return { accuracy, deviation, grade, targetFreq, currentFreq: pitchData.frequency };
    }

    /**
     * Analyze rhythm timing accuracy
     * @param {Object} rhythmData - Current rhythm data
     */
    analyzeRhythmTiming(rhythmData) {
        if (!rhythmData || !this.metronome.enabled) {
            return { accuracy: 0, timing: 0, grade: 'none' };
        }
        
        const expectedBeatTime = this.calculateExpectedBeatTime();
        const actualBeatTime = rhythmData.onsetTime || Date.now();
        const timingError = Math.abs(actualBeatTime - expectedBeatTime) / 1000;
        
        let accuracy = 0;
        let grade = 'poor';
        
        if (timingError <= this.rhythmTolerance.excellent) {
            accuracy = 100;
            grade = 'excellent';
        } else if (timingError <= this.rhythmTolerance.good) {
            accuracy = 85;
            grade = 'good';
        } else if (timingError <= this.rhythmTolerance.fair) {
            accuracy = 70;
            grade = 'fair';
        } else if (timingError <= this.rhythmTolerance.poor) {
            accuracy = 50;
            grade = 'poor';
        }
        
        return { accuracy, timing: timingError, grade };
    }

    /**
     * Analyze vocal technique from articulation data
     * @param {Object} articulationData - Articulation analysis results
     */
    analyzeVocalTechnique(articulationData) {
        const technique = {
            breathSupport: 0,
            vibratoConsistency: 0,
            articulation: 0,
            overall: 0,
            feedback: []
        };
        
        // Analyze breath support
        if (articulationData.breathing) {
            const breathQuality = articulationData.breathing.supportQuality || 0;
            technique.breathSupport = Math.round(breathQuality * 100);
            
            if (breathQuality > 0.8) {
                technique.feedback.push('Excellent breath support!');
            } else if (breathQuality > 0.6) {
                technique.feedback.push('Good breath control');
            } else if (breathQuality > 0.4) {
                technique.feedback.push('Focus on deeper breathing');
            } else {
                technique.feedback.push('Improve breath support');
            }
        }
        
        // Analyze vibrato consistency
        if (articulationData.vibrato) {
            const vibratoQuality = articulationData.vibrato.consistency || 0;
            technique.vibratoConsistency = Math.round(vibratoQuality * 100);
            
            if (vibratoQuality > 0.8) {
                technique.feedback.push('Beautiful vibrato control');
            } else if (vibratoQuality > 0.6) {
                technique.feedback.push('Good vibrato development');
            } else if (vibratoQuality < 0.3 && articulationData.vibrato.present) {
                technique.feedback.push('Work on vibrato consistency');
            }
        }
        
        // Overall technique score
        technique.overall = Math.round((technique.breathSupport + technique.vibratoConsistency) / 2);
        
        return technique;
    }

    /**
     * Update coaching UI with latest feedback
     * @param {Object} feedback - Performance feedback data
     */
    updateCoachingUI(feedback) {
        // Update pitch accuracy display
        if (feedback.pitch && this.pitchIndicator) {
            const pitchText = this.pitchIndicator.querySelector('.accuracy-text');
            if (pitchText) {
                pitchText.textContent = `${feedback.pitch.accuracy}% (${feedback.pitch.grade})`;
                pitchText.className = `accuracy-text ${feedback.pitch.grade}`;
            }
            
            // Update pitch visual indicator
            const currentPitch = this.pitchIndicator.querySelector('.pitch-current');
            if (currentPitch && feedback.pitch.deviation !== undefined) {
                const offset = Math.max(-50, Math.min(50, feedback.pitch.deviation));
                currentPitch.style.left = `${50 + offset}%`;
            }
        }
        
        // Update rhythm timing display
        if (feedback.rhythm && this.rhythmIndicator) {
            const timingText = this.rhythmIndicator.querySelector('.timing-accuracy');
            if (timingText) {
                timingText.textContent = `${feedback.rhythm.accuracy}% (${feedback.rhythm.grade})`;
                timingText.className = `timing-accuracy ${feedback.rhythm.grade}`;
            }
        }
        
        // Update vocal technique display
        if (feedback.technique) {
            if (this.breathIndicator) {
                this.breathIndicator.style.width = `${feedback.technique.breathSupport}%`;
                this.breathIndicator.className = `support-meter ${this.getGradeFromScore(feedback.technique.breathSupport)}`;
            }
            
            const vibratoMeter = document.querySelector('.vibrato-meter');
            if (vibratoMeter) {
                vibratoMeter.style.width = `${feedback.technique.vibratoConsistency}%`;
                vibratoMeter.className = `vibrato-meter ${this.getGradeFromScore(feedback.technique.vibratoConsistency)}`;
            }
        }
        
        // Update overall performance score
        this.updatePerformanceScore(feedback);
    }

    /**
     * Update overall performance score display
     * @param {Object} feedback - Current feedback data
     */
    updatePerformanceScore(feedback) {
        if (!this.scoreDisplay) return;
        
        let totalScore = 0;
        let components = 0;
        
        if (feedback.pitch && feedback.pitch.accuracy > 0) {
            totalScore += feedback.pitch.accuracy;
            components++;
        }
        
        if (feedback.rhythm && feedback.rhythm.accuracy > 0) {
            totalScore += feedback.rhythm.accuracy;
            components++;
        }
        
        if (feedback.technique && feedback.technique.overall > 0) {
            totalScore += feedback.technique.overall;
            components++;
        }
        
        if (components > 0) {
            const overallScore = Math.round(totalScore / components);
            this.currentSession.overallScore = overallScore;
            
            const scoreNumber = this.scoreDisplay.querySelector('.score-number');
            const scoreGrade = this.scoreDisplay.querySelector('.score-grade');
            
            if (scoreNumber) scoreNumber.textContent = overallScore;
            if (scoreGrade) {
                const grade = this.getGradeFromScore(overallScore);
                scoreGrade.textContent = grade.toUpperCase();
                scoreGrade.className = `score-grade ${grade}`;
            }
        }
    }

    /**
     * Generate live feedback messages
     * @param {Object} feedback - Performance feedback data
     */
    generateLiveFeedback(feedback) {
        const now = Date.now();
        if (now - this.lastFeedbackTime < this.feedbackCooldown) return;
        
        let message = '';
        let type = 'info';
        
        // Priority: most critical feedback first
        if (feedback.pitch && feedback.pitch.grade === 'poor') {
            if (feedback.pitch.deviation > 0) {
                message = '🎵 Pitch a bit high - adjust downward';
            } else {
                message = '🎵 Pitch a bit low - adjust upward';
            }
            type = 'warning';
        } else if (feedback.rhythm && feedback.rhythm.grade === 'poor') {
            message = '⏱️ Focus on timing with the beat';
            type = 'warning';
        } else if (feedback.technique && feedback.technique.breathSupport < 50) {
            message = '💨 Take a deeper breath for better support';
            type = 'tip';
        } else if (feedback.pitch && feedback.pitch.grade === 'excellent') {
            message = '🎯 Perfect pitch! Great intonation';
            type = 'success';
        } else if (feedback.technique && feedback.technique.overall > 80) {
            message = '✨ Excellent technique!';
            type = 'success';
        }
        
        if (message) {
            this.showFeedback(message, type);
            this.lastFeedbackTime = now;
        }
    }

    /**
     * Show feedback message in the UI
     * @param {string} message - Feedback message
     * @param {string} type - Message type (success, warning, tip, info)
     */
    showFeedback(message, type = 'info') {
        if (!this.feedbackDisplay) return;
        
        const messageEl = this.feedbackDisplay.querySelector('.feedback-message');
        if (messageEl) {
            messageEl.textContent = message;
            messageEl.className = `feedback-message ${type}`;
            
            // Auto-clear after 3 seconds
            setTimeout(() => {
                if (messageEl.textContent === message) {
                    messageEl.textContent = 'Listening...';
                    messageEl.className = 'feedback-message';
                }
            }, 3000);
        }
    }

    /**
     * Toggle metronome on/off
     */
    toggleMetronome() {
        this.metronome.enabled = !this.metronome.enabled;
        
        const btn = document.getElementById('enableMetronome');
        if (btn) {
            btn.classList.toggle('active', this.metronome.enabled);
        }
        
        if (this.metronome.enabled) {
            this.startMetronome();
            this.showFeedback('🎼 Metronome enabled', 'info');
        } else {
            this.stopMetronome();
            this.showFeedback('🎼 Metronome disabled', 'info');
        }
    }

    /**
     * Start metronome
     */
    startMetronome() {
        if (!this.audioContext || this.metronome.interval) return;
        
        const beatInterval = 60000 / this.metronome.bpm;
        this.metronome.lastBeatTime = Date.now();
        
        this.metronome.interval = setInterval(() => {
            this.playMetronomeClick();
            this.updateVisualBeat();
            this.metronome.lastBeatTime = Date.now();
            this.metronome.beatCount++;
        }, beatInterval);
    }

    /**
     * Stop metronome
     */
    stopMetronome() {
        if (this.metronome.interval) {
            clearInterval(this.metronome.interval);
            this.metronome.interval = null;
        }
    }

    /**
     * Play metronome click sound
     */
    playMetronomeClick() {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        } catch (e) {
            console.warn('Metronome click failed:', e);
        }
    }

    /**
     * Update visual beat indicator
     */
    updateVisualBeat() {
        const beatIndicator = document.querySelector('.beat-indicator');
        if (beatIndicator) {
            beatIndicator.style.backgroundColor = '#4A90E2';
            setTimeout(() => {
                beatIndicator.style.backgroundColor = '#e0e0e0';
            }, 150);
        }
    }

    /**
     * Calculate expected beat time for rhythm analysis
     */
    calculateExpectedBeatTime() {
        if (!this.metronome.enabled) return Date.now();
        
        const beatInterval = 60000 / this.metronome.bpm;
        const timeSinceLastBeat = Date.now() - this.metronome.lastBeatTime;
        const nextBeatTime = this.metronome.lastBeatTime + beatInterval;
        
        return nextBeatTime;
    }

    /**
     * Enter practice mode with target phrases
     */
    enterPracticeMode() {
        this.coachingMode = 'practice';
        this.showFeedback('🎯 Practice mode activated', 'success');
        
        // TODO: Implement practice phrase selection UI
        console.log('🎯 Entering practice mode');
    }

    /**
     * Enter assessment mode for performance evaluation
     */
    enterAssessmentMode() {
        this.coachingMode = 'assessment';
        this.showFeedback('📊 Assessment mode activated', 'info');
        
        // Start fresh assessment session
        this.startCoachingSession();
        console.log('📊 Entering assessment mode');
    }

    /**
     * Toggle coaching panel visibility
     */
    toggleCoachingPanel() {
        const panel = document.getElementById('coachingPanel');
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }

    /**
     * Record performance data for session tracking
     * @param {Object} feedback - Performance feedback data
     */
    recordPerformanceData(feedback) {
        if (!this.currentSession.startTime) return;
        
        if (feedback.pitch) {
            this.currentSession.pitchAccuracy.push(feedback.pitch.accuracy);
        }
        
        if (feedback.rhythm) {
            this.currentSession.rhythmAccuracy.push(feedback.rhythm.accuracy);
        }
        
        if (feedback.technique) {
            this.currentSession.vocalTechnique.push(feedback.technique.overall);
        }
        
        this.currentSession.feedbackHistory.push({
            timestamp: feedback.timestamp,
            feedback: feedback
        });
    }

    /**
     * Generate session summary report
     * @param {number} duration - Session duration in seconds
     */
    generateSessionSummary(duration) {
        const summary = {
            duration: duration,
            totalNotes: this.currentSession.pitchAccuracy.length,
            averagePitchAccuracy: this.calculateAverage(this.currentSession.pitchAccuracy),
            averageRhythmAccuracy: this.calculateAverage(this.currentSession.rhythmAccuracy),
            averageTechniqueScore: this.calculateAverage(this.currentSession.vocalTechnique),
            overallScore: this.currentSession.overallScore,
            recommendations: this.generateRecommendations()
        };
        
        return summary;
    }

    /**
     * Generate personalized practice recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        const pitchAvg = this.calculateAverage(this.currentSession.pitchAccuracy);
        const rhythmAvg = this.calculateAverage(this.currentSession.rhythmAccuracy);
        const techniqueAvg = this.calculateAverage(this.currentSession.vocalTechnique);
        
        if (pitchAvg < 70) {
            recommendations.push('Focus on pitch accuracy with slow scales and interval training');
        }
        
        if (rhythmAvg < 70) {
            recommendations.push('Practice with metronome to improve timing precision');
        }
        
        if (techniqueAvg < 70) {
            recommendations.push('Work on breath support and vocal technique exercises');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Excellent performance! Continue with advanced repertoire');
        }
        
        return recommendations;
    }

    /**
     * Get target frequency for practice mode
     */
    getTargetFrequency() {
        // TODO: Implement target phrase frequency calculation
        return 440; // A4 as default
    }

    /**
     * Calculate average of array values
     * @param {Array} values - Numeric array
     */
    calculateAverage(values) {
        if (!values || values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    /**
     * Get grade text from numeric score
     * @param {number} score - Numeric score 0-100
     */
    getGradeFromScore(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'fair';
        return 'poor';
    }

    /**
     * Set metronome BPM
     * @param {number} bpm - Beats per minute
     */
    setMetronomeBPM(bpm) {
        this.metronome.bpm = Math.max(60, Math.min(200, bpm));
        
        if (this.metronome.enabled) {
            this.stopMetronome();
            this.startMetronome();
        }
    }

    /**
     * Enable/disable coaching system
     * @param {boolean} enabled - Whether coaching is enabled
     */
    setCoachingEnabled(enabled) {
        this.isCoachingEnabled = enabled;
        
        const panel = document.getElementById('coachingPanel');
        if (panel) {
            panel.style.opacity = enabled ? '1' : '0.5';
        }
    }

    /**
     * Get current coaching status
     */
    getCoachingStatus() {
        return {
            enabled: this.isCoachingEnabled,
            mode: this.coachingMode,
            metronomeEnabled: this.metronome.enabled,
            metronomeEBPM: this.metronome.bpm,
            sessionActive: this.currentSession.startTime !== null,
            overallScore: this.currentSession.overallScore
        };
    }
}