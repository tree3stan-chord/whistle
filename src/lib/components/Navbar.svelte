<script lang="ts">
  import { modalActions } from '../stores/modalStore.js';
  
  export let isInitialized = false;
  export let mounted = false;
  export let onInitializeAudio: () => void;

  function resetLayout() {
    modalActions.resetAllPositions();
  }
  
  function toggleModal(modalId: string) {
    const state = modalActions.getModalState(modalId);
    if (state) {
      modalActions.setVisible(modalId, !state.isVisible);
    }
  }

  async function handleInitializeClick() {
    if (!mounted) return;
    
    try {
      await onInitializeAudio();
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
  }
</script>

<nav class="navbar">
  <div class="navbar-content">
    <!-- Left section: Branding and primary controls -->
    <div class="navbar-left">
      <div class="brand">
        <h1>🎼 Cadenza</h1>
        <span class="subtitle">Vocal Transcription</span>
      </div>
      
      {#if !isInitialized}
        <button 
          class="btn btn-primary initialize-btn"
          disabled={!mounted}
          on:click={handleInitializeClick}
          title={!mounted ? 'Waiting for component to mount...' : 'Click to initialize audio'}
        >
          Initialize Audio
        </button>
      {/if}
    </div>

    <!-- Right section: Layout controls -->
    <div class="navbar-right">
      
      <div class="layout-controls">
        <button 
          class="btn btn-secondary reset-btn"
          on:click={resetLayout}
          title="Reset Window Layout"
        >
          Reset Layout
        </button>
      </div>
    </div>
  </div>
</nav>

<style>
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .navbar-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    padding: 0 20px;
    max-width: 100%;
  }

  .navbar-left {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .brand {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .brand h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #333;
  }

  .subtitle {
    font-size: 12px;
    color: #666;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .toolbox-control {
    display: flex;
    align-items: center;
  }

  .toolbox-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .toolbox-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .toolbox-btn:active {
    transform: scale(0.95);
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: rgba(0, 0, 0, 0.1);
    color: #333;
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.2);
  }

  .initialize-btn {
    font-size: 14px;
    padding: 10px 20px;
  }

  .reset-btn {
    font-size: 10px;
    padding: 6px 12px;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .navbar-content {
      padding: 0 12px;
    }
    
    .brand h1 {
      font-size: 18px;
    }
    
    .subtitle {
      display: none;
    }
    
    .modal-toggles {
      gap: 4px;
    }
    
    .toggle-btn {
      width: 28px;
      height: 28px;
      font-size: 12px;
    }
  }

  @media (max-width: 480px) {
    .navbar-left {
      gap: 12px;
    }
    
    .navbar-right {
      gap: 8px;
    }
    
    .reset-btn {
      display: none;
    }
  }
</style>