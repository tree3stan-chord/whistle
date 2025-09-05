class Playhead {
    constructor(notationRenderer, app) {
        this.notationRenderer = notationRenderer;
        this.app = app;
        
        // Playhead state
        this.isRecording = false;
        this.recordingStartTime = null;
        this.currentTime = 0;           // Current playback time in seconds
        this.playheadPosition = 0;      // Current X position on canvas
        this.tempo = 120;               // BPM from staff configuration
        this.timeSignature = [4, 4];   // From staff configuration
        
        // Visual settings
        this.playheadColor = '#ff4757';        // Bright red playhead
        this.playheadWidth = 3;                // Cursor thickness
        this.beatGridColor = '#40444b';        // Subtle grid lines
        this.beatGridOpacity = 0.3;            // Semi-transparent
        this.showBeatGrid = true;              // Grid visibility
        
        // Timing calculations
        this.beatDuration = 60 / this.tempo;   // Duration of one beat in seconds
        this.measureDuration = this.beatDuration * this.timeSignature[0]; // Full measure duration
        this.pixelsPerSecond = 80;             // Visual speed - pixels per second
        
        // Animation
        this.animationId = null;
        this.lastUpdateTime = 0;
        this.smoothing = 0.1;                  // Smooth movement factor
        
        // Beat tracking for metronome
        this.lastBeatTime = 0;
        this.beatCount = 0;
        this.enableMetronome = false;
        
        console.log('Playhead initialized');
    }
    
    startRecording() {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.recordingStartTime = performance.now();
        this.currentTime = 0;
        this.lastUpdateTime = this.recordingStartTime;
        this.lastBeatTime = 0;
        this.beatCount = 0;
        
        // Start animation loop
        this.startAnimationLoop();
        
        // Update UI to show recording state
        this.updateRecordingIndicators(true);
        
        console.log('Recording started with playhead');
    }
    
    stopRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        this.recordingStartTime = null;
        
        // Stop animation loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Update UI
        this.updateRecordingIndicators(false);
        
        // Clear playhead from canvas
        this.clearPlayhead();
        
        console.log('Recording stopped');
    }
    
    updateConfiguration(config) {
        // Update timing based on staff configuration
        this.tempo = config.tempo || 120;
        this.timeSignature = [config.timeSignature.numerator || 4, config.timeSignature.denominator || 4];
        this.enableMetronome = config.metronome || false;
        this.showBeatGrid = config.showBeatGrid !== false;
        
        // Recalculate timing
        this.beatDuration = 60 / this.tempo;
        this.measureDuration = this.beatDuration * this.timeSignature[0];
        
        // Update visual speed based on tempo (faster tempo = slower visual movement for readability)
        this.pixelsPerSecond = Math.max(40, Math.min(120, 80 * (120 / this.tempo)));
        
        console.log('Playhead configuration updated:', {
            tempo: this.tempo,
            timeSignature: this.timeSignature,
            beatDuration: this.beatDuration.toFixed(3),
            pixelsPerSecond: this.pixelsPerSecond
        });
    }
    
    startAnimationLoop() {
        if (!this.isRecording) return;
        
        const animate = (currentTime) => {
            if (!this.isRecording) return;
            
            // Calculate elapsed time
            const elapsed = (currentTime - this.recordingStartTime) / 1000; // Convert to seconds
            this.currentTime = elapsed;
            
            // Calculate playhead position
            const newPosition = this.calculatePlayheadPosition(elapsed);
            
            // Smooth movement
            this.playheadPosition += (newPosition - this.playheadPosition) * this.smoothing;
            
            // Check if we need to scroll
            this.handleScrolling();
            
            // Handle metronome
            this.handleMetronome(elapsed);
            
            // Redraw with playhead
            this.drawPlayheadAndGrid();
            
            // Continue animation
            this.lastUpdateTime = currentTime;
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
    }
    
    calculatePlayheadPosition(timeInSeconds) {
        // Start position (after clef and key signature)
        const startX = this.notationRenderer.staffStartX + 90;
        
        // Calculate position based on time and visual speed
        const relativePosition = timeInSeconds * this.pixelsPerSecond;
        
        // Account for scrolling offset
        return startX + relativePosition - this.notationRenderer.scrollOffset;
    }
    
    handleScrolling() {
        const staffStartX = this.notationRenderer.staffStartX;
        const staffEndX = staffStartX + this.notationRenderer.staffWidth;
        const scrollBuffer = 100; // Start scrolling 100px before edge
        
        // Check if playhead is approaching the right edge
        if (this.playheadPosition > staffEndX - scrollBuffer) {
            // Calculate how much to scroll
            const scrollAmount = this.pixelsPerSecond / 4; // Smooth scrolling
            this.notationRenderer.scrollOffset += scrollAmount;
            
            // Trigger redraw of staff with new scroll position
            this.notationRenderer.redrawWithScroll();
        }
    }
    
    handleMetronome(elapsed) {
        if (!this.enableMetronome) return;
        
        // Calculate current beat
        const currentBeat = Math.floor(elapsed / this.beatDuration);
        
        // Check if we've hit a new beat
        if (currentBeat > this.beatCount) {
            this.beatCount = currentBeat;
            this.lastBeatTime = elapsed;
            
            // Play metronome sound (visual indication for now)
            this.flashMetronome();
        }
    }
    
    flashMetronome() {
        // Visual metronome flash - briefly highlight beat grid
        const beatGridElements = document.querySelectorAll('.beat-indicator');
        beatGridElements.forEach(element => {
            element.style.opacity = '0.8';
            setTimeout(() => {
                element.style.opacity = '0.3';
            }, 100);
        });
    }
    
    drawPlayheadAndGrid() {
        if (!this.isRecording) return;
        
        const ctx = this.notationRenderer.ctx;
        const staffStartX = this.notationRenderer.staffStartX;
        const staffStartY = this.notationRenderer.staffStartY;
        const staffHeight = this.notationRenderer.staffHeight;
        
        // Draw beat grid if enabled
        if (this.showBeatGrid) {
            this.drawBeatGrid();
        }
        
        // Draw playhead cursor
        this.drawPlayheadCursor();
        
        // Draw recording indicators
        this.drawRecordingIndicators();
    }
    
    drawBeatGrid() {
        const ctx = this.notationRenderer.ctx;
        const staffStartX = this.notationRenderer.staffStartX;
        const staffStartY = this.notationRenderer.staffStartY;
        const staffHeight = this.notationRenderer.staffHeight;
        const staffWidth = this.notationRenderer.staffWidth;
        
        // Calculate beat spacing in pixels
        const beatSpacing = this.beatDuration * this.pixelsPerSecond;
        
        // Draw vertical lines for beats
        ctx.strokeStyle = this.beatGridColor;
        ctx.globalAlpha = this.beatGridOpacity;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]); // Dotted lines
        
        // Calculate visible beat range based on scroll offset
        const startBeat = Math.floor(this.notationRenderer.scrollOffset / beatSpacing);
        const endBeat = startBeat + Math.ceil(staffWidth / beatSpacing) + 2;
        
        for (let beat = startBeat; beat <= endBeat; beat++) {
            const x = staffStartX + 90 + (beat * beatSpacing) - this.notationRenderer.scrollOffset;
            
            // Only draw lines within the staff area
            if (x >= staffStartX && x <= staffStartX + staffWidth) {
                const isDownbeat = beat % this.timeSignature[0] === 0;
                
                ctx.beginPath();
                ctx.moveTo(x, staffStartY - 10);
                ctx.lineTo(x, staffStartY + staffHeight + 10);
                
                // Make downbeats slightly more prominent
                if (isDownbeat) {
                    ctx.globalAlpha = this.beatGridOpacity * 1.5;
                    ctx.lineWidth = 1.5;
                } else {
                    ctx.globalAlpha = this.beatGridOpacity;
                    ctx.lineWidth = 1;
                }
                
                ctx.stroke();
            }
        }
        
        // Reset line style
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
    }
    
    drawPlayheadCursor() {
        const ctx = this.notationRenderer.ctx;
        const staffStartY = this.notationRenderer.staffStartY;
        const staffHeight = this.notationRenderer.staffHeight;
        
        // Don't draw if playhead is outside visible area
        const staffStartX = this.notationRenderer.staffStartX;
        const staffEndX = staffStartX + this.notationRenderer.staffWidth;
        
        if (this.playheadPosition < staffStartX || this.playheadPosition > staffEndX) {
            return;
        }
        
        // Draw main cursor line
        ctx.strokeStyle = this.playheadColor;
        ctx.lineWidth = this.playheadWidth;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(this.playheadPosition, staffStartY - 15);
        ctx.lineTo(this.playheadPosition, staffStartY + staffHeight + 15);
        ctx.stroke();
        
        // Draw cursor head (triangle)
        ctx.fillStyle = this.playheadColor;
        ctx.beginPath();
        ctx.moveTo(this.playheadPosition, staffStartY - 15);
        ctx.lineTo(this.playheadPosition - 6, staffStartY - 25);
        ctx.lineTo(this.playheadPosition + 6, staffStartY - 25);
        ctx.closePath();
        ctx.fill();
        
        // Draw time display
        this.drawTimeDisplay();
    }
    
    drawTimeDisplay() {
        const ctx = this.notationRenderer.ctx;
        
        // Format time as MM:SS.ms
        const totalSeconds = this.currentTime;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const milliseconds = Math.floor((totalSeconds % 1) * 100);
        
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        
        // Position time display near playhead
        const x = Math.min(this.playheadPosition + 10, this.notationRenderer.staffStartX + this.notationRenderer.staffWidth - 80);
        const y = this.notationRenderer.staffStartY - 30;
        
        // Draw background
        ctx.fillStyle = 'rgba(255, 71, 87, 0.9)';
        ctx.fillRect(x - 5, y - 12, 70, 16);
        
        // Draw time text
        ctx.fillStyle = 'white';
        ctx.font = '12px "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace';
        ctx.fillText(timeString, x, y);
    }
    
    drawRecordingIndicators() {
        // Add subtle glow effect around the staff during recording
        const ctx = this.notationRenderer.ctx;
        const staffStartX = this.notationRenderer.staffStartX;
        const staffStartY = this.notationRenderer.staffStartY;
        const staffWidth = this.notationRenderer.staffWidth;
        const staffHeight = this.notationRenderer.staffHeight;
        
        // Pulsing glow effect
        const pulseOpacity = 0.1 + 0.05 * Math.sin(this.currentTime * 4); // Gentle pulse
        
        ctx.strokeStyle = this.playheadColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = pulseOpacity;
        
        // Draw subtle border around staff
        ctx.strokeRect(staffStartX - 5, staffStartY - 10, staffWidth + 10, staffHeight + 20);
        
        ctx.globalAlpha = 1.0;
    }
    
    clearPlayhead() {
        // Trigger a full redraw to clear the playhead
        this.notationRenderer.redrawWithScroll();
    }
    
    updateRecordingIndicators(recording) {
        // Update UI elements to show recording state
        const statusText = document.getElementById('statusText');
        const staffContainer = document.querySelector('.staff-container');
        
        if (recording) {
            statusText.style.color = '#ff4757';
            statusText.innerHTML = '🔴 Recording - sing or whistle to add notes';
            
            // Add recording animation to staff container
            if (staffContainer) {
                staffContainer.classList.add('recording-active');
            }
        } else {
            statusText.style.color = '';
            statusText.textContent = 'Click "Start Listening" to begin';
            
            // Remove recording animation
            if (staffContainer) {
                staffContainer.classList.remove('recording-active');
            }
        }
    }
    
    // Public API methods
    getCurrentTime() {
        return this.currentTime;
    }
    
    getPlayheadPosition() {
        return this.playheadPosition;
    }
    
    getBeatInfo() {
        const currentBeat = Math.floor(this.currentTime / this.beatDuration);
        const currentMeasure = Math.floor(currentBeat / this.timeSignature[0]);
        const beatInMeasure = currentBeat % this.timeSignature[0];
        
        return {
            totalBeats: currentBeat,
            currentMeasure: currentMeasure,
            beatInMeasure: beatInMeasure,
            timeInBeat: (this.currentTime % this.beatDuration) / this.beatDuration
        };
    }
    
    // Sync note placement with playhead
    getNotePositionForTime(timestamp) {
        if (!this.recordingStartTime) return null;
        
        const timeInSeconds = (timestamp - this.recordingStartTime) / 1000;
        return this.calculatePlayheadPosition(timeInSeconds);
    }
}