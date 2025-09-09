<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pitchResult, notes, isRecording, audioStateActions } from '../stores/audioStore.js';
  import { NoteConverter, type MusicalNote } from '../audio/NoteConverter.js';
  import { SustainedNoteHandler } from '../audio/SustainedNoteHandler.js';
  import { RegisterDetector, type ClefType } from '../audio/RegisterDetector.js';
  import { ExportService } from '../export/ExportService.js';
  
  export let width = 800;
  export let height = 200;
  
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
    
    // Initialize sustained note handler
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
      {
        pitchTolerance: 30,        // Hz - tolerance for pitch matching
        minSustainDuration: 500,   // 500ms = 0.5 beats
        maxSingleNoteDuration: 6000, // 6 seconds max before tying
        updateInterval: 100        // Update every 100ms
      }
    );
    
    // Initialize register detector
    registerDetector = new RegisterDetector();
  
  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });
  
  // React to pitch changes with sustained note handling
  $: if ($pitchResult && $pitchResult.confidence > 0.5 && sustainedNoteHandler) {
    console.log(`Pitch detected: ${$pitchResult.frequency.toFixed(1)}Hz, confidence: ${$pitchResult.confidence.toFixed(3)}`);
    const rawNote = NoteConverter.frequencyToNote($pitchResult.frequency, $pitchResult.confidence);
    console.log(`Converted to note: ${rawNote.noteName} (MIDI ${rawNote.midiNumber})`);
    if (NoteConverter.isVocalRange(rawNote.frequency)) {
      processRawNote(rawNote);
    } else {
      console.log(`Frequency ${rawNote.frequency.toFixed(1)}Hz outside vocal range (80-1200Hz)`);
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
    
    // Process through sustained note handler
    const shouldAddNote = sustainedNoteHandler.processNote(noteWithCorrectStaffPosition, $notes.length);
    
    // Only add as new note if not extending an existing sustained note
    if (shouldAddNote) {
      audioStateActions.addNote(noteWithCorrectStaffPosition);
    }
    
    // Keep only last 10 notes for performance (since notes are now longer/sustained)
    if ($notes.length > 10) {
      const recentNotes = $notes.slice(-10);
      audioStateActions.setNotes(recentNotes);
    }
  }
  
  // React to recording state changes
  $: if (sustainedNoteHandler) {
    // If recording stopped, finalize any sustained notes
    if (!$isRecording) {
      finalizeActiveNotes();
    }
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
    
    // Clear canvas
    ctx.clearRect(0, 0, currentWidth, currentHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, currentWidth, currentHeight);
    
    // Draw staff lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, currentHeight / 200); // Scale line width
    
    const staffY = currentHeight / 2;
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
    
    // Draw clef symbol based on current clef
    drawClefSymbol(staffStart + 10, staffY);
    
    // Draw measure information
    drawMeasureInfo(currentWidth, staffY);
  }
  
  function drawClefSymbol(x: number, staffY: number) {
    if (!ctx) return;
    
    ctx.font = `${CLEF_FONT_SIZE}px serif`;
    ctx.fillStyle = '#000000';
    
    // Set text alignment for better centering with larger clefs
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    switch (currentClef) {
      case 'treble':
        // Treble clef centers on G line (2nd line from bottom, -LINE_SPACING from center)
        ctx.fillText('𝄞', x, staffY - LINE_SPACING);
        break;
      case 'bass':
        // Bass clef centers on F line (4th line from bottom, +LINE_SPACING from center)
        ctx.fillText('𝄢', x, staffY + LINE_SPACING);
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

  function drawNotes() {
    if (!ctx) return;
    
    const currentHeight = responsiveHeight || height;
    const staffY = currentHeight / 2;
    const staffStart = STAFF_MARGIN + (CLEF_FONT_SIZE * 1.5); // After clef, scaled
    
    // Calculate positions based on note durations, not just index
    let cumulativeWidth = 0;
    $notes.forEach((note, index) => {
      const x = staffStart + cumulativeWidth;
      const y = staffY - (note.staffPosition * LINE_SPACING / 2);
      
      // Calculate width based on note duration
      const noteWidth = calculateNoteWidth(note);
      
      // Draw note based on duration
      drawNoteSymbol(x, y, note, noteWidth);
      
      // Draw enhanced duration display for sustained notes
      if (note.duration) {
        ctx.fillStyle = note.duration > 1000 ? '#2196F3' : '#888888'; // Blue for sustained notes
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        // Show duration in more readable format
        const durationSeconds = note.duration / 1000;
        const durationText = durationSeconds >= 1 ? 
          `${durationSeconds.toFixed(1)}s` : 
          `${Math.round(note.duration)}ms`;
        
        const durationFontSize = Math.max(8, CLEF_FONT_SIZE * 0.25);
        ctx.font = `${durationFontSize}px Arial`;
        ctx.fillText(durationText, x, staffY + LINE_SPACING * 4);
        
        // Show note value with sustaining indicator
        if (note.noteValue) {
          const sustainIndicator = note.duration > 1000 ? ' 🎵' : '';
          ctx.fillText(note.noteValue + sustainIndicator, x, staffY + LINE_SPACING * 5);
        }
        
        // Add visual sustaining indicator for notes being extended
        if (note.duration > 800 && !((note as any).tied)) {
          ctx.fillStyle = '#4CAF50';
          const sustainFontSize = Math.max(6, CLEF_FONT_SIZE * 0.19);
          ctx.font = `${sustainFontSize}px Arial`;
          ctx.fillText('sustaining...', x, y - NOTE_RADIUS - 8);
        }
      }
      
      // Draw ledger lines if needed
      drawLedgerLines(x, y, note.staffPosition);
      
      // Draw note name below staff
      const noteFontSize = Math.max(10, CLEF_FONT_SIZE * 0.31);
      ctx.font = `${noteFontSize}px sans-serif`;
      ctx.fillStyle = '#666666';
      const textWidth = ctx.measureText(note.noteName).width;
      ctx.fillText(note.noteName, x - textWidth/2, currentHeight - (STAFF_MARGIN * 0.4));
      
      // Update cumulative width for next note
      cumulativeWidth += noteWidth + NOTE_SPACING;
    });
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
      drawNotes();
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