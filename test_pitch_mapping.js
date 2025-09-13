/**
 * Test script to verify pitch-to-staff position mapping
 * Run with: node test_pitch_mapping.js
 */

// Copy the calculateStaffPosition logic for testing
function calculateStaffPosition(midiNumber, clef) {
  // Staff positions are integers where:
  // 0 = middle line of staff
  // positive = above middle line
  // negative = below middle line
  // Each line/space is 1 position (not 2 semitones as incorrectly calculated before)
  
  if (clef === 'treble') {
    // Treble clef: B4 (MIDI 71) is the middle line (position 0)
    // Each semitone step changes staff position by 0.5 (line to space or space to line)
    const middleLineMidi = 71; // B4
    return (midiNumber - middleLineMidi) * 0.5;
  } else if (clef === 'bass') {
    // Bass clef: D3 (MIDI 50) is the middle line (position 0)  
    const middleLineMidi = 50; // D3
    return (midiNumber - middleLineMidi) * 0.5;
  } else if (clef === 'alto') {
    // Alto clef: C4 (MIDI 60) is the middle line (position 0)
    const middleLineMidi = 60; // C4
    return (midiNumber - middleLineMidi) * 0.5;
  }
  
  return 0;
}

// Test notes with their expected positions
const testNotes = [
  // Treble clef tests
  { note: 'C4', midi: 60, clef: 'treble', expected: 'Below staff (ledger line)' },
  { note: 'D4', midi: 62, clef: 'treble', expected: 'Below staff' },
  { note: 'E4', midi: 64, clef: 'treble', expected: 'Bottom line' },
  { note: 'F4', midi: 65, clef: 'treble', expected: 'First space' },
  { note: 'G4', midi: 67, clef: 'treble', expected: 'Second line' },
  { note: 'A4', midi: 69, clef: 'treble', expected: 'Second space' },
  { note: 'B4', midi: 71, clef: 'treble', expected: 'Middle line' },
  { note: 'C5', midi: 72, clef: 'treble', expected: 'Third space' },
  { note: 'D5', midi: 74, clef: 'treble', expected: 'Top line' },
  
  // Bass clef tests
  { note: 'E2', midi: 40, clef: 'bass', expected: 'Below staff' },
  { note: 'F2', midi: 41, clef: 'bass', expected: 'Below staff' },
  { note: 'G2', midi: 43, clef: 'bass', expected: 'Bottom line' },
  { note: 'A2', midi: 45, clef: 'bass', expected: 'First space' },
  { note: 'B2', midi: 47, clef: 'bass', expected: 'Second line' },
  { note: 'C3', midi: 48, clef: 'bass', expected: 'Second space' },
  { note: 'D3', midi: 50, clef: 'bass', expected: 'Middle line' },
  { note: 'E3', midi: 52, clef: 'bass', expected: 'Third space' },
  { note: 'F3', midi: 53, clef: 'bass', expected: 'Fourth line' },
  { note: 'G3', midi: 55, clef: 'bass', expected: 'Top space' },
  { note: 'A3', midi: 57, clef: 'bass', expected: 'Top line' },
];

console.log('Testing Pitch-to-Staff Position Mapping');
console.log('=====================================');

testNotes.forEach(test => {
  const position = calculateStaffPosition(test.midi, test.clef);
  console.log(`${test.note} (MIDI ${test.midi}) in ${test.clef} clef:`);
  console.log(`  Position: ${position}`);
  console.log(`  Expected: ${test.expected}`);
  console.log('');
});

// Test clef switching scenarios
console.log('\nClef Switching Test:');
console.log('===================');
const middleC = 60; // C4
console.log(`C4 (MIDI 60) in treble clef: position ${calculateStaffPosition(middleC, 'treble')}`);
console.log(`C4 (MIDI 60) in bass clef: position ${calculateStaffPosition(middleC, 'bass')}`);

const lowG = 43; // G2
console.log(`G2 (MIDI 43) in treble clef: position ${calculateStaffPosition(lowG, 'treble')}`);
console.log(`G2 (MIDI 43) in bass clef: position ${calculateStaffPosition(lowG, 'bass')}`);