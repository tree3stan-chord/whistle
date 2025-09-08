<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { AudioService } from '../lib/audio/AudioService.js';
  import { audioState, pitchResult, speechTranscript, isSpeechListening, notes, audioStateActions } from '../lib/stores/audioStore.js';
  import { modalActions, getDefaultModalPositions } from '../lib/stores/modalStore.js';
  import StaffNotation from '../lib/components/StaffNotation.svelte';
  import SessionManager from '../lib/components/SessionManager.svelte';
  import DraggableModal from '../lib/components/DraggableModal.svelte';
  import Navbar from '../lib/components/Navbar.svelte';
  import type { TranscriptionData } from '../lib/export/ExportService.js';
  
  let audioService: AudioService | null = null;
  let mounted = false;
  let staffComponent: StaffNotation;

  // Reactive variables from stores
  $: isRecording = $audioState.isRecording;
  $: isInitialized = $audioState.isInitialized;
  $: error = $audioState.error;
  $: deviceLabel = $audioState.deviceLabel;
  $: currentPitch = $pitchResult;
  $: currentTranscript = $speechTranscript;
  $: speechListening = $isSpeechListening;

  onMount(() => {
    mounted = true;
    audioService = new AudioService();
    
    // Initialize modal positions
    const defaultPositions = getDefaultModalPositions();
    
    // Register all modals with their configurations
    modalActions.registerModal({
      id: 'recording-control',
      title: 'Recording Control',
      initialPosition: defaultPositions['recording-control'],
      minimizable: true,
      persistent: true
    });
    
    modalActions.registerModal({
      id: 'status-monitor',
      title: 'Status Monitor',
      initialPosition: defaultPositions['status-monitor'],
      minimizable: true,
      persistent: true
    });
    
    modalActions.registerModal({
      id: 'session-manager',
      title: 'Session Manager',
      initialPosition: defaultPositions['session-manager'],
      minimizable: true,
      persistent: true
    });
    
    modalActions.registerModal({
      id: 'lyrics-panel',
      title: 'Lyrics',
      initialPosition: defaultPositions['lyrics-panel'],
      minimizable: true,
      persistent: true
    });
  });

  onDestroy(async () => {
    if (audioService) {
      await audioService.cleanup();
    }
  });

  async function initializeAudio() {
    if (!audioService) return;
    
    try {
      await audioService.initialize();
    } catch (err) {
      console.error('Failed to initialize audio:', err);
    }
  }

  async function startRecording() {
    if (!audioService) return;
    
    try {
      if (!isInitialized) {
        await audioService.initialize();
      }
      await audioService.startRecording();
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }

  function stopRecording() {
    if (!audioService) return;
    audioService.stopRecording();
  }

  function formatFrequency(freq: number | null): string {
    return freq ? `${freq.toFixed(1)} Hz` : '--';
  }

  function formatConfidence(conf: number): string {
    return `${(conf * 100).toFixed(0)}%`;
  }

  function handleLoadSession(data: TranscriptionData) {
    // Clear current transcript and set new lyrics
    audioStateActions.setSpeechTranscript(data.lyrics);
    
    // Load notes using centralized store
    audioStateActions.setNotes(data.notes);
  }
</script>

<svelte:head>
  <title>Cadenza - Vocal Transcription</title>
</svelte:head>

<main class="app-container">
  <!-- Static Navbar -->
  <Navbar 
    {isInitialized}
    {mounted}
    onInitializeAudio={initializeAudio}
  />

  <!-- Full Viewport Staff Canvas -->
  <div class="staff-canvas-container">
    <StaffNotation bind:this={staffComponent} width={1200} height={800} />
  </div>

  <!-- Recording Control Modal -->
  <DraggableModal config={{
    id: 'recording-control',
    title: 'Recording Control',
    initialPosition: { x: 20, y: 80 },
    minimizable: true,
    persistent: true
  }}>
    <div class="recording-controls">
      {#if isInitialized}
        {#if !isRecording}
          <button 
            on:click={startRecording}
            class="btn btn-success btn-large"
          >
            🎤 Start Recording
          </button>
        {:else}
          <button 
            on:click={stopRecording}
            class="btn btn-danger btn-large"
          >
            ⏹ Stop Recording
          </button>
        {/if}
      {:else}
        <p class="info-text">Initialize audio from the navbar first</p>
      {/if}
    </div>
  </DraggableModal>

  <!-- Status Monitor Modal -->
  <DraggableModal config={{
    id: 'status-monitor',
    title: 'Status Monitor',
    initialPosition: { x: window?.innerWidth - 320 || 800, y: 80 },
    minimizable: true,
    persistent: true
  }}>
    <div class="status-grid">
      <div class="status-item">
        <span class="status-label">Status:</span>
        <span class="status-value" class:recording={isRecording}>
          {#if error}
            ❌ Error
          {:else if isRecording}
            🎤 Recording
          {:else if isInitialized}
            ✅ Ready
          {:else}
            ⏸ Not initialized
          {/if}
        </span>
      </div>

      <div class="status-item">
        <span class="status-label">Device:</span>
        <span class="status-value">
          {deviceLabel || 'None'}
        </span>
      </div>

      <div class="status-item">
        <span class="status-label">Frequency:</span>
        <span class="status-value frequency">
          {formatFrequency(currentPitch?.frequency ?? null)}
        </span>
      </div>

      <div class="status-item">
        <span class="status-label">Confidence:</span>
        <span class="status-value confidence">
          {formatConfidence(currentPitch?.confidence ?? 0)}
        </span>
      </div>
    </div>
  </DraggableModal>

  <!-- Session Manager Modal -->
  <DraggableModal config={{
    id: 'session-manager',
    title: 'Session Manager',
    initialPosition: { x: 20, y: window?.innerHeight - 200 || 400 },
    minimizable: true,
    persistent: true
  }}>
    <SessionManager 
      notes={$notes}
      lyrics={currentTranscript}
      onLoadSession={handleLoadSession}
      staffCanvas={staffComponent?.canvas || null}
    />
  </DraggableModal>

  <!-- Lyrics Panel Modal -->
  <DraggableModal config={{
    id: 'lyrics-panel',
    title: 'Lyrics',
    initialPosition: { x: window?.innerWidth - 320 || 600, y: window?.innerHeight - 200 || 400 },
    minimizable: true,
    persistent: true
  }}>
    <div class="lyrics-content">
      <div class="lyrics-status">
        {#if speechListening}
          <span class="listening-indicator">🔴 Listening for lyrics...</span>
        {:else}
          <span class="not-listening">Speech recognition inactive</span>
        {/if}
      </div>
      
      <div class="lyrics-display">
        {#if currentTranscript.trim()}
          <p class="transcript">{currentTranscript}</p>
        {:else}
          <p class="no-lyrics">Start singing with words to see lyrics here</p>
        {/if}
      </div>
      
      <button 
        on:click={() => audioStateActions.setSpeechTranscript('')}
        class="clear-lyrics-btn"
        disabled={!currentTranscript.trim()}
      >
        Clear Lyrics
      </button>
    </div>
  </DraggableModal>

  <!-- Error Message Modal (if any) -->
  {#if error}
    <DraggableModal config={{
      id: 'error-modal',
      title: 'Error',
      initialPosition: { x: window?.innerWidth / 2 - 150 || 300, y: 120 },
      minimizable: false,
      persistent: false
    }} className="error-modal">
      <div class="error-content">
        <p class="error-message">{error}</p>
        <button 
          on:click={() => audioStateActions.setError(null)}
          class="btn btn-secondary"
        >
          Clear Error
        </button>
      </div>
    </DraggableModal>
  {/if}

  <!-- Fixed Clear Notes Button -->
  <button 
    class="clear-notes-btn fixed-btn"
    on:click={() => audioStateActions.clearNotes()}
    disabled={$notes.length === 0}
  >
    Clear Notes ({$notes.length})
  </button>
</main>

<style>
  .app-container {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  }

  .staff-canvas-container {
    position: absolute;
    top: 60px; /* Account for navbar height */
    left: 0;
    width: 100%;
    height: calc(100% - 60px);
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Recording Controls */
  .recording-controls {
    text-align: center;
  }

  .btn-large {
    font-size: 16px;
    padding: 12px 24px;
    width: 100%;
  }

  .info-text {
    color: #666;
    font-style: italic;
    text-align: center;
    margin: 0;
  }

  /* Status Grid */
  .status-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  .status-label {
    font-weight: 500;
    color: #666;
    font-size: 12px;
  }

  .status-value {
    font-family: 'Monaco', 'Menlo', monospace;
    font-weight: 500;
    font-size: 12px;
  }

  .status-value.recording {
    color: #dc3545;
    animation: pulse 1s infinite;
  }

  .frequency {
    color: #007bff;
  }

  .confidence {
    color: #28a745;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Lyrics Content */
  .lyrics-content {
    min-width: 250px;
  }

  .lyrics-status {
    font-size: 0.85rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .listening-indicator {
    color: #dc3545;
    font-weight: 500;
    animation: pulse 1s infinite;
  }

  .not-listening {
    color: #6c757d;
    font-style: italic;
  }

  .lyrics-display {
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .transcript {
    font-size: 14px;
    line-height: 1.3;
    color: #495057;
    margin: 0;
    text-align: left;
    font-family: Georgia, serif;
  }

  .no-lyrics {
    color: #6c757d;
    font-style: italic;
    margin: 0;
    font-size: 12px;
  }

  .clear-lyrics-btn {
    padding: 6px 12px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    width: 100%;
  }

  .clear-lyrics-btn:hover:not(:disabled) {
    background: #545b62;
  }

  .clear-lyrics-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Error Modal */
  .error-content {
    text-align: center;
  }

  .error-message {
    color: #721c24;
    margin-bottom: 1rem;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 12px;
  }

  /* Button Styles */
  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }


  .btn-success {
    background: #28a745;
    color: white;
  }

  .btn-success:hover:not(:disabled) {
    background: #1e7e34;
  }

  .btn-danger {
    background: #dc3545;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #c82333;
  }

  .btn-secondary {
    background: #6c757d;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #545b62;
  }

  .fixed-btn {
    position: fixed;
    bottom: 2rem;
    right: 50%;
    transform: translateX(50%);
    z-index: 20;
    padding: 12px 24px;
    background: rgba(40, 167, 69, 0.9);
    color: white;
    border: none;
    border-radius: 25px;
    font-weight: 500;
    cursor: pointer;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
    box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
  }

  .fixed-btn:hover:not(:disabled) {
    background: rgba(40, 167, 69, 1);
    transform: translateX(50%) translateY(-2px);
    box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
  }

  .fixed-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }


  .status-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  .status-label {
    font-weight: 500;
    color: #666;
  }

  .status-value {
    font-family: 'Monaco', 'Menlo', monospace;
    font-weight: 500;
  }

  .status-value.recording {
    color: #dc3545;
    animation: pulse 1s infinite;
  }

  .frequency {
    color: #007bff;
  }

  .confidence {
    color: #28a745;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }


  .error-message {
    color: #721c24;
    margin-bottom: 1rem;
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .lyrics-status {
    font-size: 0.85rem;
  }

  .listening-indicator {
    color: #dc3545;
    font-weight: 500;
    animation: pulse 1s infinite;
  }

  .not-listening {
    color: #6c757d;
    font-style: italic;
  }

  .lyrics-display {
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .transcript {
    font-size: 14px;
    line-height: 1.3;
    color: #495057;
    margin: 0;
    text-align: left;
    font-family: Georgia, serif;
  }

  .no-lyrics {
    color: #6c757d;
    font-style: italic;
    margin: 0;
  }

  .clear-lyrics-btn {
    padding: 6px 12px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    width: 100%;
  }

  .clear-lyrics-btn:hover:not(:disabled) {
    background: #545b62;
  }

  .clear-lyrics-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>