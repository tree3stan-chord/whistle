import { G as current_component, I as fallback, J as store_get, K as attr, F as escape_html, M as unsubscribe_stores, N as bind_props, B as pop, z as push, O as head, P as attr_class } from "../../chunks/index2.js";
import { d as derived, w as writable } from "../../chunks/index.js";
function onDestroy(fn) {
  var context = (
    /** @type {Component} */
    current_component
  );
  (context.d ??= []).push(fn);
}
const audioState = writable({
  isRecording: false,
  isInitialized: false,
  currentFrequency: null,
  currentConfidence: 0,
  error: null,
  deviceLabel: null
});
const pitchResult = writable(null);
const speechResult = writable(null);
const speechTranscript = writable("");
const isSpeechListening = writable(false);
derived(
  audioState,
  ($audioState) => $audioState.isRecording
);
derived(
  audioState,
  ($audioState) => $audioState.isInitialized
);
derived(
  pitchResult,
  ($pitchResult) => $pitchResult?.frequency ?? null
);
derived(
  pitchResult,
  ($pitchResult) => $pitchResult?.confidence ?? 0
);
const audioStateActions = {
  setRecording(recording) {
    audioState.update((state) => ({ ...state, isRecording: recording }));
  },
  setInitialized(initialized) {
    audioState.update((state) => ({ ...state, isInitialized: initialized }));
  },
  setError(error) {
    audioState.update((state) => ({ ...state, error }));
  },
  setDeviceLabel(deviceLabel) {
    audioState.update((state) => ({ ...state, deviceLabel }));
  },
  setPitchResult(result) {
    pitchResult.set(result);
    audioState.update((state) => ({
      ...state,
      currentFrequency: result?.frequency ?? null,
      currentConfidence: result?.confidence ?? 0
    }));
  },
  setSpeechResult(result) {
    speechResult.set(result);
  },
  setSpeechTranscript(transcript) {
    speechTranscript.set(transcript);
  },
  setSpeechListening(listening) {
    isSpeechListening.set(listening);
  },
  reset() {
    audioState.set({
      isRecording: false,
      isInitialized: false,
      currentFrequency: null,
      currentConfidence: 0,
      error: null,
      deviceLabel: null
    });
    pitchResult.set(null);
    speechResult.set(null);
    speechTranscript.set("");
    isSpeechListening.set(false);
  }
};
class NoteConverter {
  // A4 = 440Hz = MIDI 69
  static A4_FREQUENCY = 440;
  static A4_MIDI = 69;
  static NOTE_NAMES = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B"
  ];
  /**
   * Convert frequency to musical note information
   */
  static frequencyToNote(frequency, confidence = 1) {
    const midiNumber = Math.round(12 * Math.log2(frequency / this.A4_FREQUENCY) + this.A4_MIDI);
    const octave = Math.floor(midiNumber / 12) - 1;
    const pitchClass = this.NOTE_NAMES[midiNumber % 12];
    const noteName = `${pitchClass}${octave}`;
    const staffPosition = this.midiToStaffPosition(midiNumber);
    return {
      frequency,
      noteName,
      midiNumber,
      octave,
      pitchClass,
      staffPosition,
      confidence
    };
  }
  /**
   * Convert MIDI number to staff position for treble clef
   * 0 = middle line (B4), positive = above, negative = below
   */
  static midiToStaffPosition(midiNumber) {
    const b4Midi = 71;
    const semitonesFromB4 = midiNumber - b4Midi;
    return Math.round(semitonesFromB4 * 0.5);
  }
  /**
   * Get note name from MIDI number
   */
  static midiToNoteName(midiNumber) {
    const octave = Math.floor(midiNumber / 12) - 1;
    const pitchClass = this.NOTE_NAMES[midiNumber % 12];
    return `${pitchClass}${octave}`;
  }
  /**
   * Check if frequency is in a reasonable vocal range
   */
  static isVocalRange(frequency) {
    return frequency >= 80 && frequency <= 1200;
  }
  /**
   * Quantize frequency to nearest semitone
   */
  static quantizeToSemitone(frequency) {
    const midiNumber = Math.round(12 * Math.log2(frequency / this.A4_FREQUENCY) + this.A4_MIDI);
    return this.A4_FREQUENCY * Math.pow(2, (midiNumber - this.A4_MIDI) / 12);
  }
}
class ExportService {
  /**
   * Export canvas as PNG image
   */
  static async exportCanvasToPNG(canvas, options = {}) {
    const { filename = "whistle-transcription", quality = 1, format = "png" } = options;
    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob2) => {
          if (blob2) {
            resolve(blob2);
          } else {
            reject(new Error("Failed to create image blob"));
          }
        }, `image/${format}`, quality);
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log(`Exported staff notation as ${filename}.${format}`);
    } catch (error) {
      console.error("PNG export failed:", error);
      throw new Error("Failed to export staff notation as image");
    }
  }
  /**
   * Export transcription data as JSON
   */
  static async exportToJSON(data, filename = "whistle-transcription") {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log(`Exported transcription data as ${filename}.json`);
    } catch (error) {
      console.error("JSON export failed:", error);
      throw new Error("Failed to export transcription data");
    }
  }
  /**
   * Export as MIDI file (simplified implementation)
   */
  static async exportToMIDI(notes, filename = "whistle-transcription") {
    try {
      const midi = this.createMIDIData(notes);
      const blob = new Blob([midi], { type: "audio/midi" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.mid`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log(`Exported melody as ${filename}.mid`);
    } catch (error) {
      console.error("MIDI export failed:", error);
      throw new Error("Failed to export MIDI file");
    }
  }
  /**
   * Create basic MIDI data from notes
   * This is a simplified implementation - for production you'd want a proper MIDI library
   */
  static createMIDIData(notes) {
    const header = new Uint8Array([
      77,
      84,
      104,
      100,
      // "MThd"
      0,
      0,
      0,
      6,
      // Header length
      0,
      0,
      // Format type 0
      0,
      1,
      // Number of tracks
      0,
      96
      // Ticks per quarter note (96)
    ]);
    const trackHeader = new Uint8Array([
      77,
      84,
      114,
      107
      // "MTrk"
    ]);
    const events = [];
    notes.forEach((note, index) => {
      events.push(0);
      events.push(144);
      events.push(Math.max(0, Math.min(127, note.midiNumber)));
      events.push(64);
      events.push(96);
      events.push(128);
      events.push(Math.max(0, Math.min(127, note.midiNumber)));
      events.push(0);
    });
    events.push(0, 255, 47, 0);
    const trackData = new Uint8Array(events);
    const trackLength = new Uint8Array(4);
    const length = trackData.length;
    trackLength[0] = length >> 24 & 255;
    trackLength[1] = length >> 16 & 255;
    trackLength[2] = length >> 8 & 255;
    trackLength[3] = length & 255;
    const midi = new Uint8Array(header.length + trackHeader.length + trackLength.length + trackData.length);
    let offset = 0;
    midi.set(header, offset);
    offset += header.length;
    midi.set(trackHeader, offset);
    offset += trackHeader.length;
    midi.set(trackLength, offset);
    offset += trackLength.length;
    midi.set(trackData, offset);
    return midi;
  }
  /**
   * Save transcription to browser storage
   */
  static saveToStorage(data, key) {
    try {
      localStorage.setItem(`whistle-${key}`, JSON.stringify(data));
      console.log(`Saved transcription to storage: ${key}`);
    } catch (error) {
      console.error("Save to storage failed:", error);
      throw new Error("Failed to save transcription");
    }
  }
  /**
   * Load transcription from browser storage
   */
  static loadFromStorage(key) {
    try {
      const data = localStorage.getItem(`whistle-${key}`);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error("Load from storage failed:", error);
      return null;
    }
  }
  /**
   * List all saved transcriptions
   */
  static listSavedTranscriptions() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("whistle-")) {
        keys.push(key.replace("whistle-", ""));
      }
    }
    return keys.sort();
  }
  /**
   * Delete saved transcription
   */
  static deleteFromStorage(key) {
    localStorage.removeItem(`whistle-${key}`);
    console.log(`Deleted transcription: ${key}`);
  }
}
function StaffNotation($$payload, $$props) {
  push();
  var $$store_subs;
  let width = fallback($$props["width"], 800);
  let height = fallback($$props["height"], 200);
  let notes = fallback($$props["notes"], () => [], true);
  onDestroy(() => {
  });
  function addNote(note) {
    const noteWithTime = { ...note, timestamp: Date.now() };
    notes = [...notes, noteWithTime];
    if (notes.length > 20) {
      notes = notes.slice(-20);
    }
  }
  async function exportToPNG() {
    {
      throw new Error("Canvas not available for export");
    }
  }
  async function exportToMIDI() {
    if (notes.length === 0) {
      throw new Error("No notes to export");
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/:/g, "-");
    await ExportService.exportToMIDI(notes, `whistle-melody-${timestamp}`);
  }
  if (store_get($$store_subs ??= {}, "$pitchResult", pitchResult) && store_get($$store_subs ??= {}, "$pitchResult", pitchResult).confidence > 0.7) {
    const note = NoteConverter.frequencyToNote(store_get($$store_subs ??= {}, "$pitchResult", pitchResult).frequency, store_get($$store_subs ??= {}, "$pitchResult", pitchResult).confidence);
    if (NoteConverter.isVocalRange(note.frequency)) {
      addNote(note);
    }
  }
  $$payload.out.push(`<div class="staff-container svelte-5rebku"><canvas${attr("width", width)}${attr("height", height)} class="staff-canvas svelte-5rebku"></canvas> <div class="controls svelte-5rebku"><button class="clear-btn svelte-5rebku">Clear Staff</button> <button class="export-btn svelte-5rebku"${attr(
    "disabled",
    // Add note with timestamp
    // Keep only last 20 notes for performance
    // Clear canvas
    // Draw staff lines
    // Draw 5 staff lines
    // Draw treble clef symbol (simplified)
    // After clef
    // Draw note head
    // Draw stem
    // Draw ledger lines if needed
    // Draw note name below staff
    // Draw ledger lines above staff
    // Draw ledger lines below staff
    // Export functions
    // Expose notes and export functions to parent component
    notes.length === 0,
    true
  )}>Export PNG</button> <button class="export-btn svelte-5rebku"${attr("disabled", notes.length === 0, true)}>Export MIDI</button> <div class="note-info svelte-5rebku">Notes: ${escape_html(notes.length)}</div></div></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  bind_props($$props, { width, height, notes, exportToPNG, exportToMIDI });
  pop();
}
function SessionManager($$payload, $$props) {
  push();
  let notes = fallback($$props["notes"], () => [], true);
  let lyrics = fallback($$props["lyrics"], "");
  let onLoadSession = fallback($$props["onLoadSession"], () => {
  });
  let savedSessions = [];
  $$payload.out.push(`<div class="session-manager svelte-f0o818"><div class="session-controls svelte-f0o818"><button class="session-btn save-btn svelte-f0o818"${attr("disabled", notes.length === 0 && !lyrics.trim(), true)}>Save Session</button> <button class="session-btn load-btn svelte-f0o818"${attr("disabled", savedSessions.length === 0, true)}>Load Session</button> <button class="session-btn export-btn svelte-f0o818"${attr("disabled", notes.length === 0 && !lyrics.trim(), true)}>Export JSON</button></div> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div>`);
  bind_props($$props, { notes, lyrics, onLoadSession });
  pop();
}
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  let isRecording, isInitialized, error, deviceLabel, currentPitch, currentTranscript, speechListening;
  onDestroy(async () => {
  });
  function formatFrequency(freq) {
    return freq ? `${freq.toFixed(1)} Hz` : "--";
  }
  function formatConfidence(conf) {
    return `${(conf * 100).toFixed(0)}%`;
  }
  function handleLoadSession(data) {
    audioStateActions.setSpeechTranscript(data.lyrics);
  }
  isRecording = store_get($$store_subs ??= {}, "$audioState", audioState).isRecording;
  isInitialized = store_get($$store_subs ??= {}, "$audioState", audioState).isInitialized;
  error = store_get($$store_subs ??= {}, "$audioState", audioState).error;
  deviceLabel = store_get($$store_subs ??= {}, "$audioState", audioState).deviceLabel;
  currentPitch = store_get($$store_subs ??= {}, "$pitchResult", pitchResult);
  currentTranscript = store_get($$store_subs ??= {}, "$speechTranscript", speechTranscript);
  speechListening = store_get($$store_subs ??= {}, "$isSpeechListening", isSpeechListening);
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>Whistle - Audio Test</title>`;
  });
  $$payload.out.push(`<main class="container svelte-1n2elvy"><header class="svelte-1n2elvy"><h1 class="svelte-1n2elvy">🎵 Whistle - Vocal Transcription</h1> <p class="svelte-1n2elvy">Sing melodies with lyrics and see them transcribed to musical notation</p></header> <section class="controls svelte-1n2elvy"><div class="button-group svelte-1n2elvy">`);
  if (!isInitialized) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<button${attr("disabled", true, true)} class="btn btn-primary svelte-1n2elvy">Initialize Audio</button>`);
  } else {
    $$payload.out.push("<!--[!-->");
    if (!isRecording) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<button class="btn btn-success svelte-1n2elvy">🎤 Start Recording</button>`);
    } else {
      $$payload.out.push("<!--[!-->");
      $$payload.out.push(`<button class="btn btn-danger svelte-1n2elvy">⏹ Stop Recording</button>`);
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]--></div></section> <section class="status svelte-1n2elvy"><div class="status-grid svelte-1n2elvy"><div class="status-item svelte-1n2elvy"><span class="status-label svelte-1n2elvy">Status:</span> <span${attr_class("status-value svelte-1n2elvy", void 0, { "recording": isRecording })}>`);
  if (error) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`❌ Error`);
  } else {
    $$payload.out.push("<!--[!-->");
    if (isRecording) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`🎤 Recording`);
    } else {
      $$payload.out.push("<!--[!-->");
      if (isInitialized) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`✅ Ready`);
      } else {
        $$payload.out.push("<!--[!-->");
        $$payload.out.push(`⏸ Not initialized`);
      }
      $$payload.out.push(`<!--]-->`);
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]--></span></div> <div class="status-item svelte-1n2elvy"><span class="status-label svelte-1n2elvy">Device:</span> <span class="status-value svelte-1n2elvy">${escape_html(deviceLabel || "None")}</span></div> <div class="status-item svelte-1n2elvy"><span class="status-label svelte-1n2elvy">Frequency:</span> <span class="status-value frequency svelte-1n2elvy">${escape_html(formatFrequency(currentPitch?.frequency ?? null))}</span></div> <div class="status-item svelte-1n2elvy"><span class="status-label svelte-1n2elvy">Confidence:</span> <span class="status-value confidence svelte-1n2elvy">${escape_html(formatConfidence(currentPitch?.confidence ?? 0))}</span></div></div></section> `);
  if (error) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<section class="error svelte-1n2elvy"><h3 class="svelte-1n2elvy">❌ Error</h3> <p class="error-message svelte-1n2elvy">${escape_html(error)}</p> <button class="btn btn-secondary svelte-1n2elvy">Clear Error</button></section>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <section class="staff-section svelte-1n2elvy"><h3 class="svelte-1n2elvy">Staff Notation</h3> <p class="svelte-1n2elvy">Notes will appear here as you sing</p> `);
  StaffNotation($$payload, { width: 800, height: 200 });
  $$payload.out.push(`<!----></section> <section class="session-section svelte-1n2elvy"><h3 class="svelte-1n2elvy">Session Management</h3> `);
  SessionManager($$payload, {
    notes: [],
    lyrics: currentTranscript,
    onLoadSession: handleLoadSession
  });
  $$payload.out.push(`<!----></section> <section class="lyrics-section svelte-1n2elvy"><h3 class="svelte-1n2elvy">🎤 Lyrics</h3> <div class="lyrics-status svelte-1n2elvy">`);
  if (speechListening) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<span class="listening-indicator svelte-1n2elvy">🔴 Listening for lyrics...</span>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<span class="not-listening svelte-1n2elvy">Speech recognition inactive</span>`);
  }
  $$payload.out.push(`<!--]--></div> <div class="lyrics-display svelte-1n2elvy">`);
  if (currentTranscript.trim()) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<p class="transcript svelte-1n2elvy">${escape_html(currentTranscript)}</p>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<p class="no-lyrics svelte-1n2elvy">Start singing with words to see lyrics here</p>`);
  }
  $$payload.out.push(`<!--]--></div> <div class="lyrics-controls svelte-1n2elvy"><button class="clear-lyrics-btn svelte-1n2elvy"${attr("disabled", !currentTranscript.trim(), true)}>Clear Lyrics</button></div></section> <section class="debug svelte-1n2elvy"><h3 class="svelte-1n2elvy">Debug Info</h3> <pre class="svelte-1n2elvy">${escape_html(JSON.stringify(
    {
      isInitialized,
      isRecording,
      deviceLabel,
      pitchResult: currentPitch,
      error
    },
    null,
    2
  ))}</pre></section></main>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
