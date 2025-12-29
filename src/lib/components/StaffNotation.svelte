<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pitchResult, notes, isRecording, audioStateActions } from '../stores/audioStore.js';
  import { NoteConverter, type MusicalNote } from '../audio/NoteConverter.js';
  import { SimpleTranscriptionEngine } from '../audio/SimpleTranscriptionEngine.js';
  import { RegisterDetector, type ClefType } from '../audio/RegisterDetector.js';
  import { ExportService } from '../export/ExportService.js';
  import type { TempoManager } from '../audio/TempoManager.js';
  import { ScoreConfigManager } from '../config/ScoreConfig.js';
  
  export let width = 800;
  export let height = 200;
  export let tempoManager: TempoManager;
  
  // Responsive sizing based on viewport
  let viewportWidth: number;
  let viewportHeight: number;
  let responsiveWidth: number;
  let responsiveHeight: number;
  
  let canvas: HTMLCanvasElement;
  let staffContainer: HTMLDivElement;
  let ctx: CanvasRenderingContext2D;
  let animationId: number;
  
  // Canvas panning state
  let isPanning = false;
  let panOffset = { x: 0, y: 0 };
  let lastPanPoint = { x: 0, y: 0 };
  let transcriptionEngine: SimpleTranscriptionEngine;
  
  // Playhead state - STREAM-BASED design
  let playheadPosition = { x: 0, y: 0, visible: false };
  let currentActiveNoteIndex = -1;
  let streamPosition = 0; // Visual position in the recording stream (0 to ∞)
  
  // Unified timing system - single source of truth
  let recordingStartTime = 0;
  let playheadAnimationId: number | null = null;
  let currentBeat = 0;
  let masterTimePosition = { beat: 0, timestamp: 0, elapsedMs: 0 };
  let registerDetector: RegisterDetector;
  let currentClef: ClefType = 'treble';
  let currentMeasure = 1;
  let notesInCurrentMeasure = 0;
  let measuredClefChanges = new Map<number, ClefType>();
  
  // Staff rendering constants (base values, will be scaled)
  let STAFF_MARGIN = 50;
  let LINE_SPACING = 12;
  let NOTE_RADIUS = 4;
  let NOTE_SPACING = 20;
  let CLEF_FONT_SIZE = 32;

  // Score configuration manager
  const scoreConfig = new ScoreConfigManager();
  let config = scoreConfig.getConfig();

  // Sync ScoreConfig with TempoManager time signature
  $: if (tempoManager) {
    const tempoConfig = tempoManager.getConfig();
    scoreConfig.updateTimeSignature(tempoConfig.timeSignature.numerator, tempoConfig.timeSignature.denominator);
    config = scoreConfig.getConfig();
  }

  // Calculate responsive dimensions
  function updateResponsiveDimensions() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;

    // Use full viewport for canvas (minus navbar height)
    responsiveWidth = viewportWidth;
    responsiveHeight = viewportHeight - 60; // 60px for navbar

    // Update score config with responsive dimensions
    const widthScale = responsiveWidth / config.rendering.baseWidth;
    const heightScale = responsiveHeight / config.rendering.baseHeight;
    const scaleFactor = Math.min(widthScale, heightScale, config.rendering.maxScaleFactor) *
                       (1.0 - config.rendering.scaleReduction);

    scoreConfig.updateRendering({
      baseWidth: responsiveWidth,
      baseHeight: responsiveHeight
    });

    config = scoreConfig.getConfig();

    // Update legacy constants from config
    STAFF_MARGIN = config.staffLayout.staffMargin;
    LINE_SPACING = config.staffLayout.lineSpacing;
    NOTE_RADIUS = config.staffLayout.noteRadius;
    NOTE_SPACING = config.staffLayout.defaultNoteSpacing;
    CLEF_FONT_SIZE = config.staffLayout.clefFontSize;
  }

  onMount(() => {
    updateResponsiveDimensions();
    
    if (canvas) {
      // Ensure canvas dimensions are set properly
      canvas.width = responsiveWidth;
      canvas.height = responsiveHeight;
      
      ctx = canvas.getContext('2d')!;
      drawStaff();
      startAnimation();
      
      // Set up canvas panning
      canvas.style.cursor = 'grab';
      canvas.addEventListener('mousedown', startPan);
    }
    
    // Update on window resize
    const handleResize = () => {
      updateResponsiveDimensions();
      if (ctx) {
        drawStaff();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Listen for clear staff events
    const handleClearStaff = () => {
      clearNotesAndMeasures();
    };
    document.addEventListener('clearStaff', handleClearStaff);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('clearStaff', handleClearStaff);
    };
  });
    
    // Sustained note handler will be initialized reactively when tempoManager is available
    
    // Initialize register detector
    registerDetector = new RegisterDetector();
  
  // Initialize simple transcription engine when tempoManager becomes available
  $: if (tempoManager && !transcriptionEngine) {
    console.log('Initializing SimpleTranscriptionEngine with TempoManager');
    transcriptionEngine = new SimpleTranscriptionEngine(tempoManager);
  }
  
  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    // Clean up panning event listeners
    if (canvas) {
      canvas.removeEventListener('mousedown', startPan);
      document.removeEventListener('mousemove', handlePan);
      document.removeEventListener('mouseup', endPan);
    }
  });
  
  // Canvas panning functions
  function startPan(event: MouseEvent) {
    isPanning = true;
    lastPanPoint = { x: event.clientX, y: event.clientY };
    canvas.style.cursor = 'grabbing';
    
    document.addEventListener('mousemove', handlePan);
    document.addEventListener('mouseup', endPan);
    event.preventDefault();
  }
  
  function handlePan(event: MouseEvent) {
    if (!isPanning) return;
    
    const deltaX = event.clientX - lastPanPoint.x;
    const deltaY = event.clientY - lastPanPoint.y;
    
    panOffset.x += deltaX;
    panOffset.y += deltaY;
    
    lastPanPoint = { x: event.clientX, y: event.clientY };
    
    // Redraw with new offset
    drawStaff();
  }
  
  function endPan() {
    isPanning = false;
    canvas.style.cursor = 'grab';
    
    document.removeEventListener('mousemove', handlePan);
    document.removeEventListener('mouseup', endPan);
  }
  
  
  // Sustain-aware pitch detection with throttling
  let lastPitchProcessTime = 0;
  const PITCH_PROCESS_INTERVAL = 50; // ms - process pitch every 50ms for sustain updates

  $: {
    if ($isRecording) {
      if (!$pitchResult) {
        // Debug: Log when recording but no pitch result
        if (Date.now() % 1000 < 50) { // Log every ~1 second
          console.log('⚠️ Recording active but no pitch result available');
        }
      } else {
        const now = Date.now();

        // Throttle pitch processing for sustained notes
        if (now - lastPitchProcessTime >= PITCH_PROCESS_INTERVAL) {
          lastPitchProcessTime = now;
          console.log('🎤 Pitch detected:', $pitchResult.frequency?.toFixed(1) + 'Hz', 'confidence:', $pitchResult.confidence?.toFixed(3));

          // Require high confidence before creating notes (was 0.01, now 0.5)
          const MIN_NOTE_CONFIDENCE = 0.5;
          if ($pitchResult.frequency && $pitchResult.confidence > MIN_NOTE_CONFIDENCE) {
          const rawNote = NoteConverter.frequencyToNote($pitchResult.frequency, $pitchResult.confidence);

          if (NoteConverter.isVocalRange(rawNote.frequency)) {
            console.log('✅ Processing sustained note:', rawNote.noteName);
            addNoteDirectly(rawNote);
          } else {
            console.log('❌ Note outside vocal range:', rawNote.frequency.toFixed(1) + 'Hz');
          }
        } else {
          // No clear pitch detected - end current sustain
          if (currentSustainNote) {
            const finalDuration = now - sustainStartTime;
            console.log('🎵 Ending sustain due to silence:', currentSustainNote.noteName, finalDuration.toFixed(0) + 'ms');
            currentSustainNote = null;
            stopSustainAnimation();
          }
        }
        }
      }
    }

    updatePlayhead();
  }

  // React to recording state changes with guard to prevent cascading
  let lastRecordingState = false;
  $: {
    if ($isRecording && !lastRecordingState) {
      console.log('🔴 Recording started in StaffNotation');
      lastRecordingState = true;

      // CRITICAL FIX: Clear all existing notes when starting new recording
      console.log('🧹 Clearing existing notes to prevent runaway transcription');
      audioStateActions.setNotes([]);
      currentSustainNote = null;

      // Start stream-based playhead
      recordingStartTime = Date.now();
      streamPosition = 0; // Start at beginning of stream
      playheadPosition.visible = true;
      updatePlayheadFromStreamPosition(streamPosition);
      startStreamPlayhead();
      console.log('🚀 Stream-based playhead started at position:', streamPosition);
    } else if (!$isRecording && lastRecordingState) {
      console.log('⏹️ Recording stopped in StaffNotation');
      lastRecordingState = false;

      // Finalize any current sustain
      if (currentSustainNote) {
        const finalDuration = Date.now() - sustainStartTime;
        const finalNoteValue = calculateNoteValue(finalDuration);

        console.log('🎵 Finalizing sustain on recording stop:', {
          noteName: currentSustainNote.noteName,
          finalDuration: finalDuration.toFixed(0) + 'ms',
          finalNoteValue: finalNoteValue
        });

        // Update the final note
        const updatedNote = {
          ...currentSustainNote,
          duration: finalDuration,
          noteValue: finalNoteValue
        };

        const currentNotes = $notes;
        if (currentNotes.length > 0) {
          currentNotes[currentNotes.length - 1] = updatedNote;
          audioStateActions.setNotes([...currentNotes]);
        }

        currentSustainNote = null;
      }

      // Stop stream playhead
      stopStreamPlayhead();
      currentActiveNoteIndex = -1;
    }
  }
  
  let lastNoteTime = 0;
  let currentSustainNote: MusicalNote | null = null;
  let sustainStartTime = 0;
  let lastAudioInputTime = 0;
  let sustainAnimationId: number | null = null;
  const PITCH_TOLERANCE = 50; // Hz tolerance - tightened for accurate sustain (was 100)
  const MIDI_TOLERANCE = 1.0; // semitones - only allow 1 semitone for vibrato (was 3.0)
  const SUSTAIN_TIMEOUT = 500; // ms - end sustain if no input for this long
  const MIN_SUSTAIN_DURATION = 300; // ms minimum to register as sustained
  const NOTE_CHANGE_DEBOUNCE_MS = 150; // ms - minimum time between different notes

  // Pitch smoothing to prevent erratic jumps
  let pitchHistory: number[] = [];
  const PITCH_HISTORY_SIZE = 5; // Keep last 5 pitch readings for smoothing

  /**
   * Start sustain animation for visual feedback
   */
  function startSustainAnimation() {
    if (sustainAnimationId) return; // Already running

    const animate = () => {
      if (currentSustainNote && $isRecording) {
        // Trigger canvas re-render for pulsing effect
        drawStaff();
        sustainAnimationId = requestAnimationFrame(animate);
      } else {
        sustainAnimationId = null;
      }
    };
    sustainAnimationId = requestAnimationFrame(animate);
  }

  /**
   * Stop sustain animation
   */
  function stopSustainAnimation() {
    if (sustainAnimationId) {
      cancelAnimationFrame(sustainAnimationId);
      sustainAnimationId = null;
    }
  }

  /**
   * Smooth pitch using median filter to prevent erratic jumps
   */
  function smoothPitch(frequency: number): number {
    pitchHistory.push(frequency);

    // Keep only recent history
    if (pitchHistory.length > PITCH_HISTORY_SIZE) {
      pitchHistory.shift();
    }

    // Use median of recent readings for stability
    const sorted = [...pitchHistory].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }

  function addNoteDirectly(rawNote: MusicalNote) {
    const now = Date.now();

    // Apply pitch smoothing to reduce erratic jumps
    const smoothedFrequency = smoothPitch(rawNote.frequency);
    const smoothedNote = { ...rawNote, frequency: smoothedFrequency };

    // Check if current sustain should timeout due to audio gap
    if (currentSustainNote && lastAudioInputTime > 0 && (now - lastAudioInputTime) > SUSTAIN_TIMEOUT) {
      console.log('🎵 Sustain timeout - ending due to audio gap');
      currentSustainNote = null;
    }

    lastAudioInputTime = now;

    // Determine clef for this note
    const clef = registerDetector.analyzeNote(smoothedNote);

    // Calculate staff position with the determined clef
    const staffPosition = calculateStaffPosition(smoothedNote, clef);

    // Debug: verify staff position calculation
    console.log('📍 Staff Position Calc:', {
      noteName: smoothedNote.noteName,
      midiNumber: smoothedNote.midiNumber,
      clef: clef,
      staffPosition: staffPosition,
      expectedLine: staffPosition === -4 ? 'E4 (bottom)' :
                    staffPosition === -2 ? 'G4' :
                    staffPosition === 0 ? 'B4 (middle)' :
                    staffPosition === 2 ? 'D5' :
                    staffPosition === 4 ? 'F5 (top)' : 'ledger/space'
    });

    // Check if this continues the current sustain
    console.log('🔍 Sustain check:', {
      hasCurrentSustainNote: !!currentSustainNote,
      currentSustainNote: currentSustainNote ? {
        noteName: currentSustainNote.noteName,
        frequency: currentSustainNote.frequency.toFixed(1)
      } : null,
      newSmoothedNote: {
        noteName: smoothedNote.noteName,
        frequency: smoothedNote.frequency.toFixed(1)
      },
      isSamePitchResult: currentSustainNote ? isSamePitch(smoothedNote, currentSustainNote) : false
    });

    // FUNDAMENTAL REDESIGN: Only ONE note can exist at the playhead position

    if (currentSustainNote && isSamePitch(smoothedNote, currentSustainNote)) {
      // Same pitch: extend the current note's duration at its CURRENT position
      const sustainDuration = now - sustainStartTime;
      const noteValue = calculateNoteValue(sustainDuration);

      console.log('🎵 Extending sustain - playhead stays put:', {
        noteName: smoothedNote.noteName,
        sustainDuration: sustainDuration.toFixed(0) + 'ms',
        noteValue: noteValue,
        visualTransition: 'eighth→quarter→half→whole',
        staysAtPosition: currentSustainNote.beatPosition.toFixed(2),
        playheadStick: 'PLAYHEAD_STAYS_WITH_SUSTAIN'
      });

      // Update the existing note with new duration (position stays same as when it was created)
      const updatedNote = {
        ...currentSustainNote,
        duration: sustainDuration,
        noteValue: noteValue
        // Keep original beatPosition - don't move the note
      };

      // Update in store
      const currentNotes = $notes;
      if (currentNotes.length > 0) {
        currentNotes[currentNotes.length - 1] = updatedNote;
        audioStateActions.setNotes([...currentNotes]);
        currentSustainNote = updatedNote;
      }

      return; // Don't create new note
    }

    // Check minimum time between notes to prevent rapid-fire note creation
    if (currentSustainNote && (now - sustainStartTime) < MIN_SUSTAIN_DURATION) {
      console.log('🚫 Skipping note - too soon after previous note (preventing spam)');
      return; // Don't create note if previous note was too recent
    }

    // Debounce rapid note changes - require gap before switching to a different note
    if (currentSustainNote && (now - sustainStartTime) < NOTE_CHANGE_DEBOUNCE_MS) {
      // Only skip if pitch actually changed
      if (!isSamePitch(smoothedNote, currentSustainNote)) {
        console.log('🚫 Debouncing rapid note change - waiting for stability');
        return;
      }
    }

    // Different pitch: create new note at wherever the playhead currently is
    console.log('🎯 New pitch detected - placing note at current time position');

    // End previous sustain
    if (currentSustainNote) {
      const finalDuration = now - sustainStartTime;
      console.log('🎵 Ending sustain:', currentSustainNote.noteName, finalDuration.toFixed(0) + 'ms');
    }

    // Start new note/sustain at the current time position (where playhead is)
    sustainStartTime = now;

    // STREAM-BASED: Place note at current stream position
    const noteStreamPosition = streamPosition;

    console.log('🎯 Note creation - at stream position:', {
      streamPosition: streamPosition.toFixed(1),
      noteStreamPosition: noteStreamPosition.toFixed(1),
      noteFollowsStream: true
    });

    // Create new note
    const completeNote: MusicalNote = {
      ...smoothedNote,
      staffPosition,
      clef,
      noteIndex: $notes.length,
      timestamp: now,
      beatPosition: noteStreamPosition, // Store stream position (will update note interface later)
      streamPosition: noteStreamPosition, // Add stream position property
      duration: MIN_SUSTAIN_DURATION, // Start with minimum duration
      noteValue: 'eighth' // Start as eighth note, will grow with sustain
    };

    console.log('🎵 New note started:', {
      originalRawNote: {
        noteName: smoothedNote.noteName,
        frequency: smoothedNote.frequency.toFixed(1),
        midiNumber: smoothedNote.midiNumber
      },
      finalCompleteNote: {
        noteName: completeNote.noteName,
        frequency: completeNote.frequency.toFixed(1),
        midiNumber: completeNote.midiNumber,
        staffPosition: completeNote.staffPosition
      },
      beatPosition: noteStreamPosition.toFixed(2)
    });

    // Store as current sustain
    currentSustainNote = completeNote;

    // Disable sustain animation to prevent visual artifacts
    // startSustainAnimation();

    // Add to the notes store
    audioStateActions.addNote(completeNote);

    // Update tracking variables
    currentActiveNoteIndex = $notes.length;  // Will be length after note is added
    lastNoteTime = now;

    // STREAM-BASED: No artificial advancement - playhead continues smoothly
    // Note is placed at current stream position, playhead keeps moving

    console.log('🎯 Note placed in stream:', {
      activeNoteIndex: currentActiveNoteIndex,
      totalNotes: $notes.length + 1,
      notePlacedAt: noteStreamPosition.toFixed(1),
      streamContinues: 'PLAYHEAD_FLOWS_CONTINUOUSLY'
    });
  }

  function isSamePitch(note1: MusicalNote, note2: MusicalNote): boolean {
    // Use MIDI-based comparison only (semitone-aware)
    // This handles vibrato correctly regardless of absolute frequency
    const midiDiff = Math.abs(note1.midiNumber - note2.midiNumber);

    // Within tolerance = same note (allows for vibrato)
    const isSameNote = midiDiff <= MIDI_TOLERANCE;

    console.log('🔍 isSamePitch:', {
      note1: note1.noteName,
      note2: note2.noteName,
      midiDiff: midiDiff.toFixed(2),
      tolerance: MIDI_TOLERANCE,
      result: isSameNote
    });

    return isSameNote;
  }

  function calculateNoteValue(duration: number): string {
    // Use actual BPM from TempoManager for accurate duration calculation
    const tempoConfig = tempoManager.getConfig();
    const bpm = tempoConfig.bpm;
    const beatDuration = (60 * 1000) / bpm; // ms per beat
    const ratio = duration / beatDuration;

    // Progressive visual growth: eighth → quarter → half → whole
    if (ratio >= 3.0) return 'whole';    // 3+ beats = whole note
    if (ratio >= 1.5) return 'half';     // 1.5+ beats = half note
    if (ratio >= 0.75) return 'quarter'; // 0.75+ beats = quarter note
    if (ratio >= 0.375) return 'eighth'; // 0.375+ beats = eighth note
    return 'sixteenth';                  // < 0.375 beats = sixteenth note
  }

  

  function clearNotesAndMeasures() {
    // Clear all notes
    audioStateActions.clearNotes();
    
    // Reset measure tracking
    currentMeasure = 1;
    notesInCurrentMeasure = 0;
    
    // Reset clef to default
    currentClef = 'treble';
    
    // Reset playhead
    currentActiveNoteIndex = -1;
    playheadPosition.visible = false;
    
    // Reset register detector
    if (registerDetector) {
      registerDetector.reset();
    }
    
    // Redraw empty staff
    drawStaff();
    
    console.log('Cadenza: Notes and measure tracking cleared');
  }

  // Expose the clear function to parent components
  export { clearNotesAndMeasures };

  /**
   * Update playhead position based on current active note
   */
  function updatePlayhead() {
    if (!$isRecording) {
      playheadPosition.visible = false;
      return;
    }

    // Use ScoreConfig's time translation utilities for consistent positioning
    const now = Date.now();
    const currentWidth = responsiveWidth || width;

    const timePosition = scoreConfig.timestampToPosition(
      now,
      recordingStartTime,
      currentWidth
    );

    const x = timePosition.pixelX;
    const staffY = timePosition.pixelY;

    // Update playhead position
    playheadPosition.x = x;
    playheadPosition.y = staffY;
    playheadPosition.visible = true;
  }

  /**
   * Start time-based playhead advancement
   */
  function startTimeBasedPlayhead() {
    recordingStartTime = Date.now();
    currentBeat = 0;
    playheadPosition.visible = true;
    animatePlayhead();
  }
  
  /**
   * Stop time-based playhead advancement
   */
  function stopTimeBasedPlayhead() {
    if (playheadAnimationId) {
      cancelAnimationFrame(playheadAnimationId);
      playheadAnimationId = null;
    }
    playheadPosition.visible = false;
  }
  
  /**
   * Animate playhead based on elapsed time and BPM
   */
  /**
   * Master timing function - updates unified time position
   */
  function updateMasterTime() {
    const now = Date.now();
    const elapsedMs = now - recordingStartTime;
    const tempoConfig = tempoManager.getConfig();
    const bpm = tempoConfig.bpm;
    const beatsPerMs = bpm / (60 * 1000);
    const beat = elapsedMs * beatsPerMs;

    // Update master time position
    masterTimePosition = { beat, timestamp: now, elapsedMs };
    currentBeat = beat; // Keep legacy variable for compatibility
  }

  /**
   * STREAM-BASED PLAYHEAD: Advances smoothly through the recording stream
   */
  function startStreamPlayhead() {
    if (!$isRecording) return;

    // Calculate stream advancement rate (pixels per second)
    const advancementRate = 50; // 50 pixels per second - adjust for comfortable reading
    const elapsedMs = Date.now() - recordingStartTime;
    const elapsedSeconds = elapsedMs / 1000;

    // Update stream position
    streamPosition = elapsedSeconds * advancementRate;

    // Update visual playhead position
    updatePlayheadFromStreamPosition(streamPosition);

    // Continue animation
    playheadAnimationId = requestAnimationFrame(startStreamPlayhead);
  }

  function stopStreamPlayhead() {
    if (playheadAnimationId) {
      cancelAnimationFrame(playheadAnimationId);
      playheadAnimationId = null;
    }
    playheadPosition.visible = false;
  }

  
  /**
   * Update playhead position based on stream position (pixels from start)
   */
  function updatePlayheadFromStreamPosition(position: number) {
    const currentWidth = responsiveWidth || width;
    const staffMargin = 120; // Left margin for clef
    const rightMargin = 50;
    const usableWidth = currentWidth - staffMargin - rightMargin;

    // Calculate which staff line we're on
    const staffLineWidth = usableWidth;
    const currentStaffLine = Math.floor(position / staffLineWidth);
    const positionOnLine = position % staffLineWidth;

    // Calculate playhead coordinates
    const x = staffMargin + positionOnLine;
    const y = 150 + (currentStaffLine * 120); // 120px between staff lines

    console.log('🎯 Stream playhead position:', {
      streamPosition: position.toFixed(1),
      staffLine: currentStaffLine,
      positionOnLine: positionOnLine.toFixed(1),
      x: x.toFixed(1),
      y: y
    });

    // Update playhead position
    playheadPosition.x = x;
    playheadPosition.y = y;
    playheadPosition.visible = true;

    // Auto-scroll to keep playhead visible
    if (staffContainer && $isRecording) {
      const containerHeight = staffContainer.clientHeight;
      const scrollTop = staffContainer.scrollTop;
      const playheadY = y;

      // If playhead is below visible area, scroll down
      const bottomMargin = 100; // Keep some margin at bottom
      if (playheadY > scrollTop + containerHeight - bottomMargin) {
        staffContainer.scrollTo({
          top: playheadY - containerHeight + bottomMargin + 50,
          behavior: 'smooth'
        });
      }
    }
  }

  /**
   * Legacy function - Update playhead position based on current beat using unified coordinate system
   */
  function updatePlayheadFromBeat(beat: number) {
    const currentWidth = responsiveWidth || width;

    // Use actual time signature from TempoManager
    const tempoConfig = tempoManager.getConfig();
    const beatsPerMeasure = tempoConfig.timeSignature.numerator;
    const beatsPerStaffLine = config.staffLayout.measuresPerStaffLine * beatsPerMeasure;
    const staffLine = Math.floor(beat / beatsPerStaffLine);

    // Calculate position within the staff line
    const beatOnLine = beat - (staffLine * beatsPerStaffLine);
    const measureOnLine = Math.floor(beatOnLine / beatsPerMeasure);
    const beatInMeasure = beatOnLine % beatsPerMeasure;

    // Simple positioning calculation
    const staffY = 150 + (staffLine * 120);
    const staffStart = 120;
    const staffEnd = currentWidth - 50;
    const availableWidth = staffEnd - staffStart;
    const measureWidth = availableWidth / config.staffLayout.measuresPerStaffLine;
    const beatSpacing = measureWidth / beatsPerMeasure;
    const x = staffStart + (measureOnLine * measureWidth) + (beatInMeasure * beatSpacing);


    // Update playhead position
    playheadPosition.x = x;
    playheadPosition.y = staffY;
    playheadPosition.visible = true;
  }
  
  /**
   * Get current playhead time position for note placement
   */
  function getCurrentPlayheadTime(): number {
    return currentBeat;
  }
  
  function drawStaff() {
    if (!ctx) return;

    const currentWidth = responsiveWidth || width;
    const currentHeight = responsiveHeight || height;

    // Calculate staff lines needed based on BOTH notes AND playhead position
    // This ensures we always have a staff line for where the playhead is
    const staffMargin = 120;
    const usableWidth = currentWidth - staffMargin;
    const staffLineWidth = usableWidth > 0 ? usableWidth : 1;

    // Lines needed for playhead position (always need at least the line the playhead is on + 1 buffer)
    const playheadStaffLine = Math.floor(streamPosition / staffLineWidth);
    const linesForPlayhead = playheadStaffLine + 2; // +2 to have buffer ahead

    // Lines needed for existing notes
    const totalNotes = $notes.length;
    const notesPerLine = 16;
    const linesForNotes = totalNotes > 0 ? Math.ceil(totalNotes / notesPerLine) : 1;

    // Use the maximum of both
    const linesNeeded = Math.max(linesForPlayhead, linesForNotes, 1);

    // Calculate needed height (120px per staff system)
    const neededHeight = Math.max(currentHeight, 200 + (linesNeeded - 1) * 150);
    
    // Update canvas size if needed
    if (canvas) {
      if (canvas.height < neededHeight) {
        canvas.height = neededHeight;
        responsiveHeight = neededHeight;
      }
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, currentWidth, neededHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, currentWidth, neededHeight);
    
    // Apply panning transform
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    
    // Draw staff systems with proper multi-staff layout
    for (let line = 0; line < linesNeeded; line++) {
      drawStaffSystem(line, currentWidth, neededHeight);
    }

    // Draw notes using stream-based layout
    drawNotesStream(currentWidth, neededHeight, linesNeeded);
    
    // Draw playhead if visible
    if (playheadPosition.visible) {
      drawPlayhead();
    }
    
    // Restore transform
    ctx.restore();
  }
  
  function drawSingleStaffLine(lineIndex: number, currentWidth: number) {
    if (!ctx) return;
    
    const staffY = scoreConfig.getStaffY(lineIndex); // Simple spacing
    
    // Draw 5 horizontal staff lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 5; i++) {
      const y = staffY - 24 + (i * 12); // 12px spacing between lines
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(currentWidth - 50, y);
      ctx.stroke();
    }
    
    // Draw appropriate clef symbol based on current clef
    ctx.fillStyle = '#000000';
    ctx.font = '80px serif'; // Large clef symbol
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw the appropriate clef for this staff line
    if (currentClef === 'bass') {
      // Bass clef symbol positioned on F line (4th line from bottom)
      ctx.fillText('𝄢', 80, staffY + 12); // Center on F line at staffY + 12
    } else {
      // Treble clef symbol positioned on G line (2nd line from bottom)
      // Since calculateStaffPosition uses B4 as middle line (position 0), and G4 is -2 positions from B4
      // G4 should be 2 lines below the middle: staffY + 24 (2 * 12px line spacing)
      ctx.fillText('𝄞', 80, staffY + 12); // Position on G line
    }
  }
  
  function drawAllNotes(currentWidth: number) {
    if (!ctx || $notes.length === 0) return;

    // CORRECT APPROACH: Draw all notes at their proper positions
    // But ONLY show notes that are at or behind the current playhead position

    const tempoConfig = tempoManager.getConfig();
    const beatsPerMeasure = tempoConfig.timeSignature.numerator;
    const measuresPerLine = config.staffLayout.measuresPerStaffLine;

    $notes.forEach((note, index) => {
      const noteBeatPosition = (note as any).beatPosition || 0;

      // Calculate note's actual position on staff
      const measureNum = Math.floor(noteBeatPosition / beatsPerMeasure);
      const beatInMeasure = noteBeatPosition % beatsPerMeasure;
      const lineIndex = Math.floor(measureNum / measuresPerLine);
      const measureInLine = measureNum % measuresPerLine;

      const staffY = 150 + (lineIndex * 120);
      const staffStart = 120;
      const staffEnd = currentWidth - 50;
      const availableWidth = staffEnd - staffStart;
      const measureWidth = availableWidth / measuresPerLine;
      const beatSpacing = measureWidth / beatsPerMeasure;
      const x = staffStart + (measureInLine * measureWidth) + (beatInMeasure * beatSpacing);

      // Calculate Y position based on staff position
      const y = staffY - (note.staffPosition * (config.staffLayout.lineSpacing / 2));

      // Determine if this is the active note (closest to but not ahead of playhead)
      const isActive = (index === $notes.length - 1) && (noteBeatPosition <= currentBeat);

      // DEBUG: Log every note being drawn
      console.log('🎨 DRAWING NOTE:', {
        index,
        noteName: note.noteName,
        noteBeatPosition: noteBeatPosition.toFixed(3),
        currentPlayheadBeat: currentBeat.toFixed(3),
        difference: (noteBeatPosition - currentBeat).toFixed(3),
        isAheadOfPlayhead: noteBeatPosition > currentBeat,
        xPosition: x.toFixed(1),
        shouldNotBeVisible: noteBeatPosition > currentBeat ? 'YES - BUG!' : 'no'
      });

      // Draw note with different style if active
      ctx.fillStyle = isActive ? '#FF0000' : '#000000'; // Active note in red
      ctx.beginPath();
      ctx.arc(x, y, isActive ? 6 : 4, 0, 2 * Math.PI); // Active note slightly larger
      ctx.fill();

      // Draw note name below staff
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(note.noteName, x, staffY + 40);

      // Draw beat position for debugging
      ctx.fillText('♩' + noteBeatPosition.toFixed(1), x, staffY + 52);
    });
  }

  function drawStaffSystem(lineIndex: number, currentWidth: number, totalHeight: number) {
    if (!ctx) return;
    
    // Calculate Y position for this staff system
    const staffY = scoreConfig.getStaffY(lineIndex);
    
    // Draw staff lines with consistent thickness
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1; // Always 1px thick, regardless of total height
    
    const staffStart = config.staffLayout.staffMargin;
    const staffEnd = currentWidth - config.staffLayout.staffMargin;
    
    // Draw 5 staff lines
    for (let i = 0; i < config.staffLayout.linesPerStaff; i++) {
      const y = staffY - (config.staffLayout.lineSpacing * 2) + (i * config.staffLayout.lineSpacing);
      ctx.beginPath();
      ctx.moveTo(staffStart, y);
      ctx.lineTo(staffEnd, y);
      ctx.stroke();
    }
    
    // Determine which clef to use for this line
    const firstMeasureOnLine = (lineIndex * config.staffLayout.measuresPerStaffLine) + 1;
    let clefForLine = currentClef;
    
    // Check if there are any clef changes that apply to this line
    for (let measure = firstMeasureOnLine; measure < firstMeasureOnLine + config.staffLayout.measuresPerStaffLine; measure++) {
      if (measuredClefChanges.has(measure)) {
        clefForLine = measuredClefChanges.get(measure)!;
        break;
      }
    }
    
    // Draw clef symbol for this line with better positioning
    drawClefSymbol(staffStart + 25, staffY, clefForLine);
    
    // Draw measure bars with increased spacing after clef
    drawMeasureBars(lineIndex, staffY, staffStart, staffEnd);
  }

  function drawClefSymbol(x: number, staffY: number, clef?: ClefType, scale: number = 1.0) {
    if (!ctx) return;
    
    const clefToUse = clef || currentClef;
    
    // Scale the font size for different contexts (main clef vs change clef)
    const scaledClefSize = config.staffLayout.clefFontSize * scale;
    ctx.font = `${scaledClefSize}px serif`;
    ctx.fillStyle = '#000000';
    
    // Set text alignment for better centering with larger clefs
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    switch (clefToUse) {
      case 'treble':
        // Treble clef centers on G4 line (2nd line from bottom)
        // Since calculateStaffPosition uses B4 as middle line (position 0 = staffY), and G4 is -2 positions from B4
        // G4 should be at staffY + lineSpacing (since G4 is one line below middle B4)
        ctx.fillText('𝄞', x, staffY + config.staffLayout.lineSpacing);
        break;
      case 'bass':
        // Bass clef centers on F line (2nd line from bottom, -lineSpacing from center)
        ctx.fillText('𝄢', x, staffY - config.staffLayout.lineSpacing);
        break;
      case 'alto':
        // Alto clef centers exactly on middle line
        ctx.fillText('𝄡', x, staffY);
        break;
    }
    
    // Reset text alignment
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawMeasureBars(lineIndex: number, staffY: number, staffStart: number, staffEnd: number) {
    if (!ctx || !config.staffLayout.showBarlines) return;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    const staffWidth = staffEnd - staffStart;
    const measurePositions = scoreConfig.getMeasurePositions(staffWidth);

    // Draw measure bars (vertical lines)
    measurePositions.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(staffStart + x, staffY - (config.staffLayout.lineSpacing * 2));
      ctx.lineTo(staffStart + x, staffY + (config.staffLayout.lineSpacing * 2));
      ctx.stroke();
    });

    // Draw initial barline at staff start (after clef)
    const clefSpace = config.staffLayout.clefFontSize * 1.5;
    ctx.beginPath();
    ctx.moveTo(staffStart + clefSpace, staffY - (config.staffLayout.lineSpacing * 2));
    ctx.lineTo(staffStart + clefSpace, staffY + (config.staffLayout.lineSpacing * 2));
    ctx.stroke();
  }

  /**
   * STREAM-BASED NOTE RENDERING: Simple left-to-right positioning
   */
  function drawNotesStream(currentWidth: number, totalHeight: number, linesNeeded: number) {
    if (!ctx || $notes.length === 0) return;

    const staffMargin = 120; // Left margin for clef
    const rightMargin = 50;
    const usableWidth = currentWidth - staffMargin - rightMargin;
    const staffLineWidth = usableWidth;

    $notes.forEach((note, index) => {
      // Get stream position from note (stored in beatPosition for now)
      const streamPos = note.streamPosition || note.beatPosition || 0;

      // Calculate which staff line and position
      const staffLineIndex = Math.floor(streamPos / staffLineWidth);
      const positionOnLine = streamPos % staffLineWidth;

      // Calculate coordinates
      const x = staffMargin + positionOnLine;
      const y = 150 + (staffLineIndex * 120); // 120px between staff lines
      const staffY = y;

      // Draw note at stream position
      drawSingleNote(note, x, staffY, index);
    });
  }

  /**
   * Draw a single note at specified coordinates
   */
  function drawSingleNote(note: any, x: number, staffY: number, index: number) {
    if (!ctx) return;

    // Calculate note Y position based on pitch
    const pitchOffset = note.staffPosition * (config.staffLayout.lineSpacing / 2);
    const noteY = staffY - pitchOffset;

    // Use proper note symbol drawing with sustain support
    const isCurrentSustain = (currentSustainNote && index === $notes.length - 1);

    // Special highlight for currently sustaining note
    if (isCurrentSustain) {
      // Draw pulsing background for sustaining note
      const pulseIntensity = Math.sin(Date.now() / 200) * 0.3 + 0.7; // Pulsing between 0.4-1.0
      ctx.fillStyle = `rgba(255, 100, 100, ${pulseIntensity * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(x, noteY, NOTE_RADIUS * 2, NOTE_RADIUS * 1.6, 0, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw the actual note symbol with proper note value rendering
    drawNoteSymbol(x, noteY, note);

    // Draw ledger lines if needed
    drawLedgerLines(x, staffY, note.staffPosition);

    // Enhanced debugging info for sustaining notes
    ctx.fillStyle = isCurrentSustain ? '#FF4444' : '#666666';
    ctx.font = '12px monospace';
    ctx.fillText(note.noteName, x - 10, staffY + 40);

    // Show note value and duration for sustaining note
    if (isCurrentSustain) {
      ctx.fillStyle = '#FF4444';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${note.noteValue} (${note.duration}ms)`, x - 20, staffY + 55);

      // Draw sustain progress bar
      const sustainProgress = Math.min(note.duration / 4000, 1.0); // 4 second max
      const barWidth = NOTE_RADIUS * 4;
      const barHeight = 4;
      const barX = x - barWidth / 2;
      const barY = staffY + 70;

      // Background bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Progress bar
      ctx.fillStyle = '#FF4444';
      ctx.fillRect(barX, barY, barWidth * sustainProgress, barHeight);

      // Sustain level indicator
      const sustainSteps = ['♬', '♩', '♫', '𝅗𝅥']; // sixteenth, eighth, quarter, half
      const stepIndex = Math.min(Math.floor(sustainProgress * 4), 3);
      ctx.fillStyle = '#FF4444';
      ctx.font = 'bold 16px serif';
      ctx.fillText(sustainSteps[stepIndex], x + NOTE_RADIUS * 2.5, noteY);
    }
  }

  // Legacy function for backwards compatibility
  function drawNotesMultiline(currentWidth: number, totalHeight: number, linesNeeded: number) {
    if (!ctx || $notes.length === 0) return;

    // Group notes by measure for proper line placement
    const notesByMeasure = new Map<number, any[]>();
    let measureNum = 1;
    let noteCount = 0;

    $notes.forEach((note, index) => {

      if (!notesByMeasure.has(measureNum)) {
        notesByMeasure.set(measureNum, []);
      }
      notesByMeasure.get(measureNum)!.push({ note, index });

      noteCount++;
      if (noteCount >= config.staffLayout.beatsPerMeasure) {
        measureNum++;
        noteCount = 0;
      }
    });

    // Draw notes on appropriate staff lines
    notesByMeasure.forEach((notesInMeasure, measure) => {
      const lineIndex = Math.floor((measure - 1) / config.staffLayout.measuresPerStaffLine);
      const measureInLine = ((measure - 1) % config.staffLayout.measuresPerStaffLine);


      if (lineIndex < linesNeeded) {
        drawMeasureNotes(notesInMeasure, lineIndex, measureInLine, currentWidth);
      }
    });
  }

  function drawMeasureNotes(notesInMeasure: any[], lineIndex: number, measureInLine: number, currentWidth: number) {
    if (!ctx) return;
    
    const staffY = scoreConfig.getStaffY(lineIndex);
    const layout = scoreConfig.getLayoutCalculations(currentWidth);
    const measureStart = layout.staffStart + (measureInLine * layout.measureWidth);
    
    // Draw notes within this measure
    let positionInMeasure = 0;
    const noteSpacing = layout.measureWidth / Math.max(notesInMeasure.length, config.staffLayout.beatsPerMeasure);
    
    notesInMeasure.forEach(({ note, index }, noteIndex) => {
      const x = measureStart + (noteIndex * noteSpacing) + (noteSpacing / 2);
      
      // Check if this note starts a clef change
      const noteClef = note.clef || 'treble'; // Default to treble for backward compatibility
      const prevNote = index > 0 ? $notes[index - 1] : null;
      const prevClef = prevNote?.clef || 'treble';
      
      // If clef changed, draw a small clef symbol before this note
      if (noteClef !== prevClef && noteIndex === 0) {
        const clefSymbolX = measureStart - (noteSpacing * 0.3);
        drawClefSymbol(clefSymbolX, staffY, noteClef, 0.6); // Smaller clef for mid-staff changes
      }
      
      // Use the note's stored staff position (calculated with its original clef)
      // If no clef is stored, recalculate with current clef for backward compatibility
      let staffPosition = note.staffPosition;
      if (!note.clef) {
        staffPosition = calculateStaffPosition(note, noteClef);
      }
      
      const y = staffY - (staffPosition * config.staffLayout.lineSpacing / 2);
      
      // For the currently sustaining note, calculate live duration and note value
      let noteToRender = note;
      if (currentSustainNote && index === $notes.length - 1 && $isRecording) {
        const currentDuration = Date.now() - sustainStartTime;
        const liveNoteValue = calculateNoteValue(currentDuration);
        noteToRender = {
          ...note,
          duration: currentDuration,
          noteValue: liveNoteValue
        };
      }

      // Calculate width based on note duration
      const noteWidth = Math.min(calculateNoteWidth(noteToRender), noteSpacing * 0.8);

      // Draw note symbol
      drawNoteSymbol(x, y, noteToRender, noteWidth);
      
      // Draw note name below staff (scaled for multiline)
      const noteFontSize = Math.max(8, CLEF_FONT_SIZE * 0.25);
      ctx.font = `${noteFontSize}px sans-serif`;
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';
      const textY = staffY + (LINE_SPACING * 2.5);

      // Show live note value for sustaining notes
      if (currentSustainNote && index === $notes.length - 1 && $isRecording) {
        ctx.fillText(`${note.noteName} (${noteToRender.noteValue})`, x, textY);
      } else {
        ctx.fillText(note.noteName, x, textY);
      }
    });
  }

  function drawMeasureInfo(currentWidth: number, staffY: number) {
    if (!ctx || !config.staffLayout.showMeasureNumbers) return;

    // Draw current measure number
    ctx.font = `${config.staffLayout.measureNumberFontSize}px Arial`;
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'left';
    ctx.fillText(`Measure ${currentMeasure}`, 10, 30);
    ctx.fillText(`${notesInCurrentMeasure}/${config.staffLayout.beatsPerMeasure}`, 10, 50);

    ctx.textAlign = 'center'; // Reset alignment
  }

  
  function calculateNoteWidth(note: MusicalNote): number {
    // Calculate visual width based on note duration
    const baseWidth = NOTE_RADIUS * 2;
    const noteValue = note.noteValue || 'quarter';
    
    // Width multipliers based on note value
    const widthMultipliers = {
      'whole': 4.0,      // Whole notes take more space
      'half': 2.5,       // Half notes take more space  
      'quarter': 1.5,    // Quarter notes are baseline
      'eighth': 1.0,     // Eighth notes are compact
      'sixteenth': 0.8   // Sixteenth notes are very compact
    };
    
    const multiplier = widthMultipliers[noteValue as keyof typeof widthMultipliers] || 1.5;
    return baseWidth * multiplier;
  }

  function drawNoteSymbol(x: number, y: number, note: MusicalNote, noteWidth: number = NOTE_RADIUS * 2) {
    if (!ctx) return;
    
    const color = note.confidence > 0.8 ? '#000000' : '#666666';
    const noteValue = note.noteValue || 'quarter';
    
    // Draw note head - filled for shorter durations, hollow for longer
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    
    const shouldFillHead = ['sixteenth', 'eighth', 'quarter'].includes(noteValue);
    
    ctx.beginPath();
    ctx.ellipse(x, y, NOTE_RADIUS, NOTE_RADIUS * 0.8, 0, 0, 2 * Math.PI);
    if (shouldFillHead) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
    
    // Draw stem for most note types
    if (noteValue !== 'whole') {
      const stemHeight = LINE_SPACING * 3;
      const stemDirection = note.staffPosition > 0 ? -1 : 1;
      
      ctx.beginPath();
      ctx.moveTo(x + NOTE_RADIUS * 0.8, y);
      ctx.lineTo(x + NOTE_RADIUS * 0.8, y + (stemHeight * stemDirection));
      ctx.stroke();
      
      // Add flags for eighth and sixteenth notes
      if (noteValue === 'eighth' || noteValue === 'sixteenth') {
        drawNoteFlag(x + NOTE_RADIUS * 0.8, y + (stemHeight * stemDirection), stemDirection, noteValue === 'sixteenth' ? 2 : 1);
      }
    }
    
    // Draw tie indicators for tied notes
    if ((note as any).tied) {
      drawTie(x, y, noteWidth, (note as any).tied, color);
    }
  }
  
  function drawTie(x: number, y: number, noteWidth: number, tieType: string, color: string) {
    if (!ctx) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2; // Slightly thicker for better visibility
    
    const tieY = y + NOTE_RADIUS + 4; // Position tie below the note
    const tieRadius = 10; // Slightly larger radius
    
    if (tieType === 'start') {
      // Draw tie extending to the right
      ctx.beginPath();
      ctx.arc(x + noteWidth, tieY, tieRadius, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      
      // Add small tie indicator text
      ctx.fillStyle = '#4CAF50';
      const tieFontSize = Math.max(6, CLEF_FONT_SIZE * 0.19);
      ctx.font = `${tieFontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('tie→', x + noteWidth + tieRadius, tieY + 12);
    } else if (tieType === 'end') {
      // Draw tie extending from the left
      ctx.beginPath();
      ctx.arc(x, tieY, tieRadius, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      
      // Add small tie indicator text
      ctx.fillStyle = '#4CAF50';
      const tieFontSize = Math.max(6, CLEF_FONT_SIZE * 0.19);
      ctx.font = `${tieFontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('←end', x - tieRadius, tieY + 12);
    } else if (tieType === 'continue') {
      // Draw ties on both sides
      ctx.beginPath();
      ctx.arc(x, tieY, tieRadius * 0.8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(x + noteWidth, tieY, tieRadius * 0.8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      
      // Add small tie indicator text
      ctx.fillStyle = '#4CAF50';
      const tieFontSize = Math.max(6, CLEF_FONT_SIZE * 0.19);
      ctx.font = `${tieFontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('←tie→', x + noteWidth / 2, tieY + 12);
    }
  }

  function drawNoteFlag(stemX: number, stemEndY: number, direction: number, flagCount: number) {
    if (!ctx) return;
    
    ctx.fillStyle = ctx.strokeStyle;
    for (let i = 0; i < flagCount; i++) {
      const flagY = stemEndY + (direction * i * 4);
      ctx.beginPath();
      ctx.moveTo(stemX, flagY);
      ctx.quadraticCurveTo(stemX + 8, flagY + (direction * 2), stemX + 6, flagY + (direction * 6));
      ctx.quadraticCurveTo(stemX + 2, flagY + (direction * 4), stemX, flagY + (direction * 3));
      ctx.fill();
    }
  }
  
  function drawLedgerLines(x: number, y: number, staffPosition: number) {
    if (!ctx) return;
    
    const lineLength = NOTE_RADIUS * 3;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    
    // Draw ledger lines above staff
    if (staffPosition > 4) {
      const linesNeeded = Math.floor((staffPosition - 4) / 2);
      for (let i = 1; i <= linesNeeded; i++) {
        const ledgerY = y - (i * LINE_SPACING);
        ctx.beginPath();
        ctx.moveTo(x - lineLength, ledgerY);
        ctx.lineTo(x + lineLength, ledgerY);
        ctx.stroke();
      }
    }
    
    // Draw ledger lines below staff
    if (staffPosition < -4) {
      const linesNeeded = Math.floor((Math.abs(staffPosition) - 4) / 2);
      for (let i = 1; i <= linesNeeded; i++) {
        const ledgerY = y + (i * LINE_SPACING);
        ctx.beginPath();
        ctx.moveTo(x - lineLength, ledgerY);
        ctx.lineTo(x + lineLength, ledgerY);
        ctx.stroke();
      }
    }
  }
  
  /**
   * Draw the playhead at the current active note position
   */
  function drawPlayhead() {
    if (!ctx || !playheadPosition.visible) return;
    
    const x = playheadPosition.x;
    const y = playheadPosition.y;
    
    // Draw a vertical line spanning the full staff height
    ctx.strokeStyle = '#FF4444'; // Bright red color
    ctx.lineWidth = 3; // Thick line for visibility
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(x, y - (LINE_SPACING * 2.5)); // Above staff
    ctx.lineTo(x, y + (LINE_SPACING * 2.5)); // Below staff
    ctx.stroke();
    
    // Draw a triangle at the top for better visibility
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.moveTo(x, y - (LINE_SPACING * 2.5));
    ctx.lineTo(x - 5, y - (LINE_SPACING * 2.5) - 8);
    ctx.lineTo(x + 5, y - (LINE_SPACING * 2.5) - 8);
    ctx.closePath();
    ctx.fill();
    
    // Add a subtle glow effect
    ctx.shadowColor = '#FF4444';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x, y - (LINE_SPACING * 2.5));
    ctx.lineTo(x, y + (LINE_SPACING * 2.5));
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function startAnimation() {
    function animate() {
      drawStaff();
      // Note: drawStaff() handles everything - staff lines and notes
      animationId = requestAnimationFrame(animate);
    }
    animate();
  }
  
  function calculateStaffPosition(note: MusicalNote, clef: ClefType): number {
    // Calculate staff position using DIATONIC steps (not chromatic semitones)
    // Staff positions follow the diatonic scale: C, D, E, F, G, A, B
    // Each position is one line or space on the staff
    const midiNumber = note.midiNumber;

    // Map chromatic pitch class (0-11) to diatonic step (0-6)
    // C=0, C#=0, D=1, D#=1, E=2, F=3, F#=3, G=4, G#=4, A=5, A#=5, B=6
    const pitchClassToDiatonic = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

    const octave = Math.floor(midiNumber / 12) - 1; // MIDI octave (C4=60 is octave 4)
    const pitchClass = midiNumber % 12;
    const diatonic = pitchClassToDiatonic[pitchClass];

    // Total diatonic position from C0 (7 notes per octave)
    const totalDiatonic = octave * 7 + diatonic;

    if (clef === 'treble') {
      // Treble clef: B4 (MIDI 71) is the middle line (position 0)
      // B4 diatonic position = 4*7 + 6 = 34
      const refDiatonic = 34;
      return totalDiatonic - refDiatonic;
    } else if (clef === 'bass') {
      // Bass clef: D3 (MIDI 50) is the middle line (position 0)
      // D3 diatonic position = 3*7 + 1 = 22
      const refDiatonic = 22;
      return totalDiatonic - refDiatonic;
    } else if (clef === 'alto') {
      // Alto clef: C4 (MIDI 60) is the middle line (position 0)
      // C4 diatonic position = 4*7 + 0 = 28
      const refDiatonic = 28;
      return totalDiatonic - refDiatonic;
    }

    return 0;
  }

  
  // Expose canvas to parent component for exports
  export { canvas };
</script>

<div class="staff-container" bind:this={staffContainer}>
  <canvas
    bind:this={canvas}
    width={responsiveWidth || 1200}
    height={responsiveHeight || 600}
    class="staff-canvas"
  ></canvas>
</div>

<style>
  .staff-container {
    position: fixed;
    top: 60px; /* Below navbar */
    left: 0;
    width: 100vw;
    height: calc(100vh - 60px);
    overflow: auto; /* Enable scrolling for multiple staff lines */
    padding: 0;
    background: #f8f9fa; /* Light gray background */
    z-index: 1; /* Keep staff below modals (which have z-index: 1000) */
  }
  
  .staff-canvas {
    border: 2px solid #ddd;
    border-radius: 8px;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    display: block;
  }

  /* Ensure responsive behavior */
  @media (max-width: 768px) {
    .staff-container {
      padding: 5px;
    }
    
    .staff-canvas {
      border-width: 1px;
    }
  }
  
</style>