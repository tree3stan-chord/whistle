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
const notes = writable([]);
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
  // Notes management actions
  addNote(note) {
    notes.update((currentNotes) => [...currentNotes, note]);
  },
  removeNote(index) {
    notes.update((currentNotes) => currentNotes.filter((_, i) => i !== index));
  },
  clearNotes() {
    notes.set([]);
  },
  setNotes(newNotes) {
    notes.set(newNotes);
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
    notes.set([]);
  }
};
function StaffNotation($$payload, $$props) {
  push();
  var $$store_subs;
  let width = fallback($$props["width"], 800);
  let height = fallback($$props["height"], 200);
  let canvas = $$props["canvas"];
  let noteConsolidator;
  onDestroy(() => {
  });
  if (store_get($$store_subs ??= {}, "$pitchResult", pitchResult) && store_get($$store_subs ??= {}, "$pitchResult", pitchResult).confidence > 0.7 && noteConsolidator) ;
  $$payload.out.push(`<div class="staff-container svelte-1595569"><canvas${attr("width", width)}${attr("height", height)} class="staff-canvas svelte-1595569"></canvas> <div class="controls svelte-1595569"><button class="clear-btn svelte-1595569">Clear Staff</button> <div class="note-info svelte-1595569">Notes: ${escape_html(
    // Clear canvas
    // Draw staff lines
    // Draw 5 staff lines
    // Draw treble clef symbol (simplified)
    // After clef
    // Calculate positions based on note durations, not just index
    // Calculate width based on note duration
    // Draw note based on duration
    // Draw duration text below staff for debugging
    // Show note value
    // Draw ledger lines if needed
    // Draw note name below staff
    // Update cumulative width for next note
    // Calculate visual width based on note duration
    // Width multipliers based on note value
    // Whole notes take more space
    // Half notes take more space  
    // Quarter notes are baseline
    // Eighth notes are compact
    // Sixteenth notes are very compact
    // Draw note head - filled for shorter durations, hollow for longer
    // Draw stem for most note types
    // Add flags for eighth and sixteenth notes
    // For very long sustained notes, draw a horizontal line to show duration
    // Dashed line
    // Reset line dash
    // Draw ledger lines above staff
    // Draw ledger lines below staff
    // Expose canvas to parent component for exports
    store_get($$store_subs ??= {}, "$notes", notes).length
  )}</div></div></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  bind_props($$props, { width, height, canvas });
  pop();
}
function SessionManager($$payload, $$props) {
  push();
  let notes2 = fallback($$props["notes"], () => [], true);
  let lyrics = fallback($$props["lyrics"], "");
  let onLoadSession = fallback($$props["onLoadSession"], () => {
  });
  let staffCanvas = fallback($$props["staffCanvas"], null);
  let savedSessions = [];
  $$payload.out.push(`<div class="session-manager svelte-f0o818"><div class="session-controls svelte-f0o818"><button class="session-btn save-btn svelte-f0o818"${attr("disabled", notes2.length === 0 && !lyrics.trim(), true)}>Save Session</button> <button class="session-btn load-btn svelte-f0o818"${attr("disabled", savedSessions.length === 0, true)}>Load Session</button> <button class="session-btn export-btn svelte-f0o818"${attr("disabled", notes2.length === 0, true)}>Export PNG</button> <button class="session-btn export-btn svelte-f0o818"${attr("disabled", notes2.length === 0, true)}>Export MIDI</button> <button class="session-btn export-btn svelte-f0o818"${attr("disabled", notes2.length === 0 && !lyrics.trim(), true)}>Export JSON</button></div> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div>`);
  bind_props($$props, { notes: notes2, lyrics, onLoadSession, staffCanvas });
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
    audioStateActions.setNotes(data.notes);
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
    notes: store_get($$store_subs ??= {}, "$notes", notes),
    lyrics: currentTranscript,
    onLoadSession: handleLoadSession,
    staffCanvas: null
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
