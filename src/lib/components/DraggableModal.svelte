<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { modalActions, modalStates, constrainToViewport } from '../stores/modalStore.js';
  import type { ModalConfig, ModalPosition } from '../stores/modalStore.js';

  // Props
  export let config: ModalConfig;
  export let className: string = '';

  // State
  let modalElement: HTMLDivElement;
  let titleBarElement: HTMLDivElement;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let modalState = { 
    position: config.initialPosition, 
    zIndex: 1000, 
    isMinimized: false, 
    isVisible: true 
  };

  // Subscribe to modal store for this specific modal
  $: if ($modalStates[config.id]) {
    modalState = $modalStates[config.id];
  }

  onMount(() => {
    // Register modal with the store
    modalActions.registerModal(config);
    
    // Global listeners for drag end
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', handleDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  });


  onDestroy(() => {
    // Clean up event listeners
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', handleDrag);
    document.removeEventListener('touchend', endDrag);
  });

  function startDrag(event: MouseEvent | TouchEvent) {
    isDragging = true;
    modalElement.style.userSelect = 'none';
    
    const clientPos = getClientPosition(event);
    const rect = modalElement.getBoundingClientRect();
    
    dragOffset = {
      x: clientPos.x - rect.left,
      y: clientPos.y - rect.top
    };
    
    // Bring to front when starting drag
    modalActions.bringToFront(config.id);
    
    // Add dragging class for visual feedback
    modalElement.classList.add('dragging');
    
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
    const modalSize = {
      width: modalElement.offsetWidth,
      height: modalElement.offsetHeight
    };
    
    const constrainedPosition = constrainToViewport(newPosition, modalSize);
    
    // Update position in store
    modalActions.updatePosition(config.id, constrainedPosition);
    
    event.preventDefault();
  }

  function endDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    modalElement.style.userSelect = '';
    modalElement.classList.remove('dragging');
  }

  function bringToFront() {
    modalActions.bringToFront(config.id);
  }

  function toggleMinimize() {
    if (config.minimizable !== false) {
      modalActions.toggleMinimized(config.id);
    }
  }

  function closeModal() {
    modalActions.setVisible(config.id, false);
  }

  function getClientPosition(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY };
    } else {
      const touch = event.touches[0] || event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
  }

  // Double-click title bar to minimize
  function handleTitleDoubleClick() {
    if (config.minimizable !== false) {
      toggleMinimize();
    }
  }
</script>

{#if modalState.isVisible}
  <div
    bind:this={modalElement}
    class="draggable-modal {className}"
    class:minimized={modalState.isMinimized}
    style="
      left: {modalState.position.x}px;
      top: {modalState.position.y}px;
      z-index: {modalState.zIndex};
      {modalState.size ? `width: ${modalState.size.width}px; height: ${modalState.size.height}px;` : ''}
    "
    role="dialog"
    tabindex="0"
    aria-labelledby="modal-title-{config.id}"
    on:mousedown={bringToFront}
  >
    <!-- Title Bar -->
    <div
      bind:this={titleBarElement}
      class="modal-title-bar"
      role="button"
      tabindex="0"
      aria-label="Drag to move modal"
      on:mousedown|stopPropagation={startDrag}
      on:touchstart|stopPropagation={startDrag}
      on:dblclick={handleTitleDoubleClick}
    >
      <div class="title-content">
        <div class="drag-handle">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <rect width="2" height="2" fill="currentColor" opacity="0.6"/>
            <rect x="4" width="2" height="2" fill="currentColor" opacity="0.6"/>
            <rect x="8" width="2" height="2" fill="currentColor" opacity="0.6"/>
            <rect y="3" width="2" height="2" fill="currentColor" opacity="0.6"/>
            <rect x="4" y="3" width="2" height="2" fill="currentColor" opacity="0.6"/>
            <rect x="8" y="3" width="2" height="2" fill="currentColor" opacity="0.6"/>
            <rect y="6" width="2" height="2" fill="currentColor" opacity="0.6"/>
            <rect x="4" y="6" width="2" height="2" fill="currentColor" opacity="0.6"/>
            <rect x="8" y="6" width="2" height="2" fill="currentColor" opacity="0.6"/>
          </svg>
        </div>
        
        <span class="modal-title" id="modal-title-{config.id}">{config.title}</span>
      </div>
      
      <div class="title-controls">
        {#if config.minimizable !== false}
          <button 
            class="modal-control-btn minimize-btn"
            on:click={toggleMinimize}
            title={modalState.isMinimized ? 'Restore' : 'Minimize'}
            aria-label={modalState.isMinimized ? 'Restore window' : 'Minimize window'}
          >
            {#if modalState.isMinimized}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="4" width="8" height="4" rx="1" fill="currentColor"/>
              </svg>
            {:else}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="5" width="8" height="2" fill="currentColor"/>
              </svg>
            {/if}
          </button>
        {/if}
        
        <button 
          class="modal-control-btn close-btn"
          on:click={closeModal}
          title="Close"
          aria-label="Close modal"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Modal Content -->
    <div class="modal-content" class:hidden={modalState.isMinimized}>
      <slot />
    </div>
  </div>
{/if}

<style>
  .draggable-modal {
    position: absolute;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    min-width: 280px;
    max-width: 500px;
    transition: all 0.2s ease;
    overflow: hidden;
  }

  .draggable-modal:hover {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  }

  .draggable-modal.dragging {
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
    transform: scale(1.02);
  }

  .draggable-modal.minimized {
    height: auto !important;
  }

  .modal-title-bar {
    background: rgba(0, 0, 0, 0.05);
    padding: 8px 12px;
    cursor: move;
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  .modal-title-bar:hover {
    background: rgba(0, 0, 0, 0.08);
  }

  .title-content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-grow: 1;
  }

  .drag-handle {
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }

  .modal-title-bar:hover .drag-handle {
    opacity: 1;
  }

  .modal-title {
    font-weight: 600;
    font-size: 14px;
    color: #333;
    margin: 0;
  }

  .title-controls {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .modal-control-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    transition: all 0.2s ease;
  }

  .modal-control-btn:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #333;
  }

  .close-btn:hover {
    background: #ff5f57;
    color: white;
  }

  .minimize-btn:hover {
    background: #ffbd2e;
    color: white;
  }

  .modal-content {
    padding: 16px;
    transition: all 0.3s ease;
  }

  .modal-content.hidden {
    display: none;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .draggable-modal {
      max-width: calc(100vw - 20px);
      min-width: 240px;
    }
    
    .modal-title-bar {
      padding: 10px 12px;
    }
    
    .modal-content {
      padding: 12px;
    }
  }
</style>