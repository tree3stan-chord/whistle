<script lang="ts">
  import { onMount } from 'svelte';
  import { ExportService, type TranscriptionData } from '../export/ExportService.js';
  import type { MusicalNote } from '../audio/NoteConverter.js';
  
  export let notes: MusicalNote[] = [];
  export let lyrics: string = '';
  export let onLoadSession: (data: TranscriptionData) => void = () => {};
  export let staffCanvas: HTMLCanvasElement | null = null;
  
  let savedSessions: string[] = [];
  let sessionName: string = '';
  let showSaveDialog: boolean = false;
  let showLoadDialog: boolean = false;
  
  onMount(() => {
    refreshSessions();
  });
  
  function refreshSessions() {
    savedSessions = ExportService.listSavedTranscriptions();
  }
  
  function saveSession() {
    if (!sessionName.trim()) {
      alert('Please enter a session name');
      return;
    }
    
    const data: TranscriptionData = {
      notes,
      lyrics,
      timestamp: Date.now(),
      duration: 0, // Could calculate from note timestamps
      title: sessionName
    };
    
    try {
      ExportService.saveToStorage(data, sessionName);
      showSaveDialog = false;
      sessionName = '';
      refreshSessions();
      alert('Session saved successfully!');
    } catch (error) {
      alert('Failed to save session');
      console.error('Save failed:', error);
    }
  }
  
  function loadSession(key: string) {
    try {
      const data = ExportService.loadFromStorage(key);
      if (data) {
        onLoadSession(data);
        showLoadDialog = false;
        alert('Session loaded successfully!');
      } else {
        alert('Failed to load session');
      }
    } catch (error) {
      alert('Failed to load session');
      console.error('Load failed:', error);
    }
  }
  
  function deleteSession(key: string) {
    if (confirm(`Delete session "${key}"?`)) {
      ExportService.deleteFromStorage(key);
      refreshSessions();
      alert('Session deleted');
    }
  }
  
  async function exportToJSON() {
    if (notes.length === 0 && !lyrics.trim()) {
      alert('No data to export');
      return;
    }
    
    const data: TranscriptionData = {
      notes,
      lyrics,
      timestamp: Date.now(),
      duration: 0,
      title: 'Exported Session'
    };
    
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      await ExportService.exportToJSON(data, `whistle-session-${timestamp}`);
    } catch (error) {
      alert('Failed to export JSON');
      console.error('Export failed:', error);
    }
  }
  
  async function exportToPNG() {
    if (!staffCanvas) {
      alert('Staff canvas not available for export');
      return;
    }
    
    if (notes.length === 0) {
      alert('No notes to export');
      return;
    }
    
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      await ExportService.exportCanvasToPNG(staffCanvas, `whistle-staff-${timestamp}`);
    } catch (error) {
      alert('Failed to export PNG');
      console.error('PNG export failed:', error);
    }
  }
  
  async function exportToMIDI() {
    if (notes.length === 0) {
      alert('No notes to export');
      return;
    }
    
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      await ExportService.exportToMIDI(notes, `whistle-melody-${timestamp}`);
    } catch (error) {
      alert('Failed to export MIDI');
      console.error('MIDI export failed:', error);
    }
  }
</script>

