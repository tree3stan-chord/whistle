<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { AudioService } from '../lib/audio/AudioService.js';
  import { audioState, pitchResult, speechTranscript, isSpeechListening, audioStateActions } from '../lib/stores/audioStore.js';
  import StaffNotation from '../lib/components/StaffNotation.svelte';
  
  let audioService: AudioService | null = null;
  let mounted = false;

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
</script>

<svelte:head>
  <title>Whistle - Audio Test</title>
</svelte:head>

<main class="container">
  <header>
    <h1>🎵 Whistle - Vocal Transcription</h1>
    <p>Sing melodies with lyrics and see them transcribed to musical notation</p>
  </header>

  <section class="controls">
    <div class="button-group">
      {#if !isInitialized}
        <button 
          on:click={initializeAudio}
          disabled={!mounted}
          class="btn btn-primary"
        >
          Initialize Audio
        </button>
      {:else if !isRecording}
        <button 
          on:click={startRecording}
          class="btn btn-success"
        >
          🎤 Start Recording
        </button>
      {:else}
        <button 
          on:click={stopRecording}
          class="btn btn-danger"
        >
          ⏹ Stop Recording
        </button>
      {/if}
    </div>
  </section>

  <section class="status">
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
  </section>

  {#if error}
    <section class="error">
      <h3>❌ Error</h3>
      <p class="error-message">{error}</p>
      <button 
        on:click={() => audioStateActions.setError(null)}
        class="btn btn-secondary"
      >
        Clear Error
      </button>
    </section>
  {/if}

  <section class="staff-section">
    <h3>Staff Notation</h3>
    <p>Notes will appear here as you sing</p>
    <StaffNotation width={800} height={200} />
  </section>

  <section class="lyrics-section">
    <h3>🎤 Lyrics</h3>
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
    
    <div class="lyrics-controls">
      <button 
        on:click={() => audioStateActions.setSpeechTranscript('')}
        class="clear-lyrics-btn"
        disabled={!currentTranscript.trim()}
      >
        Clear Lyrics
      </button>
    </div>
  </section>

  <section class="debug">
    <h3>Debug Info</h3>
    <pre>{JSON.stringify({
      isInitialized,
      isRecording,
      deviceLabel,
      pitchResult: currentPitch,
      error
    }, null, 2)}</pre>
  </section>
</main>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  header {
    text-align: center;
    margin-bottom: 2rem;
  }

  h1 {
    color: #333;
    margin-bottom: 0.5rem;
  }

  .controls {
    text-align: center;
    margin-bottom: 2rem;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0056b3;
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

  .status {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: white;
    border-radius: 4px;
    border: 1px solid #e9ecef;
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

  .error {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .error h3 {
    margin-top: 0;
    color: #721c24;
  }

  .error-message {
    color: #721c24;
    margin-bottom: 1rem;
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .debug {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .debug h3 {
    margin-top: 0;
    color: #495057;
  }

  .debug pre {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 1rem;
    overflow-x: auto;
    font-size: 12px;
    color: #495057;
  }

  .staff-section {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
    text-align: center;
  }

  .staff-section h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
    color: #495057;
  }

  .staff-section p {
    color: #6c757d;
    margin-bottom: 1.5rem;
    font-style: italic;
  }

  .lyrics-section {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
    text-align: center;
  }

  .lyrics-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #495057;
  }

  .lyrics-status {
    margin-bottom: 1rem;
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
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    padding: 2rem;
    margin: 1rem 0;
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .transcript {
    font-size: 18px;
    line-height: 1.4;
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
    padding: 8px 16px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .clear-lyrics-btn:hover:not(:disabled) {
    background: #545b62;
  }

  .clear-lyrics-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>