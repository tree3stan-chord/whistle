<script lang="ts">
  import { modalActions, modalStates } from '../stores/modalStore.js';
  
  // Modal visibility states
  $: recordingControlVisible = $modalStates['recording-control']?.isVisible ?? true;
  $: statusMonitorVisible = $modalStates['status-monitor']?.isVisible ?? true;
  $: sessionManagerVisible = $modalStates['session-manager']?.isVisible ?? true;
  $: lyricsPanelVisible = $modalStates['lyrics-panel']?.isVisible ?? true;
  $: tempoControlVisible = $modalStates['tempo-control']?.isVisible ?? true;
  
  function toggleModal(modalId: string) {
    const currentState = $modalStates[modalId]?.isVisible ?? true;
    modalActions.setVisible(modalId, !currentState);
  }
  
  // Modal definitions with icons and descriptions
  const modalTools = [
    {
      id: 'recording-control',
      name: 'Recording Control',
      icon: '🎤',
      description: 'Start/stop recording and session controls',
      isVisible: recordingControlVisible
    },
    {
      id: 'status-monitor', 
      name: 'Status Monitor',
      icon: '📊',
      description: 'Real-time pitch and audio level monitoring',
      isVisible: statusMonitorVisible
    },
    {
      id: 'session-manager',
      name: 'Session Manager', 
      icon: '💾',
      description: 'Save, load, and export sessions',
      isVisible: sessionManagerVisible
    },
    {
      id: 'lyrics-panel',
      name: 'Lyrics Panel',
      icon: '🎵',
      description: 'Speech recognition and lyrics display',
      isVisible: lyricsPanelVisible
    },
    {
      id: 'tempo-control',
      name: 'Tempo & Rhythm',
      icon: '⏱️', 
      description: 'BPM, time signature, and playhead control',
      isVisible: tempoControlVisible
    }
  ];
  
  // Count visible modals for status
  $: visibleCount = modalTools.filter(tool => tool.isVisible).length;
  $: totalCount = modalTools.length;
</script>

<div class="toolbox">
  <div class="toolbox-header">
    <h3 class="toolbox-title">🧰 Toolbox</h3>
    <div class="modal-status">
      <span class="status-count">{visibleCount}/{totalCount} panels active</span>
    </div>
  </div>
  
  <div class="tool-grid">
    {#each modalTools as tool}
      <button 
        class="tool-button"
        class:active={tool.isVisible}
        on:click={() => toggleModal(tool.id)}
        title={tool.description}
        aria-label={`Toggle ${tool.name}`}
      >
        <div class="tool-icon" class:dimmed={!tool.isVisible}>
          {tool.icon}
        </div>
        <div class="tool-label" class:dimmed={!tool.isVisible}>
          {tool.name}
        </div>
        <div class="tool-status">
          <div class="status-indicator" class:on={tool.isVisible} class:off={!tool.isVisible}></div>
        </div>
      </button>
    {/each}
  </div>
  
  <div class="toolbox-footer">
    <button 
      class="action-button show-all"
      on:click={() => modalTools.forEach(tool => modalActions.setVisible(tool.id, true))}
      title="Show all panels"
    >
      👁️ Show All
    </button>
    <button 
      class="action-button hide-all" 
      on:click={() => modalTools.forEach(tool => modalActions.setVisible(tool.id, false))}
      title="Hide all panels"
    >
      🙈 Hide All
    </button>
  </div>
</div>

<style>
  .toolbox {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    padding: 16px;
    min-width: 280px;
    max-width: 320px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .toolbox-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  .toolbox-title {
    font-size: 16px;
    font-weight: 700;
    color: #333;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .modal-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .status-count {
    font-size: 11px;
    color: #666;
    font-weight: 500;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
  }

  .tool-grid {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
  }

  .tool-button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    min-height: 44px;
  }

  .tool-button:hover {
    background: rgba(255, 255, 255, 1);
    border-color: rgba(0, 0, 0, 0.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  .tool-button.active {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .tool-button.active:hover {
    background: rgba(16, 185, 129, 0.15);
  }

  .tool-icon {
    font-size: 18px;
    transition: all 0.2s ease;
    min-width: 20px;
    text-align: center;
  }

  .tool-icon.dimmed {
    opacity: 0.4;
    filter: grayscale(0.8);
  }

  .tool-label {
    flex-grow: 1;
    font-size: 13px;
    font-weight: 600;
    color: #333;
    text-align: left;
    transition: all 0.2s ease;
  }

  .tool-label.dimmed {
    opacity: 0.6;
    color: #666;
  }

  .tool-status {
    display: flex;
    align-items: center;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .status-indicator.on {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
  }

  .status-indicator.off {
    background: #d1d5db;
    border: 1px solid #9ca3af;
  }

  .toolbox-footer {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }

  .action-button {
    flex: 1;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .action-button:hover {
    background: rgba(0, 0, 0, 0.1);
    border-color: rgba(0, 0, 0, 0.2);
  }

  .action-button.show-all:hover {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #059669;
  }

  .action-button.hide-all:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #dc2626;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .toolbox {
      min-width: 260px;
      max-width: 280px;
    }
    
    .tool-button {
      padding: 8px 10px;
      min-height: 40px;
    }
    
    .tool-icon {
      font-size: 16px;
    }
    
    .tool-label {
      font-size: 12px;
    }
  }
</style>