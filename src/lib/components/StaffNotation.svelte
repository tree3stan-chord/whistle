<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pitchResult, notes, isRecording, audioStateActions } from '../stores/audioStore.js';
  import { NoteConverter, type MusicalNote } from '../audio/NoteConverter.js';
  import { SustainedNoteHandler } from '../audio/SustainedNoteHandler.js';
  import { RegisterDetector, type ClefType } from '../audio/RegisterDetector.js';
  import { ExportService } from '../export/ExportService.js';
  import type { TempoManager } from '../audio/TempoManager.js';
  
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
  let sustainedNoteHandler: SustainedNoteHandler;
  let registerDetector: RegisterDetector;
  let currentClef: ClefType = 'treble';
  let measuredClefChanges: Map<number, ClefType> = new Map(); // Track clef changes by measure
  let currentMeasure = 1;
  let notesInCurrentMeasure = 0;
  const NOTES_PER_MEASURE = 4; // 4/4 time signature
  const MEASURES_PER_LINE = 4; // 4 measures per staff line
  const STAFF_LINE_HEIGHT = 120; // Vertical space between staff systems
  
  // Staff rendering constants (base values, will be scaled)
  let STAFF_MARGIN = 50;
  let LINE_SPACING = 12;
  const STAFF_LINES = 5;
  let NOTE_RADIUS = 4;
  let NOTE_SPACING = 20;
  let CLEF_FONT_SIZE = 32;
  
  // Calculate responsive dimensions
  function updateResponsiveDimensions() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    
    // Use 90% of viewport width, accounting for margins and modals
    const availableWidth = Math.max(viewportWidth * 0.9, 600);
    // Use 25% of viewport height for the staff, with minimum and maximum bounds
    const availableHeight = Math.max(Math.min(viewportHeight * 0.25, 300), 150);
    
    responsiveWidth = Math.min(availableWidth, 1200); // Cap at reasonable max
    responsiveHeight = availableHeight;
    
    // Scale constants based on size
    const scaleFactor = Math.min(responsiveWidth / 800, responsiveHeight / 200);
    STAFF_MARGIN = Math.max(50 * scaleFactor, 30);
    LINE_SPACING = Math.max(12 * scaleFactor, 8);
    NOTE_RADIUS = Math.max(4 * scaleFactor, 3);
    NOTE_SPACING = Math.max(20 * scaleFactor, 15);
    CLEF_FONT_SIZE = Math.max(64 * scaleFactor, 48); // Much bigger clef symbols
  }

  onMount(() => {
    updateResponsiveDimensions();
    
    if (canvas) {
      ctx = canvas.getContext('2d')!;
      drawStaff();
      startAnimation();
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
  
  // Reactive: Initialize sustained note handler when tempoManager becomes available
  $: if (tempoManager && !sustainedNoteHandler) {
    console.log('Initializing SustainedNoteHandler with TempoManager');
    sustainedNoteHandler = new SustainedNoteHandler(
      // Callback to update existing note
      (index: number, updatedNote: MusicalNote) => {
        const currentNotes = $notes;
        if (index < currentNotes.length) {
          currentNotes[index] = updatedNote;
          audioStateActions.setNotes([...currentNotes]);
        }
      },
      // Callback to add new note (for ties)
      (note: MusicalNote) => {
        audioStateActions.addNote(note);
      },
      // Pass tempo manager for tempo-aware durations
      tempoManager,
      {
        pitchTolerance: 30,        // Hz - tolerance for pitch matching
        updateInterval: 100        // Update every 100ms
      }
    );
  }
  
  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });
  
  // React to pitch changes with sustained note handling
  $: if ($pitchResult) {
    console.log(`Pitch result: freq=${$pitchResult.frequency?.toFixed(1) || 'null'}Hz, conf=${$pitchResult.confidence?.toFixed(3) || 'null'}, handler=${!!sustainedNoteHandler}`);
    
    if ($pitchResult.confidence > 0.5 && sustainedNoteHandler) {
      console.log(`Processing pitch: ${$pitchResult.frequency.toFixed(1)}Hz, confidence: ${$pitchResult.confidence.toFixed(3)}`);
      const rawNote = NoteConverter.frequencyToNote($pitchResult.frequency, $pitchResult.confidence);
      console.log(`Converted to note: ${rawNote.noteName} (MIDI ${rawNote.midiNumber})`);
      if (NoteConverter.isVocalRange(rawNote.frequency)) {
        processRawNote(rawNote);
      } else {
        console.log(`Frequency ${rawNote.frequency.toFixed(1)}Hz outside vocal range (80-1200Hz)`);
      }
    }
  }
  
  function processRawNote(rawNote: MusicalNote) {
    // Track measures
    notesInCurrentMeasure++;
    if (notesInCurrentMeasure > NOTES_PER_MEASURE) {
      currentMeasure++;
      notesInCurrentMeasure = 1;
    }
    
    // Analyze register and potentially queue clef change
    if (registerDetector) {
      const suggestedClef = registerDetector.analyzeNote(rawNote);
      
      // If at start of measure, apply any queued clef change
      if (notesInCurrentMeasure === 1 && measuredClefChanges.has(currentMeasure)) {
        const newClef = measuredClefChanges.get(currentMeasure)!;
        if (newClef !== currentClef) {
          currentClef = newClef;
          console.log(`Cadenza: Clef changed to ${currentClef} at measure ${currentMeasure}`);
          
          // Recalculate all existing notes for new clef
          if ($notes.length > 0) {
            const updatedNotes = $notes.map(note => ({
              ...note,
              staffPosition: calculateStaffPosition(note, currentClef)
            }));
            audioStateActions.setNotes(updatedNotes);
          }
          
          // Force redraw to show new clef and repositioned notes
          drawStaff();
          measuredClefChanges.delete(currentMeasure); // Remove processed change
        }
      }
      // If mid-measure and clef should change, queue it for next measure
      else if (suggestedClef !== currentClef && !measuredClefChanges.has(currentMeasure + 1)) {
        console.log(`Cadenza: Queuing clef change to ${suggestedClef} for measure ${currentMeasure + 1}`);
        measuredClefChanges.set(currentMeasure + 1, suggestedClef);
      }
    }
    
    // Recalculate staff position for current clef
    const noteWithCorrectStaffPosition = {
      ...rawNote,
      staffPosition: calculateStaffPosition(rawNote, currentClef),
      timestamp: Date.now()
    };
    
    // Process through sustained note handler if available
    if (sustainedNoteHandler) {
      const shouldAddNote = sustainedNoteHandler.processNote(noteWithCorrectStaffPosition, $notes.length);
      
      // Only add as new note if not extending an existing sustained note
      if (shouldAddNote) {
        audioStateActions.addNote(noteWithCorrectStaffPosition);
      }
    } else {
      // Fallback: add note directly if sustainedNoteHandler not ready
      audioStateActions.addNote(noteWithCorrectStaffPosition);
    }
    
    // Keep only last 10 notes for performance (since notes are now longer/sustained)
    if ($notes.length > 10) {
      const recentNotes = $notes.slice(-10);
      audioStateActions.setNotes(recentNotes);
    }
  }
  
  // React to recording state changes
  $: if (sustainedNoteHandler && !$isRecording) {
    // If recording stopped, finalize any sustained notes
    finalizeActiveNotes();
  }
  
  function finalizeActiveNotes() {
    if (!sustainedNoteHandler) return;
    sustainedNoteHandler.finalize();
  }

  function clearNotesAndMeasures() {
    // Clear all notes
    audioStateActions.clearNotes();
    
    // Reset measure tracking
    currentMeasure = 1;
    notesInCurrentMeasure = 0;
    measuredClefChanges.clear();
    
    // Reset clef to default
    currentClef = 'treble';
    
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
  
  function drawStaff() {
    if (!ctx) return;
    
    const currentWidth = responsiveWidth || width;
    const currentHeight = responsiveHeight || height;
    
    // Calculate how many staff lines we need based on measures
    const totalMeasures = Math.max(currentMeasure, 1);
    const linesNeeded = Math.ceil(totalMeasures / MEASURES_PER_LINE);
    
    // Adjust canvas height dynamically for multiple lines
    const neededHeight = Math.max(currentHeight, 150 + (linesNeeded - 1) * STAFF_LINE_HEIGHT);
    if (canvas && canvas.height < neededHeight) {
      canvas.height = neededHeight;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, currentWidth, neededHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, currentWidth, neededHeight);
    
    // Draw all staff systems (lines)
    for (let line = 0; line < linesNeeded; line++) {
      drawStaffSystem(line, currentWidth, neededHeight);
    }
    
    // Draw measure information
    drawMeasureInfo(currentWidth, 150);
    
    // Draw all notes across multiple lines
    drawNotesMultiline(currentWidth, neededHeight, linesNeeded);
  }
  
  function drawStaffSystem(lineIndex: number, currentWidth: number, totalHeight: number) {
    if (!ctx) return;
    
    // Calculate Y position for this staff system
    const staffY = 150 + (lineIndex * STAFF_LINE_HEIGHT);
    
    // Draw staff lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, totalHeight / 200);
    
    const staffStart = STAFF_MARGIN;
    const staffEnd = currentWidth - STAFF_MARGIN;
    
    // Draw 5 staff lines
    for (let i = 0; i < STAFF_LINES; i++) {
      const y = staffY - (LINE_SPACING * 2) + (i * LINE_SPACING);
      ctx.beginPath();
      ctx.moveTo(staffStart, y);
      ctx.lineTo(staffEnd, y);
      ctx.stroke();
    }
    
    // Determine which clef to use for this line
    const firstMeasureOnLine = (lineIndex * MEASURES_PER_LINE) + 1;
    let clefForLine = currentClef;
    
    // Check if there are any clef changes that apply to this line
    for (let measure = firstMeasureOnLine; measure < firstMeasureOnLine + MEASURES_PER_LINE; measure++) {
      if (measuredClefChanges.has(measure)) {
        clefForLine = measuredClefChanges.get(measure)!;
        break;
      }
    }
    
    // Draw clef symbol for this line
    drawClefSymbol(staffStart + 10, staffY, clefForLine);
    
    // Draw measure bars
    drawMeasureBars(lineIndex, staffY, staffStart, staffEnd);
  }

  function drawClefSymbol(x: number, staffY: number, clef?: ClefType) {
    if (!ctx) return;
    
    const clefToUse = clef || currentClef;
    
    ctx.font = `${CLEF_FONT_SIZE}px serif`;
    ctx.fillStyle = '#000000';
    
    // Set text alignment for better centering with larger clefs
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    switch (clefToUse) {
      case 'treble':
        // Treble clef centers on G4 line (2nd line from bottom)
        // G4 is at staff position -2, so Y position should be staffY + LINE_SPACING
        // Adjust slightly to center properly on the G line  
        ctx.fillText('𝄞', x, staffY + (LINE_SPACING * 0.5));
        break;
      case 'bass':
        // Bass clef centers on F line (2nd line from bottom, -LINE_SPACING from center)
        ctx.fillText('𝄢', x, staffY - LINE_SPACING);
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
    if (!ctx) return;
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    const availableWidth = staffEnd - staffStart - (CLEF_FONT_SIZE * 1.5);
    const measureWidth = availableWidth / MEASURES_PER_LINE;
    
    // Draw measure bars (vertical lines)
    for (let i = 0; i <= MEASURES_PER_LINE; i++) {
      const x = staffStart + (CLEF_FONT_SIZE * 1.5) + (i * measureWidth);
      ctx.beginPath();
      ctx.moveTo(x, staffY - (LINE_SPACING * 2));
      ctx.lineTo(x, staffY + (LINE_SPACING * 2));
      ctx.stroke();
    }
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
      if (noteCount >= NOTES_PER_MEASURE) {
        measureNum++;
        noteCount = 0;
      }
    });
    
    // Draw notes on appropriate staff lines
    notesByMeasure.forEach((notesInMeasure, measure) => {
      const lineIndex = Math.floor((measure - 1) / MEASURES_PER_LINE);
      const measureInLine = ((measure - 1) % MEASURES_PER_LINE);
      
      if (lineIndex < linesNeeded) {
        drawMeasureNotes(notesInMeasure, lineIndex, measureInLine, currentWidth);
      }
    });
  }

  function drawMeasureNotes(notesInMeasure: any[], lineIndex: number, measureInLine: number, currentWidth: number) {
    if (!ctx) return;
    
    const staffY = 150 + (lineIndex * STAFF_LINE_HEIGHT);
    const staffStart = STAFF_MARGIN + (CLEF_FONT_SIZE * 1.5);
    const staffEnd = currentWidth - STAFF_MARGIN;
    const availableWidth = staffEnd - staffStart;
    const measureWidth = availableWidth / MEASURES_PER_LINE;
    const measureStart = staffStart + (measureInLine * measureWidth);
    
    // Draw notes within this measure
    let positionInMeasure = 0;
    const noteSpacing = measureWidth / Math.max(notesInMeasure.length, NOTES_PER_MEASURE);
    
    notesInMeasure.forEach(({ note, index }, noteIndex) => {
      const x = measureStart + (noteIndex * noteSpacing) + (noteSpacing / 2);
      const y = staffY - (note.staffPosition * LINE_SPACING / 2);
      
      // Calculate width based on note duration
      const noteWidth = Math.min(calculateNoteWidth(note), noteSpacing * 0.8);
      
      // Draw note symbol
      drawNoteSymbol(x, y, note, noteWidth);
      
      // Draw note name below staff (scaled for multiline)
      const noteFontSize = Math.max(8, CLEF_FONT_SIZE * 0.25);
      ctx.font = `${noteFontSize}px sans-serif`;
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';
      const textY = staffY + (LINE_SPACING * 2.5);
      ctx.fillText(note.noteName, x, textY);
    });
  }

  function drawMeasureInfo(currentWidth: number, staffY: number) {
    if (!ctx) return;
    
    // Draw current measure number
    const measureFontSize = Math.max(12, CLEF_FONT_SIZE * 0.375);
    ctx.font = `${measureFontSize}px Arial`;
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'left';
    ctx.fillText(`Measure ${currentMeasure}`, 10, 30);
    
    // Show notes in current measure
    ctx.fillText(`${notesInCurrentMeasure}/${NOTES_PER_MEASURE}`, 10, 50);
    
    // Show pending clef changes
    if (measuredClefChanges.has(currentMeasure + 1)) {
      const nextClef = measuredClefChanges.get(currentMeasure + 1)!;
      ctx.fillStyle = '#FF9800'; // Orange for pending changes
      ctx.fillText(`Next: ${nextClef} clef`, 10, 70);
    }
    
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
  
  function startAnimation() {
    function animate() {
      drawStaff();
      // Note: drawStaff() already handles drawing notes via drawNotesMultiline()
      animationId = requestAnimationFrame(animate);
    }
    animate();
  }
  
  function calculateStaffPosition(note: MusicalNote, clef: ClefType): number {
    // Calculate staff position relative to the current clef
    const midiNumber = note.midiNumber;
    
    // Reference MIDI numbers for middle line of each clef
    const clefReferences = {
      treble: 71,  // B4 (middle line of treble staff)
      alto: 60,    // C4 (middle line of alto staff)  
      bass: 50     // D3 (middle line of bass staff)
    };
    
    const referenceMidi = clefReferences[clef];
    
    // Calculate position relative to middle line (0 = middle line)
    // Positive = above middle line, negative = below
    return (midiNumber - referenceMidi) / 2;  // Each staff line is 2 semitones
  }

  
  // Expose canvas to parent component for exports
  export { canvas };
</script>

<div class="staff-container">
  <canvas 
    bind:this={canvas} 
    width={responsiveWidth || width} 
    height={responsiveHeight || height}
    class="staff-canvas"
  ></canvas>
</div>

<style>
  .staff-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 10px;
    box-sizing: border-box;
  }
  
  .staff-canvas {
    border: 2px solid #ddd;
    border-radius: 8px;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
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