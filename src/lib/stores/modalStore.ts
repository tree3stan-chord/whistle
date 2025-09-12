/**
 * Modal Position and State Management Store
 * Handles draggable modal positioning, z-index, and persistence
 */

import { writable, derived } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface ModalPosition {
  x: number;
  y: number;
}

export interface ModalState {
  id: string;
  position: ModalPosition;
  zIndex: number;
  isMinimized: boolean;
  isVisible: boolean;
  size?: {
    width: number;
    height: number;
  };
}

export interface ModalConfig {
  id: string;
  title: string;
  initialPosition: ModalPosition;
  defaultSize?: {
    width: number;
    height: number;
  };
  minimizable?: boolean;
  resizable?: boolean;
  persistent?: boolean; // Save position to localStorage
}

// Store for all modal states
export const modalStates: Writable<Record<string, ModalState>> = writable({});

// Current highest z-index for bringing modals to front
let currentMaxZIndex = 1000;

// Local storage key for persisting modal positions
const STORAGE_KEY = 'cadenza-modal-positions';

/**
 * Modal Management Actions
 */
export const modalActions = {
  /**
   * Register a new modal with initial configuration
   */
  registerModal(config: ModalConfig): void {
    const savedPosition = this.loadModalPosition(config.id);
    const position = savedPosition || config.initialPosition;
    
    // Get default visibility for this modal
    const defaultVisibility = getDefaultModalVisibility();
    const isVisible = defaultVisibility[config.id] !== undefined ? defaultVisibility[config.id] : true;
    
    modalStates.update(states => {
      states[config.id] = {
        id: config.id,
        position,
        zIndex: currentMaxZIndex++,
        isMinimized: false,
        isVisible,
        size: config.defaultSize
      };
      
      return states;
    });
  },

  /**
   * Update modal position (called during drag)
   */
  updatePosition(modalId: string, position: ModalPosition): void {
    modalStates.update(states => {
      if (states[modalId]) {
        states[modalId].position = { ...position };
        
        // Save to localStorage if modal is persistent
        this.saveModalPosition(modalId, position);
      }
      return states;
    });
  },

  /**
   * Bring modal to front (increase z-index)
   */
  bringToFront(modalId: string): void {
    modalStates.update(states => {
      if (states[modalId]) {
        states[modalId].zIndex = ++currentMaxZIndex;
      }
      return states;
    });
  },

  /**
   * Toggle modal minimized state
   */
  toggleMinimized(modalId: string): void {
    modalStates.update(states => {
      if (states[modalId]) {
        states[modalId].isMinimized = !states[modalId].isMinimized;
      }
      return states;
    });
  },

  /**
   * Show/hide modal
   */
  setVisible(modalId: string, visible: boolean): void {
    
    modalStates.update(states => {
      if (states[modalId]) {
        states[modalId].isVisible = visible;
        
      }
      return states;
    });
  },

  /**
   * Update modal size (for resizable modals)
   */
  updateSize(modalId: string, size: { width: number; height: number }): void {
    modalStates.update(states => {
      if (states[modalId]) {
        states[modalId].size = { ...size };
        this.saveModalSize(modalId, size);
      }
      return states;
    });
  },

  /**
   * Reset modal to initial position
   */
  resetPosition(modalId: string, initialPosition: ModalPosition): void {
    this.updatePosition(modalId, initialPosition);
    this.removeFromStorage(modalId);
  },

  /**
   * Reset all modals to default positions
   */
  resetAllPositions(): void {
    modalStates.update(states => {
      Object.values(states).forEach(modal => {
        // This would need initial positions stored somewhere
        // For now, just clear storage
        this.removeFromStorage(modal.id);
      });
      return states;
    });
    
    // Clear all stored positions
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  /**
   * Get modal state by ID
   */
  getModalState(modalId: string): ModalState | undefined {
    let state: ModalState | undefined;
    modalStates.subscribe(states => {
      state = states[modalId];
    })();
    return state;
  },

  // Persistence helpers
  saveModalPosition(modalId: string, position: ModalPosition): void {
    if (typeof localStorage === 'undefined') return;
    
    const stored = this.getAllStoredPositions();
    stored[modalId] = { position };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  },

  saveModalSize(modalId: string, size: { width: number; height: number }): void {
    if (typeof localStorage === 'undefined') return;
    
    const stored = this.getAllStoredPositions();
    if (!stored[modalId]) stored[modalId] = { position: { x: 0, y: 0 } };
    stored[modalId].size = size;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  },

  loadModalPosition(modalId: string): ModalPosition | null {
    if (typeof localStorage === 'undefined') return null;
    
    const stored = this.getAllStoredPositions();
    return stored[modalId]?.position || null;
  },

  getAllStoredPositions(): Record<string, { position: ModalPosition; size?: { width: number; height: number } }> {
    if (typeof localStorage === 'undefined') return {};
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  },

  removeFromStorage(modalId: string): void {
    if (typeof localStorage === 'undefined') return;
    
    const stored = this.getAllStoredPositions();
    delete stored[modalId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
};

/**
 * Derived stores for common modal queries
 */
export const visibleModals = derived(modalStates, $modalStates => 
  Object.values($modalStates).filter(modal => modal.isVisible)
);

export const minimizedModals = derived(modalStates, $modalStates => 
  Object.values($modalStates).filter(modal => modal.isMinimized)
);

/**
 * Utility functions
 */
export function constrainToViewport(position: ModalPosition, modalSize: { width: number; height: number }): ModalPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const navbarHeight = 60; // Account for navbar
  
  return {
    x: Math.max(0, Math.min(position.x, viewportWidth - modalSize.width)),
    y: Math.max(navbarHeight, Math.min(position.y, viewportHeight - modalSize.height))
  };
}

export function getDefaultModalPositions() {
  return {
    'recording-control': { x: 20, y: 80 },
    'status-monitor': { x: window.innerWidth - 320, y: 80 },
    'session-manager': { x: 20, y: window.innerHeight - 200 },
    'lyrics-panel': { x: window.innerWidth - 320, y: window.innerHeight - 200 },
    'tempo-control': { x: window.innerWidth / 2 - 150, y: 200 },
    'settings-panel': { x: window.innerWidth / 2 - 150, y: 120 }
  };
}

export function getDefaultModalVisibility() {
  return {
    'recording-control': true,   // Visible by default
    'session-manager': true,     // Visible by default
    'status-monitor': false,     // Hidden by default
    'lyrics-panel': false,       // Hidden by default
    'tempo-control': false       // Hidden by default
  };
}