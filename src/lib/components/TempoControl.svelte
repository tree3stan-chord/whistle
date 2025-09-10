<script lang="ts">
  import type { TempoManager } from '../audio/TempoManager.js';
  
  export let tempoManager: TempoManager;
  
  let config = tempoManager.getConfig();
  let playheadInfo = { measure: 1, beat: 1, positionInMeasure: 0, positionInBeat: 0 };
  let isPlaying = false;
  let playheadInterval: number | null = null;
  
  // Reactive updates
  $: tempoManager.updateTempo(config.bpm);
  $: tempoManager.updateTimeSignature(config.timeSignature.numerator, config.timeSignature.denominator);
  
  function startPlayhead() {
    isPlaying = true;
    tempoManager.startTiming();
    
    playheadInterval = setInterval(() => {
      if (isPlaying) {
        playheadInfo = tempoManager.getPlayheadInfo(Date.now());
      }
    }, 50); // Update every 50ms for smooth playhead
  }
  
  function stopPlayhead() {
    isPlaying = false;
    if (playheadInterval) {
      clearInterval(playheadInterval);
      playheadInterval = null;
    }
  }
  
  function resetPlayhead() {
    stopPlayhead();
    tempoManager.reset();
    playheadInfo = { measure: 1, beat: 1, positionInMeasure: 0, positionInBeat: 0 };
  }
  
  // Common tempo presets
  const tempoPresets = [
    { name: 'Largo', bpm: 60 },
    { name: 'Andante', bpm: 76 },
    { name: 'Moderato', bpm: 108 },
    { name: 'Allegro', bpm: 132 },
    { name: 'Presto', bpm: 168 }
  ];
  
  // Common time signatures
  const timeSignatures = [
    { name: '4/4', num: 4, den: 4 },
    { name: '3/4', num: 3, den: 4 },
    { name: '2/4', num: 2, den: 4 },
    { name: '6/8', num: 6, den: 8 }
  ];
</script>

<div class="tempo-control">
  <div class="control-group">
    <label for="bpm-input">Tempo (BPM)</label>
    <div class="bpm-control">
      <input 
        id="bpm-input"
        type="number" 
        bind:value={config.bpm} 
        min="40" 
        max="200" 
        step="1"
        class="bpm-input"
      />
      <div class="tempo-presets">
        {#each tempoPresets as preset}
          <button 
            class="preset-btn"
            class:active={config.bpm === preset.bpm}
            on:click={() => config.bpm = preset.bpm}
            title={`${preset.name} (${preset.bpm} BPM)`}
          >
            {preset.name}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="control-group">
    <label>Time Signature</label>
    <div class="time-signature-control">
      {#each timeSignatures as sig}
        <button 
          class="time-sig-btn"
          class:active={config.timeSignature.numerator === sig.num && config.timeSignature.denominator === sig.den}
          on:click={() => config.timeSignature = { numerator: sig.num, denominator: sig.den }}
        >
          {sig.name}
        </button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <label>Playhead</label>
    <div class="playhead-control">
      <button 
        class="playhead-btn start"
        class:active={isPlaying}
        on:click={startPlayhead}
        disabled={isPlaying}
      >
        ▶ Start
      </button>
      <button 
        class="playhead-btn stop"
        on:click={stopPlayhead}
        disabled={!isPlaying}
      >
        ⏸ Stop
      </button>
      <button 
        class="playhead-btn reset"
        on:click={resetPlayhead}
      >
        ⏹ Reset
      </button>
    </div>
  </div>

  <div class="playhead-display">
    <div class="measure-info">
      <span class="label">Measure:</span>
      <span class="value">{playheadInfo.measure}</span>
    </div>
    <div class="beat-info">
      <span class="label">Beat:</span>
      <span class="value">{playheadInfo.beat}</span>
    </div>
    <div class="progress-bars">
      <div class="progress-container">
        <label>Measure Progress:</label>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {playheadInfo.positionInMeasure * 100}%"></div>
        </div>
      </div>
      <div class="progress-container">
        <label>Beat Progress:</label>
        <div class="progress-bar">
          <div class="progress-fill beat-fill" style="width: {playheadInfo.positionInBeat * 100}%"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .tempo-control {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 280px;
    font-size: 14px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .control-group label {
    font-weight: 600;
    color: #333;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .bpm-control {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bpm-input {
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    width: 80px;
  }

  .tempo-presets {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .preset-btn, .time-sig-btn, .playhead-btn {
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s ease;
  }

  .preset-btn:hover, .time-sig-btn:hover, .playhead-btn:hover {
    background: #f5f5f5;
    border-color: #bbb;
  }

  .preset-btn.active, .time-sig-btn.active {
    background: #007acc;
    color: white;
    border-color: #007acc;
  }

  .time-signature-control {
    display: flex;
    gap: 4px;
  }

  .playhead-control {
    display: flex;
    gap: 6px;
  }

  .playhead-btn {
    padding: 6px 12px;
    font-size: 12px;
  }

  .playhead-btn.start.active {
    background: #28a745;
    color: white;
    border-color: #28a745;
  }

  .playhead-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .playhead-display {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .measure-info, .beat-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .measure-info .label, .beat-info .label {
    font-size: 11px;
    color: #666;
    font-weight: 500;
  }

  .measure-info .value, .beat-info .value {
    font-size: 16px;
    font-weight: bold;
    color: #333;
  }

  .progress-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .progress-container {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .progress-container label {
    font-size: 10px;
    color: #666;
    margin: 0;
    text-transform: none;
    letter-spacing: normal;
  }

  .progress-bar {
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #007acc;
    transition: width 0.05s linear;
  }

  .progress-fill.beat-fill {
    background: #28a745;
  }
</style>