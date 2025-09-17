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
  let ctx: CanvasRenderingContext2D;
  let animationId: number;
  
  // Canvas panning state
  let isPanning = false;
  let panOffset = { x: 0, y: 0 };
  let lastPanPoint = { x: 0, y: 0 };
  let transcriptionEngine: SimpleTranscriptionEngine;
  
  // Playhead state
  let playheadPosition = { x: 0, y: 0, visible: false };
  let currentActiveNoteIndex = -1;
  
  // Time-based playhead tracking
  let recordingStartTime = 0;
  let playheadAnimationId: number | null = null;
  let currentBeat = 0;
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
    if ($isRecording && $pitchResult) {
      const now = Date.now();

      // Throttle pitch processing for sustained notes
      if (now - lastPitchProcessTime >= PITCH_PROCESS_INTERVAL) {
        lastPitchProcessTime = now;
        console.log('🎤 Pitch detected:', $pitchResult.frequency?.toFixed(1) + 'Hz', 'confidence:', $pitchResult.confidence?.toFixed(3));

        if ($pitchResult.frequency && $pitchResult.confidence > 0.4) {
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
          }
        }
      }
    }

    updatePlayhead();
  }

  // React to recording state changes
  $: {
    if ($isRecording) {
      console.log('🔴 Recording started in StaffNotation');
      // Start playhead animation
      if (!playheadAnimationId) {
        recordingStartTime = Date.now();
        currentBeat = 0;
        playheadPosition.visible = true;
        animatePlayhead();
      }
    } else {
      console.log('⏹️ Recording stopped in StaffNotation');

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

      // Stop playhead animation
      if (playheadAnimationId) {
        cancelAnimationFrame(playheadAnimationId);
        playheadAnimationId = null;
      }
      playheadPosition.visible = false;
      currentActiveNoteIndex = -1;
    }
  }
  
  let lastNoteTime = 0;
  let currentSustainNote: MusicalNote | null = null;
  let sustainStartTime = 0;
  const PITCH_TOLERANCE = 50; // Hz tolerance for same pitch
  const MIN_SUSTAIN_DURATION = 300; // ms minimum to register as sustained

  function addNoteDirectly(rawNote: MusicalNote) {
    const now = Date.now();

    // Determine clef for this note
    const clef = registerDetector.analyzeNote(rawNote);

    // Calculate staff position with the determined clef
    const staffPosition = calculateStaffPosition(rawNote, clef);

    // Check if this continues the current sustain
    console.log('🔍 Sustain check:', {
      hasCurrentSustainNote: !!currentSustainNote,
      currentSustainNote: currentSustainNote ? {
        noteName: currentSustainNote.noteName,
        frequency: currentSustainNote.frequency.toFixed(1)
      } : null,
      newRawNote: {
        noteName: rawNote.noteName,
        frequency: rawNote.frequency.toFixed(1)
      },
      isSamePitchResult: currentSustainNote ? isSamePitch(rawNote, currentSustainNote) : false
    });

    if (currentSustainNote && isSamePitch(rawNote, currentSustainNote)) {
      // Extend existing note duration
      const sustainDuration = now - sustainStartTime;
      const noteValue = calculateNoteValue(sustainDuration);

      console.log('🎵 Extending sustain:', {
        noteName: rawNote.noteName,
        sustainDuration: sustainDuration.toFixed(0) + 'ms',
        noteValue: noteValue
      });

      // Update the existing note with new duration
      const updatedNote = {
        ...currentSustainNote,
        duration: sustainDuration,
        noteValue: noteValue
      };

      // Update the note in the store
      const currentNotes = $notes;
      if (currentNotes.length > 0) {
        currentNotes[currentNotes.length - 1] = updatedNote;
        audioStateActions.setNotes([...currentNotes]);
      }

      return;
    }

    // End previous sustain if exists
    if (currentSustainNote) {
      const finalDuration = now - sustainStartTime;
      console.log('🎵 Ending sustain:', currentSustainNote.noteName, finalDuration.toFixed(0) + 'ms');
    }

    // Start new note/sustain
    sustainStartTime = now;

    // Use the same timing source as the playhead
    const noteCurrentBeat = currentBeat;

    // Create new note
    const completeNote: MusicalNote = {
      ...rawNote,
      staffPosition,
      clef,
      noteIndex: $notes.length,
      timestamp: now,
      beatPosition: noteCurrentBeat,
      duration: MIN_SUSTAIN_DURATION, // Start with minimum duration
      noteValue: 'quarter'
    };

    console.log('🎵 New note started:', {
      originalRawNote: {
        noteName: rawNote.noteName,
        frequency: rawNote.frequency.toFixed(1),
        midiNumber: rawNote.midiNumber
      },
      finalCompleteNote: {
        noteName: completeNote.noteName,
        frequency: completeNote.frequency.toFixed(1),
        midiNumber: completeNote.midiNumber,
        staffPosition: completeNote.staffPosition
      },
      beatPosition: currentBeat.toFixed(2)
    });

    // Store as current sustain
    currentSustainNote = completeNote;

    // Add to the notes store
    audioStateActions.addNote(completeNote);

    // Update active note index for playhead
    currentActiveNoteIndex = $notes.length - 1;
    lastNoteTime = now;
  }

  function isSamePitch(note1: MusicalNote, note2: MusicalNote): boolean {
    const freqDiff = Math.abs(note1.frequency - note2.frequency);
    const midiDiff = Math.abs(note1.midiNumber - note2.midiNumber);

    // Same if frequency is close OR MIDI note is same
    return freqDiff <= PITCH_TOLERANCE || midiDiff <= 0.5;
  }

  function calculateNoteValue(duration: number): string {
    const bpm = 120;
    const beatDuration = (60 * 1000) / bpm; // ms per beat
    const ratio = duration / beatDuration;

    if (ratio >= 3.5) return 'whole';
    if (ratio >= 1.75) return 'half';
    if (ratio >= 0.875) return 'quarter';
    if (ratio >= 0.4375) return 'eighth';
    return 'sixteenth';
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
  function animatePlayhead() {
    if (!$isRecording) {
      stopTimeBasedPlayhead();
      return;
    }
    
    // Calculate elapsed time and current beat position using actual tempo
    const elapsedMs = Date.now() - recordingStartTime;
    const tempoConfig = tempoManager.getConfig();
    const bpm = tempoConfig.bpm;
    const beatsPerMs = bpm / (60 * 1000);
    currentBeat = elapsedMs * beatsPerMs;
    
    // Calculate position on staff
    updatePlayheadFromBeat(currentBeat);
    
    // Continue animation
    playheadAnimationId = requestAnimationFrame(animatePlayhead);
  }
  
  /**
   * Update playhead position based on current beat using unified coordinate system
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
    
    // Calculate exact staff lines needed - only what's necessary
    const totalNotes = $notes.length;
    const notesPerLine = 16;
    const linesNeeded = totalNotes > 0 ? Math.ceil(totalNotes / notesPerLine) : 1;
    
    // Calculate needed height
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

    // Draw notes using multi-staff layout
    drawNotesMultiline(currentWidth, neededHeight, linesNeeded);
    
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

    $notes.forEach((note, index) => {
      // Use beat position for timing, same as playhead calculation
      const beatPosition = (note as any).beatPosition || 0;

      // Use actual time signature from TempoManager
      const tempoConfig = tempoManager.getConfig();
      const beatsPerMeasure = tempoConfig.timeSignature.numerator;
      const measuresPerLine = config.staffLayout.measuresPerStaffLine;
      const measureNum = Math.floor(beatPosition / beatsPerMeasure);
      const beatInMeasure = beatPosition % beatsPerMeasure;
      const lineIndex = Math.floor(measureNum / measuresPerLine);
      const measureInLine = measureNum % measuresPerLine;

      const staffY = 150 + (lineIndex * 120); // Simple staff Y calculation
      const staffStart = 120; // Simple clef space
      const staffEnd = currentWidth - 50;
      const availableWidth = staffEnd - staffStart;
      const measureWidth = availableWidth / measuresPerLine;
      const beatSpacing = measureWidth / beatsPerMeasure;
      const x = staffStart + (measureInLine * measureWidth) + (beatInMeasure * beatSpacing);

      // Calculate Y position based on staff position
      const y = staffY - (note.staffPosition * (config.staffLayout.lineSpacing / 2));

      // Debug note positioning
      if (index === $notes.length - 1) { // Only log the latest note
        console.log('🎨 Drawing note:', {
          index,
          noteName: note.noteName,
          beatPosition: beatPosition.toFixed(2),
          lineIndex,
          measureNum,
          beatInMeasure: beatInMeasure.toFixed(2),
          x: x.toFixed(1),
          y: y.toFixed(1),
          staffY: staffY
        });
      }

      // Draw note
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Draw note name below staff
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(note.noteName, x, staffY + 40);

      // Also draw beat position for debugging
      ctx.fillText('♩' + beatPosition.toFixed(1), x, staffY + 52);
    });
  }

  function drawStaffSystem(lineIndex: number, currentWidth: number, totalHeight: number) {
    if (!ctx) return;
    
    // Calculate Y position for this staff system
    const staffY = scoreConfig.getStaffY(lineIndex);
    
    // Draw staff lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, totalHeight / 200);
    
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
    // Calculate staff position relative to the current clef
    const midiNumber = note.midiNumber;
    
    // Staff positions are integers where:
    // 0 = middle line of staff
    // positive = above middle line
    // negative = below middle line
    // Each line/space is 1 position (not 2 semitones as incorrectly calculated before)
    
    if (clef === 'treble') {
      // Treble clef: B4 (MIDI 71) is the middle line (position 0)
      // Each semitone step changes staff position by 0.5 (line to space or space to line)
      const middleLineMidi = 71; // B4
      return (midiNumber - middleLineMidi) * 0.5;
    } else if (clef === 'bass') {
      // Bass clef: D3 (MIDI 50) is the middle line (position 0)  
      const middleLineMidi = 50; // D3
      return (midiNumber - middleLineMidi) * 0.5;
    } else if (clef === 'alto') {
      // Alto clef: C4 (MIDI 60) is the middle line (position 0)
      const middleLineMidi = 60; // C4
      return (midiNumber - middleLineMidi) * 0.5;
    }
    
    return 0;
  }

  
  // Expose canvas to parent component for exports
  export { canvas };
</script>

<div class="staff-container">
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
    overflow: hidden;
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