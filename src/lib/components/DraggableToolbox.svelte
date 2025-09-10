<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { modalActions, modalStates } from '../stores/modalStore.js';
  
  // Position state
  let position = { x: 20, y: 20 };
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let toolboxElement: HTMLDivElement;
  let titleBarElement: HTMLDivElement;

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

  // Drag functionality
  function startDrag(event: MouseEvent | TouchEvent) {
    if (!toolboxElement) return;
    
    isDragging = true;
    toolboxElement.style.userSelect = 'none';
    
    const clientPos = getClientPosition(event);
    const rect = toolboxElement.getBoundingClientRect();
    
    dragOffset = {
      x: clientPos.x - rect.left,
      y: clientPos.y - rect.top
    };
    
    toolboxElement.classList.add('dragging');
    
    // Add document event listeners for drag
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', handleDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
    
    event.preventDefault();
  }

  function handleDrag(event: MouseEvent | TouchEvent) {
    if (!isDragging) return;
    
    const clientPos = getClientPosition(event);
    const newPosition = {
      x: clientPos.x - dragOffset.x,
      y: clientPos.y - dragOffset.y
    };
    
    // Constrain to viewport
    const toolboxSize = {
      width: toolboxElement.offsetWidth,
      height: toolboxElement.offsetHeight
    };
    
    position = constrainToViewport(newPosition, toolboxSize);
    
    event.preventDefault();
  }

  function endDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    if (toolboxElement) {
      toolboxElement.style.userSelect = '';
      toolboxElement.classList.remove('dragging');
    }
    
    // Remove document event listeners
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', handleDrag);
    document.removeEventListener('touchend', endDrag);
  }

  function getClientPosition(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY };
    } else {
      const touch = event.touches[0] || event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
  }

  function constrainToViewport(pos: {x: number, y: number}, size: {width: number, height: number}): {x: number, y: number} {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const navbarHeight = 60; // Account for navbar
    
    return {
      x: Math.max(0, Math.min(pos.x, viewportWidth - size.width)),
      y: Math.max(navbarHeight, Math.min(pos.y, viewportHeight - size.height))
    };
  }

  onDestroy(() => {
    // Clean up any remaining event listeners
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', handleDrag);
    document.removeEventListener('touchend', endDrag);
  });
</script>

<div 
  bind:this={toolboxElement}
  class="draggable-toolbox"
  class:dragging={isDragging}
  style="left: {position.x}px; top: {position.y}px;"
  role="dialog"
  tabindex="0"
  aria-labelledby="toolbox-title"
>
  <!-- Draggable title bar -->
  <div
    bind:this={titleBarElement}
    class="toolbox-title-bar"
    role="button"
    tabindex="0"
    aria-label="Drag to move toolbox"
    on:mousedown|stopPropagation={startDrag}
    on:touchstart|stopPropagation={startDrag}
  >
    <div class="drag-handle">⋮⋮</div>
    <div class="status-count" id="toolbox-title">{visibleCount}/{totalCount}</div>
  </div>

  <!-- Tool buttons -->
  <div class="tool-grid">
    {#each modalTools as tool}
      <button 
        class="tool-button"
        class:active={tool.isVisible}
        on:click={() => toggleModal(tool.id)}
        title="{tool.name} - {tool.description}"
        aria-label={`Toggle ${tool.name}`}
      >
        <div class="tool-icon" class:dimmed={!tool.isVisible}>
          {tool.icon}
        </div>
        <div class="status-indicator" class:on={tool.isVisible} class:off={!tool.isVisible}></div>
      </button>
    {/each}
  </div>
  
  <!-- Footer actions -->
  <div class="toolbox-footer">
    <button 
      class="action-button show-all"
      on:click={() => modalTools.forEach(tool => modalActions.setVisible(tool.id, true))}
      title="Show all panels"
    >
      👁️
    </button>
    <button 
      class="action-button hide-all" 
      on:click={() => modalTools.forEach(tool => modalActions.setVisible(tool.id, false))}
      title="Hide all panels"
    >
      🙈
    </button>
  </div>
</div>

<style>
  .draggable-toolbox {
    position: absolute;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    width: 80px;
    transition: all 0.2s ease;
    z-index: 1000;
    user-select: none;
  }

  .draggable-toolbox:hover {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  }

  .draggable-toolbox.dragging {
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
    transform: scale(1.02);
  }

  .toolbox-title-bar {
    background: rgba(0, 0, 0, 0.05);
    padding: 6px 8px;
    cursor: move;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  .toolbox-title-bar:hover {
    background: rgba(0, 0, 0, 0.08);
  }

  .drag-handle {
    font-size: 12px;
    color: #666;
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }

  .toolbox-title-bar:hover .drag-handle {
    opacity: 1;
  }

  .status-count {
    font-size: 10px;
    color: #666;
    font-weight: 600;
    padding: 2px 4px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 6px;
    text-align: center;
  }

  .tool-grid {
    display: grid;
    gap: 6px;
    padding: 8px;
  }

  .tool-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    width: 56px;
    height: 56px;
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
    font-size: 20px;
    transition: all 0.2s ease;
    text-align: center;
  }

  .tool-icon.dimmed {
    opacity: 0.4;
    filter: grayscale(0.8);
  }

  .status-indicator {
    width: 6px;
    height: 6px;
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
    gap: 4px;
    padding: 0 8px 8px 8px;
  }

  .action-button {
    flex: 1;
    padding: 6px;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
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
    .draggable-toolbox {
      width: 70px;
    }
    
    .tool-button {
      width: 48px;
      height: 48px;
      padding: 6px;
    }
    
    .tool-icon {
      font-size: 18px;
    }
  }
</style>