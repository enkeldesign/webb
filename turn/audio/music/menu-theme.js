import { makeSection, makeSong } from './song-tools.js?revision=r165-track-songbook-v1';

// The established TURN theme, moved intact out of the audio engine.
const TUNE = makeSection({
  name: 'tune',
  lead: [
    'E5', null, 'G5', 'B5', 'D6', null, 'B5', 'G5',
    'E5', null, 'G5', 'A5', 'B5', 'D6', 'E6', null,
    'D6', null, 'B5', 'A5', 'G5', null, 'E5', 'G5',
    'A5', 'B5', 'D6', 'B5', 'A5', 'G5', 'F#5', null,
    'E5', null, 'B5', 'D6', 'E6', 'G6', 'F#6', 'E6',
    'D6', null, 'B5', 'G5', 'A5', 'B5', 'D6', null,
    'B5', 'D6', 'E6', 'G6', 'F#6', 'E6', 'D6', 'B5',
    'A5', 'B5', 'G5', 'F#5', 'E5', 'B5', 'E6', null
  ],
  bass: [
    'E2', null, 'E2', 'E3', null, 'B2', 'D3', null,
    'E2', null, 'G2', 'B2', 'D3', 'B2', 'E3', null,
    'C2', null, 'C3', 'G2', null, 'C3', 'B2', null,
    'D2', null, 'D3', 'A2', 'D3', 'F#3', 'A2', null,
    'E2', null, 'E3', 'B2', 'D3', 'B2', 'G2', null,
    'E2', 'B2', 'E3', null, 'D3', 'B2', 'G2', null,
    'C2', null, 'G2', 'C3', 'B2', null, 'D3', 'C3',
    'D2', 'A2', 'D3', 'F#3', 'E2', 'B2', 'E3', null
  ],
  arp: [
    'E4', 'B4', 'G4', 'B4', 'E5', 'B4', 'G4', 'B4',
    'E4', 'B4', 'G4', 'B4', 'E5', 'B4', 'G4', 'D5',
    'C4', 'G4', 'E4', 'G4', 'C5', 'G4', 'E4', 'G4',
    'D4', 'A4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'A4',
    'E4', 'B4', 'G4', 'B4', 'E5', 'B4', 'G4', 'B4',
    'E4', 'G4', 'B4', 'D5', 'E5', 'D5', 'B4', 'G4',
    'C4', 'G4', 'E4', 'G4', 'C5', 'B4', 'G4', 'E4',
    'D4', 'A4', 'F#4', 'A4', 'E4', 'B4', 'G4', 'E5'
  ],
  drums: [
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'K', 'H',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'S', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'SH', 'H', 'S', 'S', 'KS', 'OH'
  ]
});

