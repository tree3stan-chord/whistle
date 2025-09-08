/**
 * Export Service for saving transcriptions in various formats
 */
import type { MusicalNote } from '../audio/NoteConverter.js';

export interface TranscriptionData {
  notes: MusicalNote[];
  lyrics: string;
  timestamp: number;
  duration: number;
  title?: string;
  tempo?: number;
  keySignature?: string;
}

export interface ExportOptions {
  filename?: string;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
}

export class ExportService {
  /**
   * Export canvas as PNG image
   */
  static async exportCanvasToPNG(canvas: HTMLCanvasElement, options: ExportOptions = {}): Promise<void> {
    const { filename = 'cadenza-transcription', quality = 1.0, format = 'png' } = options;
    
    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create image blob'));
          }
        }, `image/${format}`, quality);
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${format}`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      console.log(`Exported staff notation as ${filename}.${format}`);
    } catch (error) {
      console.error('PNG export failed:', error);
      throw new Error('Failed to export staff notation as image');
    }
  }

  /**
   * Export transcription data as JSON
   */
  static async exportToJSON(data: TranscriptionData, filename: string = 'cadenza-transcription'): Promise<void> {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log(`Exported transcription data as ${filename}.json`);
    } catch (error) {
      console.error('JSON export failed:', error);
      throw new Error('Failed to export transcription data');
    }
  }

  /**
   * Export as MIDI file (simplified implementation)
   */
  static async exportToMIDI(notes: MusicalNote[], filename: string = 'cadenza-transcription'): Promise<void> {
    try {
      // Create a simplified MIDI file
      const midi = this.createMIDIData(notes);
      const blob = new Blob([midi], { type: 'audio/midi' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.mid`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log(`Exported melody as ${filename}.mid`);
    } catch (error) {
      console.error('MIDI export failed:', error);
      throw new Error('Failed to export MIDI file');
    }
  }

  /**
   * Create basic MIDI data from notes
   * This is a simplified implementation - for production you'd want a proper MIDI library
   */
  private static createMIDIData(notes: MusicalNote[]): Uint8Array {
    // MIDI file header
    const header = new Uint8Array([
      0x4D, 0x54, 0x68, 0x64, // "MThd"
      0x00, 0x00, 0x00, 0x06, // Header length
      0x00, 0x00,             // Format type 0
      0x00, 0x01,             // Number of tracks
      0x00, 0x60              // Ticks per quarter note (96)
    ]);

    // Track header
    const trackHeader = new Uint8Array([
      0x4D, 0x54, 0x72, 0x6B  // "MTrk"
    ]);

    // Convert notes to MIDI events
    const events: number[] = [];
    
    notes.forEach((note, index) => {
      // Delta time (simplified - using fixed timing)
      events.push(0x00);
      
      // Note on event
      events.push(0x90); // Note on, channel 0
      events.push(Math.max(0, Math.min(127, note.midiNumber))); // Note number
      events.push(64);    // Velocity
      
      // Delta time for note duration
      events.push(0x60); // Duration (96 ticks = quarter note)
      
      // Note off event
      events.push(0x80); // Note off, channel 0
      events.push(Math.max(0, Math.min(127, note.midiNumber))); // Note number
      events.push(0x00); // Velocity
    });

    // End of track
    events.push(0x00, 0xFF, 0x2F, 0x00);

    const trackData = new Uint8Array(events);
    const trackLength = new Uint8Array(4);
    
    // Write track length in big-endian format
    const length = trackData.length;
    trackLength[0] = (length >> 24) & 0xFF;
    trackLength[1] = (length >> 16) & 0xFF;
    trackLength[2] = (length >> 8) & 0xFF;
    trackLength[3] = length & 0xFF;

    // Combine all parts
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
  static saveToStorage(data: TranscriptionData, key: string): void {
    try {
      localStorage.setItem(`cadenza-${key}`, JSON.stringify(data));
      console.log(`Saved transcription to storage: ${key}`);
    } catch (error) {
      console.error('Save to storage failed:', error);
      throw new Error('Failed to save transcription');
    }
  }

  /**
   * Load transcription from browser storage
   */
  static loadFromStorage(key: string): TranscriptionData | null {
    try {
      const data = localStorage.getItem(`cadenza-${key}`);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Load from storage failed:', error);
      return null;
    }
  }

  /**
   * List all saved transcriptions
   */
  static listSavedTranscriptions(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cadenza-')) {
        keys.push(key.replace('cadenza-', ''));
      }
    }
    return keys.sort();
  }

  /**
   * Delete saved transcription
   */
  static deleteFromStorage(key: string): void {
    localStorage.removeItem(`cadenza-${key}`);
    console.log(`Deleted transcription: ${key}`);
  }
}