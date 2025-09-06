<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pitchResult, notes, isRecording, audioStateActions } from '../stores/audioStore.js';
  import { NoteConverter, type MusicalNote } from '../audio/NoteConverter.js';
  import { SustainedNoteHandler } from '../audio/SustainedNoteHandler.js';
  import { ExportService } from '../export/ExportService.js';
  
  export let width = 800;
  export let height = 200;
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let animationId: number;
  let sustainedNoteHandler: SustainedNoteHandler;
  
  // Staff rendering constants
  const STAFF_MARGIN = 50;
  const LINE_SPACING = 12;
  const STAFF_LINES = 5;
  const NOTE_RADIUS = 4;
  const NOTE_SPACING = 20;
  
  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d')!;
      drawStaff();
      startAnimation();
    }
    
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
  });
  
  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });
  
  // React to pitch changes with sustained note handling
  $: if ($pitchResult && $pitchResult.confidence > 0.7 && sustainedNoteHandler) {
    const rawNote = NoteConverter.frequencyToNote($pitchResult.frequency, $pitchResult.confidence);
    if (NoteConverter.isVocalRange(rawNote.frequency)) {
      processRawNote(rawNote);
    }
  }
  
  function processRawNote(rawNote: MusicalNote) {
    // Add timestamp for sustained note processing
    const noteWithTime = {
      ...rawNote,
      timestamp: Date.now()
    };
    
    // Process through sustained note handler
    const shouldAddNote = sustainedNoteHandler.processNote(noteWithTime, $notes.length);
    
    // Only add as new note if not extending an existing sustained note
    if (shouldAddNote) {
      audioStateActions.addNote(noteWithTime);
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
  
  function drawStaff() {
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Draw staff lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    
    const staffY = height / 2;
    const staffStart = STAFF_MARGIN;
    const staffEnd = width - STAFF_MARGIN;
    
    // Draw 5 staff lines
    for (let i = 0; i < STAFF_LINES; i++) {
      const y = staffY - (LINE_SPACING * 2) + (i * LINE_SPACING);
      ctx.beginPath();
      ctx.moveTo(staffStart, y);
      ctx.lineTo(staffEnd, y);
      ctx.stroke();
    }
    
    // Draw treble clef symbol (simplified)
    ctx.font = '32px serif';
    ctx.fillStyle = '#000000';
    ctx.fillText('𝄞', staffStart + 10, staffY + 5);
  }
  
  function drawNotes() {
    if (!ctx) return;
    
    const staffY = height / 2;
    const staffStart = STAFF_MARGIN + 60; // After clef
    
    // Calculate positions based on note durations, not just index
    let cumulativeWidth = 0;
    $notes.forEach((note, index) => {
      const x = staffStart + cumulativeWidth;
      const y = staffY - (note.staffPosition * LINE_SPACING / 2);
      
      // Calculate width based on note duration
      const noteWidth = calculateNoteWidth(note);
      
      // Draw note based on duration
      drawNoteSymbol(x, y, note, noteWidth);
      
      // Draw duration text below staff for debugging
      if (note.duration) {
        ctx.fillStyle = '#888888';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        const durationText = `${Math.round(note.duration)}ms`;
        ctx.fillText(durationText, x, staffY + LINE_SPACING * 4);
        
        // Show note value
        if (note.noteValue) {
          ctx.fillText(note.noteValue, x, staffY + LINE_SPACING * 5);
        }
      }
      
      // Draw ledger lines if needed
      drawLedgerLines(x, y, note.staffPosition);
      
      // Draw note name below staff
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#666666';
      const textWidth = ctx.measureText(note.noteName).width;
      ctx.fillText(note.noteName, x - textWidth/2, height - 20);
      
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
    
    // For very long sustained notes, draw a horizontal line to show duration
    if (note.duration && note.duration > 3000 && noteWidth > NOTE_RADIUS * 3) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]); // Dashed line
      ctx.beginPath();
      ctx.moveTo(x + NOTE_RADIUS * 2, y - 8);
      ctx.lineTo(x + noteWidth - NOTE_RADIUS, y - 8);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash
      
      // Add duration text for very long notes
      ctx.fillStyle = '#666666';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      const durationText = `${Math.round(note.duration / 1000)}s`;
      ctx.fillText(durationText, x + noteWidth / 2, y - 12);
    }
  }
  
  function drawTie(x: number, y: number, noteWidth: number, tieType: string, color: string) {
    if (!ctx) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    
    const tieY = y + NOTE_RADIUS + 2; // Position tie below the note
    
    if (tieType === 'start') {
      // Draw tie extending to the right
      ctx.beginPath();
      ctx.arc(x + noteWidth, tieY, 8, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    } else if (tieType === 'end') {
      // Draw tie extending from the left
      ctx.beginPath();
      ctx.arc(x, tieY, 8, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    } else if (tieType === 'continue') {
      // Draw ties on both sides
      ctx.beginPath();
      ctx.arc(x, tieY, 6, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(x + noteWidth, tieY, 6, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
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
  
  function clearNotes() {
    audioStateActions.clearNotes();
    if (sustainedNoteHandler) {
      sustainedNoteHandler.reset();
    }
  }
  
  // Expose canvas to parent component for exports
  export { canvas };
</script>

<div class="staff-container">
  <canvas 
    bind:this={canvas} 
    {width} 
    {height}
    class="staff-canvas"
  ></canvas>
  <div class="controls">
    <button on:click={clearNotes} class="clear-btn">
      Clear Staff
    </button>
    <div class="note-info">
      Notes: {$notes.length}
    </div>
  </div>
</div>

<style>
  .staff-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  .staff-canvas {
    border: 2px solid #ddd;
    border-radius: 8px;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .clear-btn {
    padding: 8px 16px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  
  .clear-btn:hover {
    background: #c82333;
  }
  
  .note-info {
    font-size: 14px;
    color: #666;
    font-family: monospace;
  }
</style>