<div class="session-manager">
  <div class="session-controls">
    <button on:click={() => showSaveDialog = true} class="session-btn save-btn" disabled={notes.length === 0 && !lyrics.trim()}>
      Save Session
    </button>
    <button on:click={() => showLoadDialog = true} class="session-btn load-btn" disabled={savedSessions.length === 0}>
      Load Session
    </button>
    <button on:click={exportToPNG} class="session-btn export-btn" disabled={notes.length === 0}>
      Export PNG
    </button>
    <button on:click={exportToMIDI} class="session-btn export-btn" disabled={notes.length === 0}>
      Export MIDI
    </button>
    <button on:click={exportToJSON} class="session-btn export-btn" disabled={notes.length === 0 && !lyrics.trim()}>
      Export JSON
    </button>
  </div>
  
  {#if showSaveDialog}
    <div 
      class="dialog-overlay" 
      role="button" 
      tabindex="0"
      on:click={() => showSaveDialog = false}
      on:keydown={(e) => e.key === 'Escape' && (showSaveDialog = false)}
    >
      <div 
        class="dialog" 
        role="dialog"
        aria-labelledby="save-dialog-title"
        on:click|stopPropagation
        on:keydown|stopPropagation
      >
        <h3 id="save-dialog-title">Save Session</h3>
        <input 
          type="text" 
          bind:value={sessionName} 
          placeholder="Enter session name"
          class="session-input"
          on:keydown={(e) => e.key === 'Enter' && saveSession()}
        />
        <div class="dialog-buttons">
          <button on:click={saveSession} class="dialog-btn save">Save</button>
          <button on:click={() => showSaveDialog = false} class="dialog-btn cancel">Cancel</button>
        </div>
      </div>
    </div>
  {/if}
  
  {#if showLoadDialog}
    <div 
      class="dialog-overlay" 
      role="button" 
      tabindex="0"
      on:click={() => showLoadDialog = false}
      on:keydown={(e) => e.key === 'Escape' && (showLoadDialog = false)}
    >
      <div 
        class="dialog" 
        role="dialog"
        aria-labelledby="load-dialog-title"
        on:click|stopPropagation
        on:keydown|stopPropagation
      >
        <h3 id="load-dialog-title">Load Session</h3>
        <div class="session-list">
          {#each savedSessions as session}
            <div class="session-item">
              <span class="session-name">{session}</span>
              <div class="session-actions">
                <button on:click={() => loadSession(session)} class="action-btn load">Load</button>
                <button on:click={() => deleteSession(session)} class="action-btn delete">Delete</button>
              </div>
            </div>
          {/each}
        </div>
        <div class="dialog-buttons">
          <button on:click={() => showLoadDialog = false} class="dialog-btn cancel">Close</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .session-manager {
    margin: 1rem 0;
  }
  
  .session-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .session-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }
  
  .save-btn {
    background: #28a745;
    color: white;
  }
  
  .save-btn:hover:not(:disabled) {
    background: #218838;
  }
  
  .load-btn {
    background: #17a2b8;
    color: white;
  }
  
  .load-btn:hover:not(:disabled) {
    background: #138496;
  }
  
  .export-btn {
    background: #007bff;
    color: white;
  }
  
  .export-btn:hover:not(:disabled) {
    background: #0056b3;
  }
  
  .session-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
  
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .dialog {
    background: white;
    border-radius: 8px;
    padding: 2rem;
    min-width: 400px;
    max-width: 80vw;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .dialog h3 {
    margin: 0 0 1rem 0;
    color: #333;
  }
  
  .session-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 14px;
  }
  
  .session-input:focus {
    outline: none;
    border-color: #007bff;
  }
  
  .session-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 1rem;
  }
  
  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: 1px solid #eee;
    border-radius: 4px;
    margin-bottom: 8px;
  }
  
  .session-name {
    font-weight: 500;
    flex: 1;
  }
  
  .session-actions {
    display: flex;
    gap: 8px;
  }
  
  .action-btn {
    padding: 4px 8px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }
  
  .action-btn.load {
    background: #28a745;
    color: white;
  }
  
  .action-btn.delete {
    background: #dc3545;
    color: white;
  }
  
  .action-btn:hover {
    opacity: 0.8;
  }
  
  .dialog-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }
  
  .dialog-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  
  .dialog-btn.save {
    background: #28a745;
    color: white;
  }
  
  .dialog-btn.cancel {
    background: #6c757d;
    color: white;
  }
  
  .dialog-btn:hover {
    opacity: 0.8;
  }
</style>