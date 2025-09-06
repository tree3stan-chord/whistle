<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pitchResult } from '../stores/audioStore.js';
  import { NoteConverter, type MusicalNote } from '../audio/NoteConverter.js';
  
  export let width = 800;
  export let height = 200;
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let notes: MusicalNote[] = [];
  let animationId: number;
  
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
  });
  
  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });
  
  // React to pitch changes
  $: if ($pitchResult && $pitchResult.confidence > 0.7) {
    const note = NoteConverter.frequencyToNote($pitchResult.frequency, $pitchResult.confidence);
    if (NoteConverter.isVocalRange(note.frequency)) {
      addNote(note);
    }
  }
  
  function addNote(note: MusicalNote) {
    // Add note with timestamp
    const noteWithTime = {
      ...note,
      timestamp: Date.now()
    };
    
    notes = [...notes, noteWithTime];
    
    // Keep only last 20 notes for performance
    if (notes.length > 20) {
      notes = notes.slice(-20);
    }
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
    
    notes.forEach((note, index) => {
      const x = staffStart + (index * NOTE_SPACING);
      const y = staffY - (note.staffPosition * LINE_SPACING / 2);
      
      // Draw note head
      ctx.fillStyle = note.confidence > 0.8 ? '#000000' : '#666666';
      ctx.beginPath();
      ctx.ellipse(x, y, NOTE_RADIUS, NOTE_RADIUS * 0.8, 0, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw stem
      const stemHeight = LINE_SPACING * 3;
      const stemDirection = note.staffPosition > 0 ? -1 : 1;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + NOTE_RADIUS * 0.8, y);
      ctx.lineTo(x + NOTE_RADIUS * 0.8, y + (stemHeight * stemDirection));
      ctx.stroke();
      
      // Draw ledger lines if needed
      drawLedgerLines(x, y, note.staffPosition);
      
      // Draw note name below staff
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#666666';
      const textWidth = ctx.measureText(note.noteName).width;
      ctx.fillText(note.noteName, x - textWidth/2, height - 20);
    });
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
    notes = [];
  }
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
      Notes: {notes.length}
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