const BRIDGE = makeSection({
  name: 'bridge',
  lead: [
    'G5', null, 'B5', 'D6', 'G6', 'F#6', 'D6', 'B5',
    'A5', 'B5', 'D6', 'E6', 'D6', 'B5', 'G5', null,
    'F#5', null, 'A5', 'D6', 'F#6', 'E6', 'D6', 'A5',
    'B5', 'D6', 'E6', 'F#6', 'E6', 'D6', 'A5', null,
    'E5', 'G5', 'C6', 'E6', 'G6', 'E6', 'D6', 'C6',
    'G5', 'C6', 'D6', 'E6', 'G6', 'E6', 'C6', null,
    'F#5', 'A5', 'B5', 'D#6', 'F#6', 'D#6', 'B5', 'A5',
    'F#5', 'A5', 'B5', 'D#6', 'F#6', 'D#6', 'B5', 'D#6'
  ],
  bass: [
    'G2', null, 'G2', 'D3', null, 'G3', 'F#3', 'D3',
    'G2', 'B2', 'D3', null, 'G3', 'D3', 'B2', null,
    'D2', null, 'D3', 'A2', null, 'D3', 'F#3', 'A2',
    'D2', 'A2', 'D3', null, 'F#3', 'D3', 'A2', null,
    'C2', null, 'C3', 'G2', null, 'C3', 'E3', 'G2',
    'C2', 'G2', 'C3', null, 'E3', 'C3', 'G2', null,
    'B1', null, 'B2', 'F#2', 'A2', 'B2', 'D#3', 'F#3',
    'B1', 'F#2', 'A2', 'B2', 'D#3', 'F#3', 'B2', 'D#3'
  ],
  arp: [
    'G4', 'D5', 'B4', 'D5', 'G5', 'D5', 'B4', 'D5',
    'G4', 'B4', 'D5', 'G5', 'D5', 'B4', 'D5', 'G5',
    'D4', 'A4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'A4',
    'D4', 'F#4', 'A4', 'D5', 'F#5', 'D5', 'A4', 'F#4',
    'C4', 'G4', 'E4', 'G4', 'C5', 'G4', 'E4', 'G4',
    'C4', 'E4', 'G4', 'C5', 'E5', 'C5', 'G4', 'E4',
    'B3', 'F#4', 'A4', 'D#5', 'B4', 'F#4', 'A4', 'D#5',
    'B3', 'A4', 'D#5', 'F#5', 'A5', 'F#5', 'D#5', 'B4'
  ],
  drums: [
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'K', 'H',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'KS', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'KH', 'H',
    'KS', 'H', 'KS', 'H', 'S', 'KS', 'KS', 'KSO'
  ]
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'flute',
  lead: [
    'E4', 'E4', 'G4', 'G4', 'B4', 'B4', 'G4', 'G4',
    'E5', 'E5', 'B4', 'B4', 'G4', 'G4', 'B4', 'B4',
    'G4', 'G4', 'E4', 'E4', 'C5', 'C5', 'E5', 'E5',
    'G5', 'G5', 'E5', 'E5', 'D5', 'D5', 'C5', 'C5',
    'D5', 'D5', 'B4', 'B4', 'G4', 'G4', 'B4', 'B4',
    'D5', 'D5', 'B4', 'B4', 'A4', 'A4', 'G4', 'G4',
    'F#4', 'F#4', 'A4', 'A4', 'B4', 'B4', 'D#5', 'D#5',
    'B4', 'B4', 'A4', 'A4', 'F#4', 'F#4', 'D#4', 'D#4'
  ],
  bass: [
    'E2', 'E2', 'E2', 'E2', 'B2', 'B2', 'B2', 'B2',
    'E3', 'E3', 'E3', 'E3', 'B2', 'B2', 'B2', 'B2',
    'C2', 'C2', 'C2', 'C2', 'G2', 'G2', 'G2', 'G2',
    'C3', 'C3', 'C3', 'C3', 'G2', 'G2', 'G2', 'G2',
    'G2', 'G2', 'G2', 'G2', 'D3', 'D3', 'D3', 'D3',
    'G3', 'G3', 'G3', 'G3', 'D3', 'D3', 'D3', 'D3',
    'B1', 'B1', 'B1', 'B1', 'F#2', 'F#2', 'F#2', 'F#2',
    'A2', 'A2', 'A2', 'A2', 'D#3', 'D#3', 'F#3', 'F#3'
  ],
  arp: [
    'E4', null, 'G4', null, 'B4', null, 'G4', null,
    'E5', null, 'B4', null, 'G4', null, 'B4', null,
    'C4', null, 'E4', null, 'G4', null, 'E4', null,
    'C5', null, 'G4', null, 'E4', null, 'G4', null,
    'G4', null, 'B4', null, 'D5', null, 'B4', null,
    'G5', null, 'D5', null, 'B4', null, 'D5', null,
    'B3', null, 'D#4', null, 'F#4', null, 'A4', null,
    'B4', null, 'F#4', null, 'D#4', null, 'F#4', null
  ],
  drums: [
    'KH', 'H', 'H', 'H', 'SH', 'H', null, 'H',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', null, 'H',
    'KH', 'H', 'H', 'OH', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', null, 'H',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KS', 'H', 'K', 'OH', 'SH', 'H', 'KS', 'OH'
  ]
});

export const MENU_SONG = makeSong({
  id: 'menu',
  name: 'TURN Theme',
  bpm: 120,
  sections: [TUNE, BRIDGE, CHORUS],
  arrangement: ['chorus', 'chorus', 'tune', 'tune', 'bridge', 'tune']
});
